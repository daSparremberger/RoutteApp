# Routing Engine Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the intelligent routing core behind an internal abstraction, using Mapbox APIs (Directions, Matrix, Optimization, Map Matching) with a decision engine that selects the correct strategy per scenario.

**Architecture:** A `RoutingProvider` interface wraps Mapbox API calls. A `NavigationDecisionEngine` inspects each request (stop count, ordering, constraints) and selects the optimal strategy. A `RouteOptimizationService` orchestrates the workflow: persist request → decide strategy → call provider → persist result → update route geometry. All optimization metadata is stored in `optimization_requests` and `optimization_results` tables for explainability. The system integrates with existing route CRUD and execution flows.

**Tech Stack:** Mapbox Directions/Matrix/Optimization/Map Matching APIs, PostgreSQL, Express, TypeScript

**Reference:** `specs/2026-03-12-mapbox-navigation-and-routing-strategy.md`

---

## File Structure

### Shared contracts (packages/shared)

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/shared/src/routing.ts` | Create | Routing types, strategy enum, provider interface |
| `packages/shared/src/events.ts` | Modify | Add route.optimization_requested/completed events |

### Backend (app-api)

| File | Action | Responsibility |
|------|--------|----------------|
| `services/app-api/src/db/migrations/004_optimization.sql` | Create | optimization_requests + optimization_results tables |
| `services/app-api/src/lib/routing-provider.ts` | Create | Mapbox adapter implementing RoutingProvider |
| `services/app-api/src/lib/navigation-decision-engine.ts` | Create | Strategy selection logic |
| `services/app-api/src/lib/optimization-service.ts` | Create | Orchestration: request → decide → call → persist |
| `services/app-api/src/routes/rotas.ts` | Modify | Add POST /:id/optimize and GET /:id/optimization-history |

---

## Chunk 1: Shared Contracts + Database

### Task 1: Create routing contracts

**Files:**
- Create: `packages/shared/src/routing.ts`
- Modify: `packages/shared/src/events.ts`

- [ ] **Step 1: Create routing types**

```typescript
// packages/shared/src/routing.ts

export type OptimizationStrategy =
  | "directions"
  | "optimization_v1"
  | "matrix_heuristic"
  | "map_matching";

export type OperationProfile =
  | "route_preview"
  | "route_optimization"
  | "execution_reroute"
  | "trace_correction"
  | "assignment_scoring"
  | "coverage_analysis";

export interface NormalizedStop {
  id: number;
  lat: number;
  lng: number;
  label?: string;
  ordem?: number;
}

export interface RoutingDecisionInput {
  operationProfile: OperationProfile;
  stops: NormalizedStop[];
  orderedInput: boolean;
  hasCapacityConstraint: boolean;
  hasTimeWindows: boolean;
  requiresTraceMatching: boolean;
}

export interface RoutingDecisionOutput {
  strategy: OptimizationStrategy;
  fallbackChain: OptimizationStrategy[];
  reason: string;
}

export interface DirectionsResult {
  geometry: GeoJSON.LineString;
  distance: number; // meters
  duration: number; // seconds
  waypoints: Array<{ location: [number, number]; name: string }>;
}

export interface MatrixResult {
  durations: number[][]; // seconds
  distances: number[][]; // meters
  sources: Array<{ location: [number, number] }>;
  destinations: Array<{ location: [number, number] }>;
}

export interface OptimizationResult {
  trips: Array<{
    geometry: GeoJSON.LineString;
    distance: number;
    duration: number;
  }>;
  waypoints: Array<{
    waypoint_index: number;
    trips_index: number;
    location: [number, number];
  }>;
}

export interface MapMatchResult {
  geometry: GeoJSON.LineString;
  confidence: number;
  matchings: Array<{
    distance: number;
    duration: number;
    geometry: GeoJSON.LineString;
  }>;
}

export interface RoutingProvider {
  getDirections(stops: NormalizedStop[], profile?: string): Promise<DirectionsResult>;
  getMatrix(origins: NormalizedStop[], destinations: NormalizedStop[]): Promise<MatrixResult>;
  optimizeRoute(stops: NormalizedStop[], profile?: string): Promise<OptimizationResult>;
  matchTrace(coordinates: [number, number][], timestamps?: number[]): Promise<MapMatchResult>;
}

