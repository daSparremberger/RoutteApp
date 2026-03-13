import type {
  LineStringGeometry,
  NormalizedStop,
  OperationProfile,
  OptimizationStrategy
} from "@rotavans/shared";

import { pool } from "../db/pool";
import { appendOutboxEvent } from "./outbox";
import { decideRoutingStrategy } from "./navigation-decision-engine";
import { mapboxProvider } from "./routing-provider";

interface OptimizeRouteInput {
  tenantId: number;
  rotaId: number;
  stops: NormalizedStop[];
  operationProfile?: OperationProfile;
  orderedInput?: boolean;
  hasCapacityConstraint?: boolean;
  hasTimeWindows?: boolean;
}

interface StrategyExecutionResult {
  outputOrder: number[];
  geometry?: LineStringGeometry;
  distanceTotal?: number;
  durationTotal?: number;
  rawResponse?: Record<string, unknown>;
}

export async function optimizeRoute(input: OptimizeRouteInput) {
  const decision = decideRoutingStrategy({
    operationProfile: input.operationProfile ?? "route_optimization",
    stops: input.stops,
    orderedInput: input.orderedInput ?? false,
    hasCapacityConstraint: input.hasCapacityConstraint ?? false,
    hasTimeWindows: input.hasTimeWindows ?? false,
    requiresTraceMatching: false
  });

  const client = await pool.connect();
  let requestId = 0;

  try {
    await client.query("BEGIN");

    const requestResult = await client.query(
      `INSERT INTO app.optimization_requests
        (tenant_id, rota_id, operation_profile, stop_count, ordered_input, strategy_selected, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [
        input.tenantId,
        input.rotaId,
        input.operationProfile ?? "route_optimization",
        input.stops.length,
        input.orderedInput ?? false,
        decision.strategy
      ]
    );

    requestId = requestResult.rows[0].id as number;

    await appendOutboxEvent(client, {
      eventType: "route.optimization_requested",
      aggregateType: "rota",
      aggregateId: input.rotaId,
      tenantId: input.tenantId,
      payload: {
        tenant_id: input.tenantId,
        rota_id: input.rotaId,
        request_id: requestId,
        strategy: decision.strategy,
        stop_count: input.stops.length
      }
    });

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  const strategyChain = [decision.strategy, ...decision.fallbackChain];
  let fallbackUsed = false;
  let fallbackStrategy: OptimizationStrategy | null = null;
  let lastError: Error | null = null;

  for (const strategy of strategyChain) {
    const startedAt = Date.now();

    try {
      const result = await executeStrategy(strategy, input.stops);
      const responseTimeMs = Date.now() - startedAt;

      await pool.query(
        `INSERT INTO app.optimization_results
          (request_id, provider, strategy_used, input_stops, output_order, geometry,
           distance_total, duration_total, response_time_ms, raw_response)
         VALUES ($1, 'mapbox', $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb)`,
        [
          requestId,
          strategy,
          JSON.stringify(input.stops),
          JSON.stringify(result.outputOrder),
          result.geometry ? JSON.stringify(result.geometry) : null,
          result.distanceTotal ?? null,
          result.durationTotal ?? null,
          responseTimeMs,
          result.rawResponse ? JSON.stringify(result.rawResponse) : null
        ]
      );

      await pool.query(
        `UPDATE app.optimization_requests
         SET status = 'completed',
             fallback_used = $2,
             fallback_strategy = $3
         WHERE id = $1`,
        [requestId, fallbackUsed, fallbackStrategy]
      );

      if (result.geometry) {
        await pool.query(
          `UPDATE app.rotas
           SET rota_geojson = $1::jsonb,
               atualizado_em = NOW()
           WHERE id = $2 AND tenant_id = $3`,
          [JSON.stringify(result.geometry), input.rotaId, input.tenantId]
        );
      }

      if (strategy !== "directions" && result.outputOrder.length) {
        await reorderStops(input.rotaId, input.stops, result.outputOrder);
      }

      const eventClient = await pool.connect();
      try {
        await eventClient.query("BEGIN");
        await appendOutboxEvent(eventClient, {
          eventType: "route.optimization_completed",
          aggregateType: "rota",
          aggregateId: input.rotaId,
          tenantId: input.tenantId,
          payload: {
            tenant_id: input.tenantId,
            rota_id: input.rotaId,
            request_id: requestId,
            strategy,
            distance_total: result.distanceTotal,
            duration_total: result.durationTotal
          }
        });
        await eventClient.query("COMMIT");
      } catch (error) {
        await eventClient.query("ROLLBACK");
        throw error;
      } finally {
        eventClient.release();
      }

      return {
        requestId,
        strategy,
        outputOrder: result.outputOrder,
        geometry: result.geometry,
        distanceTotal: result.distanceTotal,
        durationTotal: result.durationTotal
      };
    } catch (error) {
      lastError = error as Error;
      fallbackUsed = true;
      fallbackStrategy = strategy;
    }
  }

  await pool.query(
    `UPDATE app.optimization_requests
     SET status = 'failed',
         fallback_used = $2,
         fallback_strategy = $3,
         error_message = $4
     WHERE id = $1`,
    [requestId, fallbackUsed, fallbackStrategy, lastError?.message ?? "Optimization failed"]
  );

  throw lastError ?? new Error("Optimization failed");
}

async function executeStrategy(
  strategy: OptimizationStrategy,
  stops: NormalizedStop[]
): Promise<StrategyExecutionResult> {
  switch (strategy) {
    case "directions": {
      const result = await mapboxProvider.getDirections(stops);
      return {
        outputOrder: stops.map((_, index) => index),
        geometry: result.geometry,
        distanceTotal: result.distance,
        durationTotal: result.duration,
        rawResponse: { waypoints: result.waypoints }
      };
    }
    case "optimization_v1": {
      const result = await mapboxProvider.optimizeRoute(stops);
      const trip = result.trips[0];
      return {
        outputOrder: result.waypoints
          .slice()
          .sort((a, b) => a.waypoint_index - b.waypoint_index)
          .map((waypoint) => waypoint.waypoint_index),
        geometry: trip?.geometry,
        distanceTotal: trip?.distance,
        durationTotal: trip?.duration,
        rawResponse: { trips: result.trips, waypoints: result.waypoints }
      };
    }
    case "matrix_heuristic": {
      const matrix = await mapboxProvider.getMatrix(stops, stops);
      const order = nearestNeighborHeuristic(matrix.durations);
      const orderedStops = order.map((index) => stops[index]);
      const directions = await mapboxProvider.getDirections(orderedStops);

      return {
        outputOrder: order,
        geometry: directions.geometry,
        distanceTotal: directions.distance,
        durationTotal: directions.duration,
        rawResponse: { matrix }
      };
    }
    default:
      throw new Error(`Unsupported strategy: ${strategy}`);
  }
}

function nearestNeighborHeuristic(durations: number[][]) {
  const total = durations.length;
  const visited = new Set<number>([0]);
  const order = [0];

  while (order.length < total) {
    const current = order[order.length - 1];
    let candidate = -1;
    let bestDuration = Number.POSITIVE_INFINITY;

    for (let index = 0; index < total; index += 1) {
      if (visited.has(index)) continue;
      const duration = durations[current]?.[index];
      if (typeof duration === "number" && duration < bestDuration) {
        bestDuration = duration;
        candidate = index;
      }
    }

    if (candidate < 0) break;

    visited.add(candidate);
    order.push(candidate);
  }

  return order;
}

async function reorderStops(rotaId: number, stops: NormalizedStop[], order: number[]) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM app.rota_paradas WHERE rota_id = $1`, [rotaId]);

    for (const [index, stopIndex] of order.entries()) {
      const stop = stops[stopIndex];
      await client.query(
        `INSERT INTO app.rota_paradas (rota_id, pessoa_id, ordem, lat, lng)
         VALUES ($1, $2, $3, $4, $5)`,
        [rotaId, stop.id, index + 1, stop.lat, stop.lng]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getOptimizationHistory(rotaId: number, tenantId: number) {
  const result = await pool.query(
    `SELECT
      req.id,
      req.operation_profile,
      req.stop_count,
      req.ordered_input,
      req.strategy_selected,
      req.fallback_used,
      req.fallback_strategy,
      req.status,
      req.error_message,
      req.criado_em,
      res.strategy_used,
      res.distance_total,
      res.duration_total,
      res.quality_score,
      res.response_time_ms
     FROM app.optimization_requests req
     LEFT JOIN app.optimization_results res ON res.request_id = req.id
     WHERE req.rota_id = $1
       AND req.tenant_id = $2
     ORDER BY req.criado_em DESC`,
    [rotaId, tenantId]
  );

  return result.rows;
}
