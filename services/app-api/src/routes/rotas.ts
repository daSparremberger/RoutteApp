import { Router } from "express";

import { pool } from "../db/pool";
import { getOptimizationHistory, optimizeRoute } from "../lib/optimization-service";
import { mapboxProvider } from "../lib/routing-provider";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("rotas"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        r.*,
        p.nome AS motorista_nome,
        v.placa AS veiculo_placa
       FROM app.rotas r
       LEFT JOIN app.pessoas p ON p.id = r.motorista_id
       LEFT JOIN app.veiculos v ON v.id = r.veiculo_id
       WHERE r.tenant_id = $1
       ORDER BY r.nome`,
      [appReq.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { motorista_id, veiculo_id, nome, turno, rota_geojson, ativo, aluno_ids } =
    req.body as Record<string, unknown>;

  if (!nome) {
    return res.status(400).json({ error: "nome e obrigatorio" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO app.rotas
        (tenant_id, motorista_id, veiculo_id, nome, turno, rota_geojson, ativo)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, COALESCE($7, true))
       RETURNING *`,
      [
        appReq.tenantId,
        motorista_id ?? null,
        veiculo_id ?? null,
        nome,
        turno ?? null,
        rota_geojson ? JSON.stringify(rota_geojson) : null,
        ativo ?? true
      ]
    );

    const rota = result.rows[0];

    if (Array.isArray(aluno_ids)) {
      for (const [index, alunoId] of aluno_ids.entries()) {
        await client.query(
          `INSERT INTO app.rota_paradas (rota_id, pessoa_id, ordem)
           VALUES ($1, $2, $3)`,
          [rota.id, alunoId, index + 1]
        );
      }
    }

    await client.query("COMMIT");
    res.status(201).json(rota);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.get("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `SELECT
        r.*,
        p.nome AS motorista_nome,
        v.placa AS veiculo_placa
       FROM app.rotas r
       LEFT JOIN app.pessoas p ON p.id = r.motorista_id
       LEFT JOIN app.veiculos v ON v.id = r.veiculo_id
       WHERE r.id = $1 AND r.tenant_id = $2`,
      [rotaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    const rota = result.rows[0];
    const paradasResult = await pool.query(
      `SELECT
        rp.*,
        p.nome AS aluno_nome,
        p.endereco AS aluno_endereco
       FROM app.rota_paradas rp
       JOIN app.pessoas p ON p.id = rp.pessoa_id
       WHERE rp.rota_id = $1
       ORDER BY rp.ordem`,
      [rotaId]
    );

    res.json({
      ...rota,
      paradas: paradasResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);
  const { motorista_id, veiculo_id, nome, turno, rota_geojson, ativo } =
    req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE app.rotas
       SET motorista_id = COALESCE($1, motorista_id),
           veiculo_id = COALESCE($2, veiculo_id),
           nome = COALESCE($3, nome),
           turno = COALESCE($4, turno),
           rota_geojson = COALESCE($5::jsonb, rota_geojson),
           ativo = COALESCE($6, ativo),
           atualizado_em = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [
        motorista_id ?? null,
        veiculo_id ?? null,
        nome ?? null,
        turno ?? null,
        rota_geojson ? JSON.stringify(rota_geojson) : null,
        ativo ?? null,
        rotaId,
        appReq.tenantId
      ]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.rotas
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [rotaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    res.json({ message: "Rota removida" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id/paradas", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `SELECT
        rp.*,
        p.nome,
        p.endereco,
        p.nome AS aluno_nome,
        p.endereco AS aluno_endereco
       FROM app.rota_paradas rp
       JOIN app.rotas r ON r.id = rp.rota_id
       JOIN app.pessoas p ON p.id = rp.pessoa_id
       WHERE rp.rota_id = $1 AND r.tenant_id = $2
       ORDER BY rp.ordem`,
      [rotaId, appReq.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/:id/paradas", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);
  const { paradas } = req.body as {
    paradas?: Array<{ pessoa_id: number; ordem: number; lat?: number; lng?: number }>;
  };

  if (!Array.isArray(paradas)) {
    return res.status(400).json({ error: "paradas deve ser um array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const rotaResult = await client.query(
      `SELECT id FROM app.rotas WHERE id = $1 AND tenant_id = $2`,
      [rotaId, appReq.tenantId]
    );

    if (!rotaResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    await client.query(`DELETE FROM app.rota_paradas WHERE rota_id = $1`, [rotaId]);

    for (const parada of paradas) {
      await client.query(
        `INSERT INTO app.rota_paradas (rota_id, pessoa_id, ordem, lat, lng)
         VALUES ($1, $2, $3, $4, $5)`,
        [rotaId, parada.pessoa_id, parada.ordem, parada.lat ?? null, parada.lng ?? null]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Paradas atualizadas", total: paradas.length });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.post("/:id/optimize", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const rotaId = Number(req.params.id);
  const { operation_profile, ordered_input } = req.body as {
    operation_profile?: string;
    ordered_input?: boolean;
  };

  try {
    const rotaResult = await pool.query(`SELECT id FROM app.rotas WHERE id = $1 AND tenant_id = $2`, [
      rotaId,
      appReq.tenantId
    ]);

    if (!rotaResult.rowCount) {
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    const stopsResult = await pool.query(
      `SELECT
        rp.pessoa_id AS id,
        rp.lat,
        rp.lng,
        p.nome AS label,
        rp.ordem
       FROM app.rota_paradas rp
       JOIN app.pessoas p ON p.id = rp.pessoa_id
       WHERE rp.rota_id = $1
       ORDER BY rp.ordem`,
      [rotaId]
    );

    const stops = stopsResult.rows.filter((row) => row.lat != null && row.lng != null);
    if (stops.length < 2) {
      return res.status(400).json({
        error: "Rota precisa de pelo menos 2 paradas com coordenadas para otimizar"
      });
    }

    const result = await optimizeRoute({
      tenantId: appReq.tenantId,
      rotaId,
      stops,
      operationProfile: (operation_profile as any) ?? "route_optimization",
      orderedInput: ordered_input ?? false
    });

    res.json({
      request_id: result.requestId,
      strategy: result.strategy,
      distance_total: result.distanceTotal,
      duration_total: result.durationTotal,
      output_order: result.outputOrder
    });
  } catch (error) {
    console.error("Optimization error", error);
    res.status(500).json({ error: "Erro na otimizacao" });
  }
});

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
    const rotaResult = await pool.query(`SELECT id FROM app.rotas WHERE id = $1 AND tenant_id = $2`, [
      rotaId,
      appReq.tenantId
    ]);

    if (!rotaResult.rowCount) {
      return res.status(404).json({ error: "Rota nao encontrada" });
    }

    const result = await mapboxProvider.matchTrace(coordinates, timestamps);

    if (result.geometry && result.confidence > 0.5) {
      await pool.query(
        `UPDATE app.rotas
         SET rota_geojson = $1::jsonb,
             atualizado_em = NOW()
         WHERE id = $2 AND tenant_id = $3`,
        [JSON.stringify(result.geometry), rotaId, appReq.tenantId]
      );
    }

    res.json({
      geometry: result.geometry,
      confidence: result.confidence,
      matchings: result.matchings
    });
  } catch (error) {
    console.error("Map matching error", error);
    res.status(500).json({ error: "Erro no map matching" });
  }
});

export default router;