export interface OptimizationRequestRecord {
  id: number;
  tenant_id: number;
  rota_id: number;
  operation_profile: OperationProfile;
  stop_count: number;
  ordered_input: boolean;
  strategy_selected: OptimizationStrategy;
  fallback_used: boolean;
  fallback_strategy?: OptimizationStrategy;
  status: "pending" | "completed" | "failed";
  criado_em: string;
}

export interface OptimizationResultRecord {
  id: number;
  request_id: number;
  provider: string;
  strategy_used: OptimizationStrategy;
  input_stops: NormalizedStop[];
  output_order: number[];
  geometry?: GeoJSON.LineString;
  distance_total?: number;
  duration_total?: number;
  quality_score?: number;
  response_time_ms: number;
  raw_response?: Record<string, unknown>;
  criado_em: string;
}
```

- [ ] **Step 2: Add routing events to events.ts**

Add to the `CrossServiceEvent` union in `packages/shared/src/events.ts`:

```typescript
  | "route.optimization_requested"
  | "route.optimization_completed"
```

Add to the `EventPayloads` interface:

```typescript
  "route.optimization_requested": {
    tenant_id: number;
    rota_id: number;
    request_id: number;
    strategy: string;
    stop_count: number;
  };
  "route.optimization_completed": {
    tenant_id: number;
    rota_id: number;
    request_id: number;
    strategy: string;
    distance_total?: number;
    duration_total?: number;
  };
```

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/routing.ts packages/shared/src/events.ts
git commit -m "feat: add routing contracts and optimization event types"
```

### Task 2: Create optimization tables migration

**Files:**
- Create: `services/app-api/src/db/migrations/004_optimization.sql`

- [ ] **Step 1: Create migration**

```sql
-- 004_optimization.sql

CREATE TABLE IF NOT EXISTS app.optimization_requests (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL,
  rota_id         INTEGER NOT NULL REFERENCES app.rotas(id) ON DELETE CASCADE,
  operation_profile TEXT NOT NULL DEFAULT 'route_optimization',
  stop_count      INTEGER NOT NULL,
  ordered_input   BOOLEAN NOT NULL DEFAULT false,
  strategy_selected TEXT NOT NULL,
  fallback_used   BOOLEAN NOT NULL DEFAULT false,
  fallback_strategy TEXT,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'completed', 'failed')),
  error_message   TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_requests_rota
  ON app.optimization_requests (rota_id);

CREATE INDEX IF NOT EXISTS idx_optimization_requests_tenant
  ON app.optimization_requests (tenant_id);

CREATE TABLE IF NOT EXISTS app.optimization_results (
  id              SERIAL PRIMARY KEY,
  request_id      INTEGER NOT NULL REFERENCES app.optimization_requests(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL DEFAULT 'mapbox',
  strategy_used   TEXT NOT NULL,
  input_stops     JSONB NOT NULL,
  output_order    JSONB NOT NULL,
  geometry        JSONB,
  distance_total  REAL,
  duration_total  REAL,
  quality_score   REAL,
  response_time_ms INTEGER NOT NULL,
  raw_response    JSONB,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_optimization_results_request
  ON app.optimization_results (request_id);
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/db/migrations/004_optimization.sql
git commit -m "feat: add optimization_requests and optimization_results tables"
```

---

## Chunk 2: Routing Provider (Mapbox Adapter)

### Task 3: Implement Mapbox routing provider

**Files:**
- Create: `services/app-api/src/lib/routing-provider.ts`

- [ ] **Step 1: Create provider**

```typescript
// services/app-api/src/lib/routing-provider.ts
import type { NormalizedStop, DirectionsResult, MatrixResult, OptimizationResult, MapMatchResult, RoutingProvider } from "@rotavans/shared/routing";

const MAPBOX_BASE = "https://api.mapbox.com";

function getToken(): string {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) throw new Error("MAPBOX_ACCESS_TOKEN not configured");
  return token;
}

function coordsString(stops: NormalizedStop[]): string {
  return stops.map((s) => `${s.lng},${s.lat}`).join(";");
}

export const mapboxProvider: RoutingProvider = {
  async getDirections(stops, profile = "driving"): Promise<DirectionsResult> {
    const coords = coordsString(stops);
    const url = `${MAPBOX_BASE}/directions/v5/mapbox/${profile}/${coords}?geometries=geojson&overview=full&access_token=${getToken()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Directions API error: ${res.status}`);

    const data = await res.json();
    const route = data.routes[0];

    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      waypoints: data.waypoints.map((wp: any) => ({
        location: wp.location,
        name: wp.name || "",
      })),
    };
  },

  async getMatrix(origins, destinations): Promise<MatrixResult> {
    const allStops = [...origins, ...destinations];
    const coords = coordsString(allStops);
    const sourceIndices = origins.map((_, i) => i).join(";");
    const destIndices = destinations.map((_, i) => i + origins.length).join(";");
    const url = `${MAPBOX_BASE}/directions-matrix/v1/mapbox/driving/${coords}?sources=${sourceIndices}&destinations=${destIndices}&annotations=duration,distance&access_token=${getToken()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Matrix API error: ${res.status}`);

    const data = await res.json();

    return {
      durations: data.durations,
      distances: data.distances,
      sources: data.sources.map((s: any) => ({ location: s.location })),
      destinations: data.destinations.map((d: any) => ({ location: d.location })),
    };
  },

  async optimizeRoute(stops, profile = "driving"): Promise<OptimizationResult> {
    const coords = coordsString(stops);
    const url = `${MAPBOX_BASE}/optimized-trips/v1/mapbox/${profile}/${coords}?geometries=geojson&overview=full&roundtrip=false&source=first&destination=last&access_token=${getToken()}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Optimization API error: ${res.status}`);

    const data = await res.json();

    return {
      trips: data.trips.map((trip: any) => ({
        geometry: trip.geometry,
        distance: trip.distance,
        duration: trip.duration,
      })),
      waypoints: data.waypoints.map((wp: any) => ({
        waypoint_index: wp.waypoint_index,
        trips_index: wp.trips_index,
        location: wp.location,
      })),
    };
  },

  async matchTrace(coordinates, timestamps): Promise<MapMatchResult> {
    const coords = coordinates.map((c) => `${c[0]},${c[1]}`).join(";");
    let url = `${MAPBOX_BASE}/matching/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${getToken()}`;
    if (timestamps) {
      url += `&timestamps=${timestamps.join(";")}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`Map Matching API error: ${res.status}`);

    const data = await res.json();

    return {
      geometry: data.matchings[0]?.geometry || { type: "LineString", coordinates: [] },
      confidence: data.matchings[0]?.confidence || 0,
      matchings: data.matchings.map((m: any) => ({
        distance: m.distance,
        duration: m.duration,
        geometry: m.geometry,
      })),
    };
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/lib/routing-provider.ts
git commit -m "feat: add Mapbox routing provider adapter"
```

---

## Chunk 3: Decision Engine + Optimization Service

### Task 4: Implement NavigationDecisionEngine

**Files:**
- Create: `services/app-api/src/lib/navigation-decision-engine.ts`

- [ ] **Step 1: Create engine**

```typescript
// services/app-api/src/lib/navigation-decision-engine.ts
import type { RoutingDecisionInput, RoutingDecisionOutput, OptimizationStrategy } from "@rotavans/shared/routing";

const OPTIMIZATION_V1_MAX_STOPS = 12;

export function decide(input: RoutingDecisionInput): RoutingDecisionOutput {
  // Case D: GPS trace correction
  if (input.requiresTraceMatching) {
    return {
      strategy: "map_matching",
      fallbackChain: [],
      reason: "Trace correction requested — using Map Matching",
    };
  }

  // Case A: Ordered route — just needs geometry/ETA
  if (input.orderedInput || input.operationProfile === "route_preview" || input.operationProfile === "execution_reroute") {
    return {
      strategy: "directions",
      fallbackChain: [],
      reason: "Stop order is fixed — using Directions for geometry/ETA",
    };
  }

  // Case B: Small unordered set — prefer Optimization v1
  if (
    input.operationProfile === "route_optimization" &&
    !input.hasCapacityConstraint &&
    !input.hasTimeWindows &&
    input.stops.length <= OPTIMIZATION_V1_MAX_STOPS
  ) {
    return {
      strategy: "optimization_v1",
      fallbackChain: ["matrix_heuristic", "directions"],
      reason: `${input.stops.length} stops, no constraints — using Optimization v1`,
    };
  }

  // Case C/F: Larger set or constraints — Matrix + internal heuristic
  if (
    input.operationProfile === "route_optimization" ||
    input.operationProfile === "assignment_scoring"
  ) {
    return {
      strategy: "matrix_heuristic",
      fallbackChain: ["directions"],
      reason: `${input.stops.length} stops with constraints — using Matrix + heuristic`,
    };
  }

  // Default: Directions
  return {
    strategy: "directions",
    fallbackChain: [],
    reason: "Default fallback — using Directions",
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/lib/navigation-decision-engine.ts
git commit -m "feat: add NavigationDecisionEngine with strategy selection heuristics"
```

### Task 5: Implement RouteOptimizationService

**Files:**
- Create: `services/app-api/src/lib/optimization-service.ts`

- [ ] **Step 1: Create service**

```typescript
// services/app-api/src/lib/optimization-service.ts
import { pool } from "../db/pool";
import { appendOutboxEvent } from "./outbox";
import { mapboxProvider } from "./routing-provider";
import { decide } from "./navigation-decision-engine";
import type { NormalizedStop, OptimizationStrategy, OperationProfile } from "@rotavans/shared/routing";

interface OptimizeInput {
  tenantId: number;
  rotaId: number;
  stops: NormalizedStop[];
  operationProfile?: OperationProfile;
  orderedInput?: boolean;
  hasCapacityConstraint?: boolean;
  hasTimeWindows?: boolean;
}

interface OptimizeOutput {
  requestId: number;
  strategy: OptimizationStrategy;
  outputOrder: number[];
  geometry?: GeoJSON.LineString;
  distanceTotal?: number;
  durationTotal?: number;
}

export async function optimizeRoute(input: OptimizeInput): Promise<OptimizeOutput> {
  const decision = decide({
    operationProfile: input.operationProfile || "route_optimization",
    stops: input.stops,
    orderedInput: input.orderedInput || false,
    hasCapacityConstraint: input.hasCapacityConstraint || false,
    hasTimeWindows: input.hasTimeWindows || false,
    requiresTraceMatching: false,
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Persist request
    const reqResult = await client.query(
      `INSERT INTO app.optimization_requests
        (tenant_id, rota_id, operation_profile, stop_count, ordered_input, strategy_selected, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING id`,
      [
        input.tenantId,
        input.rotaId,
        input.operationProfile || "route_optimization",
        input.stops.length,
        input.orderedInput || false,
        decision.strategy,
      ]
    );
    const requestId = reqResult.rows[0].id;

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
        stop_count: input.stops.length,
      },
    });

    await client.query("COMMIT");

    // Execute strategy with fallback chain
    const strategies = [decision.strategy, ...decision.fallbackChain];
    let lastError: Error | null = null;
    let fallbackUsed = false;
    let fallbackStrategy: OptimizationStrategy | undefined;

    for (const strategy of strategies) {
      const startTime = Date.now();
      try {
        const result = await executeStrategy(strategy, input.stops);
        const responseTimeMs = Date.now() - startTime;

        // Persist result
        await pool.query(
          `INSERT INTO app.optimization_results
            (request_id, provider, strategy_used, input_stops, output_order,
             geometry, distance_total, duration_total, response_time_ms)
           VALUES ($1, 'mapbox', $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, $7, $8)`,
          [
            requestId,
            strategy,
            JSON.stringify(input.stops),
            JSON.stringify(result.outputOrder),
            result.geometry ? JSON.stringify(result.geometry) : null,
            result.distanceTotal ?? null,
            result.durationTotal ?? null,
            responseTimeMs,
          ]
        );

        // Update request status
        await pool.query(
          `UPDATE app.optimization_requests
           SET status = 'completed', fallback_used = $2, fallback_strategy = $3
           WHERE id = $1`,
          [requestId, fallbackUsed, fallbackStrategy ?? null]
        );

        // Update route geometry
        if (result.geometry) {
          await pool.query(
            `UPDATE app.rotas SET rota_geojson = $1::jsonb, atualizado_em = NOW()
             WHERE id = $2`,
            [JSON.stringify(result.geometry), input.rotaId]
          );
        }

        // Update stop order if reordered
        if (result.outputOrder.length > 0 && strategy !== "directions") {
          await reorderStops(input.rotaId, input.stops, result.outputOrder);
        }

        // Publish completion event
        const client2 = await pool.connect();
        try {
          await client2.query("BEGIN");
          await appendOutboxEvent(client2, {
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
              duration_total: result.durationTotal,
            },
          });
          await client2.query("COMMIT");
        } finally {
          client2.release();
        }

        return {
          requestId,
          strategy,
          outputOrder: result.outputOrder,
          geometry: result.geometry,
          distanceTotal: result.distanceTotal,
          durationTotal: result.durationTotal,
        };
      } catch (error) {
        lastError = error as Error;
        fallbackUsed = true;
        fallbackStrategy = strategy;
        console.error(`Strategy ${strategy} failed, trying fallback:`, error);
      }
    }

    // All strategies failed
    await pool.query(
      `UPDATE app.optimization_requests
       SET status = 'failed', error_message = $2
       WHERE id = $1`,
      [requestId, lastError?.message || "All strategies failed"]
    );

    throw new Error(`Optimization failed: ${lastError?.message}`);
  } catch (error) {
    // If we're still in a transaction, rollback
    try { await client.query("ROLLBACK"); } catch {}
    throw error;
  } finally {
    client.release();
  }
}

interface StrategyResult {
  outputOrder: number[];
  geometry?: GeoJSON.LineString;
  distanceTotal?: number;
  durationTotal?: number;
}

async function executeStrategy(strategy: OptimizationStrategy, stops: NormalizedStop[]): Promise<StrategyResult> {
  switch (strategy) {
    case "directions": {
      const result = await mapboxProvider.getDirections(stops);
      return {
        outputOrder: stops.map((_, i) => i),
        geometry: result.geometry,
        distanceTotal: result.distance,
        durationTotal: result.duration,
      };
    }

    case "optimization_v1": {
      const result = await mapboxProvider.optimizeRoute(stops);
      const outputOrder = result.waypoints
        .sort((a, b) => a.waypoint_index - b.waypoint_index)
        .map((wp) => wp.waypoint_index);
      const trip = result.trips[0];
      return {
        outputOrder,
        geometry: trip?.geometry,
        distanceTotal: trip?.distance,
        durationTotal: trip?.duration,
      };
    }

    case "matrix_heuristic": {
      const matrix = await mapboxProvider.getMatrix(stops, stops);
      const order = nearestNeighborHeuristic(matrix.durations);
      // After ordering, get directions for geometry
      const orderedStops = order.map((i) => stops[i]);
      const directions = await mapboxProvider.getDirections(orderedStops);
      return {
        outputOrder: order,
        geometry: directions.geometry,
        distanceTotal: directions.distance,
        durationTotal: directions.duration,
      };
    }

    default:
      throw new Error(`Unsupported strategy: ${strategy}`);
  }
}

/**
 * Nearest-neighbor heuristic: greedy TSP starting from index 0.
 * Returns reordered indices.
 */
function nearestNeighborHeuristic(durations: number[][]): number[] {
  const n = durations.length;
  const visited = new Set<number>();
  const order: number[] = [0];
  visited.add(0);

  for (let step = 1; step < n; step++) {
    const current = order[order.length - 1];
    let bestNext = -1;
    let bestDuration = Infinity;

    for (let j = 0; j < n; j++) {
      if (!visited.has(j) && durations[current][j] < bestDuration) {
        bestDuration = durations[current][j];
        bestNext = j;
      }
    }

    if (bestNext >= 0) {
      order.push(bestNext);
      visited.add(bestNext);
    }
  }

  return order;
}

async function reorderStops(rotaId: number, stops: NormalizedStop[], newOrder: number[]): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM app.rota_paradas WHERE rota_id = $1`, [rotaId]);

    for (let i = 0; i < newOrder.length; i++) {
      const stop = stops[newOrder[i]];
      await client.query(
        `INSERT INTO app.rota_paradas (rota_id, pessoa_id, ordem, lat, lng)
         VALUES ($1, $2, $3, $4, $5)`,
        [rotaId, stop.id, i + 1, stop.lat, stop.lng]
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
       req.id, req.operation_profile, req.stop_count, req.ordered_input,
       req.strategy_selected, req.fallback_used, req.fallback_strategy,
       req.status, req.error_message, req.criado_em,
       res.strategy_used, res.distance_total, res.duration_total,
       res.quality_score, res.response_time_ms
     FROM app.optimization_requests req
     LEFT JOIN app.optimization_results res ON res.request_id = req.id
     WHERE req.rota_id = $1 AND req.tenant_id = $2
     ORDER BY req.criado_em DESC
     LIMIT 20`,
    [rotaId, tenantId]
  );

  return result.rows;
}
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/lib/optimization-service.ts
git commit -m "feat: add RouteOptimizationService with fallback chain and heuristic solver"
```

---

## Chunk 4: API Endpoints + Integration

### Task 6: Add optimization endpoints to rotas router

**Files:**
- Modify: `services/app-api/src/routes/rotas.ts`

- [ ] **Step 1: Add imports**

Add at the top of `services/app-api/src/routes/rotas.ts`:

```typescript
import { optimizeRoute, getOptimizationHistory } from "../lib/optimization-service";
```

- [ ] **Step 2: Add POST /:id/optimize endpoint**

Add before `export default router`:

```typescript
router.post("/:id/optimize", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);
  const { operation_profile, ordered_input } = req.body as {
    operation_profile?: string;
    ordered_input?: boolean;
  };

  try {
    // Verify route exists and belongs to tenant
    const rotaResult = await pool.query(
      `SELECT id FROM app.rotas WHERE id = $1 AND tenant_id = $2`,
      [rotaId, appReq.tenantId]
    );
    if (!rotaResult.rowCount) {
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    // Load stops with coordinates
    const stopsResult = await pool.query(
      `SELECT rp.pessoa_id AS id, rp.lat, rp.lng, p.nome AS label, rp.ordem
       FROM app.rota_paradas rp
       JOIN app.pessoas p ON p.id = rp.pessoa_id
       WHERE rp.rota_id = $1
       ORDER BY rp.ordem`,
      [rotaId]
    );

    const stops = stopsResult.rows.filter(
      (s: any) => s.lat != null && s.lng != null
    );

    if (stops.length < 2) {
      return res.status(400).json({
        error: "Rota precisa de pelo menos 2 paradas com coordenadas para otimizar",
      });
    }

    const result = await optimizeRoute({
      tenantId: appReq.tenantId,
      rotaId,
      stops,
      operationProfile: (operation_profile as any) || "route_optimization",
      orderedInput: ordered_input || false,
    });

    res.json({
      request_id: result.requestId,
      strategy: result.strategy,
      distance_total: result.distanceTotal,
      duration_total: result.durationTotal,
      output_order: result.outputOrder,
    });
  } catch (error) {
    console.error("Optimization error:", error);
    res.status(500).json({ error: "Erro na otimizacao" });
  }
});
```

- [ ] **Step 3: Add GET /:id/optimization-history endpoint**

Add before `export default router`:

```typescript
router.get("/:id/optimization-history", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);

  try {
    const history = await getOptimizationHistory(rotaId, appReq.tenantId);
    res.json(history);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});
```

- [ ] **Step 4: Build to verify**

```bash
cd services/app-api && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add services/app-api/src/routes/rotas.ts
git commit -m "feat: add route optimization and history endpoints"
```

### Task 7: Add map matching endpoint for trace correction

**Files:**
- Modify: `services/app-api/src/routes/rotas.ts`

- [ ] **Step 1: Add trace correction endpoint**

Add before `export default router` in `services/app-api/src/routes/rotas.ts`:

```typescript
router.post("/:id/match-trace", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);
  const { coordinates, timestamps } = req.body as {
    coordinates?: [number, number][];
    timestamps?: number[];
  };

  if (!coordinates || coordinates.length < 2) {
    return res.status(400).json({ error: "coordinates deve ter pelo menos 2 pontos" });
  }

  try {
    const rotaResult = await pool.query(
      `SELECT id FROM app.rotas WHERE id = $1 AND tenant_id = $2`,
      [rotaId, appReq.tenantId]
    );
    if (!rotaResult.rowCount) {
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    const { mapboxProvider } = await import("../lib/routing-provider");
    const result = await mapboxProvider.matchTrace(coordinates, timestamps);

    // Optionally update route geometry with corrected trace
    if (result.geometry && result.confidence > 0.5) {
      await pool.query(
        `UPDATE app.rotas SET rota_geojson = $1::jsonb, atualizado_em = NOW()
         WHERE id = $2`,
        [JSON.stringify(result.geometry), rotaId]
      );
    }

    res.json({
      geometry: result.geometry,
      confidence: result.confidence,
      matchings: result.matchings,
    });
  } catch (error) {
    console.error("Map matching error:", error);
    res.status(500).json({ error: "Erro no map matching" });
  }
});
```

- [ ] **Step 2: Build to verify**

```bash
cd services/app-api && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add services/app-api/src/routes/rotas.ts
git commit -m "feat: add map matching endpoint for GPS trace correction"
```
