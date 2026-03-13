import { Router } from "express";

import { pool } from "../db/pool";
import { appendOutboxEvent } from "../lib/outbox";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("execucao"));

router.post("/iniciar", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { rota_id, motorista_id, veiculo_id } = req.body as Record<string, unknown>;

  if (!rota_id) {
    return res.status(400).json({ error: "rota_id e obrigatorio" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO app.execucoes (tenant_id, rota_id, motorista_id, veiculo_id, status)
       VALUES ($1, $2, $3, $4, 'em_andamento')
       RETURNING *`,
      [appReq.tenantId, rota_id, motorista_id ?? appReq.user.sub, veiculo_id ?? null]
    );

    const execution = result.rows[0];

    await appendOutboxEvent(client, {
      eventType: "execution.started",
      aggregateType: "execution",
      aggregateId: execution.id,
      tenantId: appReq.tenantId,
      payload: {
        tenant_id: appReq.tenantId,
        execution_id: execution.id,
        route_id: execution.rota_id,
        driver_id: execution.motorista_id,
        vehicle_id: execution.veiculo_id,
        started_at: execution.iniciada_em
      }
    });

    await client.query("COMMIT");
    res.status(201).json(execution);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.post("/:id/parada", async (req, res) => {
  const execucaoId = Number(req.params.id);
  const { pessoa_id, status } = req.body as Record<string, unknown>;

  if (!pessoa_id || !status) {
    return res.status(400).json({ error: "pessoa_id e status sao obrigatorios" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO app.execucao_paradas (execucao_id, pessoa_id, status)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [execucaoId, pessoa_id, status]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/:id/finalizar", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const execucaoId = Number(req.params.id);

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const execucaoResult = await client.query(
      `UPDATE app.execucoes
       SET status = 'concluida',
           concluida_em = NOW()
       WHERE id = $1
         AND tenant_id = $2
       RETURNING *`,
      [execucaoId, appReq.tenantId]
    );

    if (!execucaoResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Execucao nao encontrada" });
    }

    const execucao = execucaoResult.rows[0];

    const statsResult = await client.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'embarcou')::int AS embarcados,
        COUNT(*) FILTER (WHERE status = 'pulou')::int AS pulados
       FROM app.execucao_paradas
       WHERE execucao_id = $1`,
      [execucaoId]
    );

    const joinResult = await client.query(
      `SELECT
        r.nome AS rota_nome,
        p.nome AS motorista_nome,
        v.placa AS veiculo_placa
       FROM app.execucoes e
       LEFT JOIN app.rotas r ON r.id = e.rota_id
       LEFT JOIN app.pessoas p ON p.id = e.motorista_id
       LEFT JOIN app.veiculos v ON v.id = e.veiculo_id
       WHERE e.id = $1`,
      [execucaoId]
    );

    const stats = statsResult.rows[0];
    const joined = joinResult.rows[0] ?? {};

    const historicoResult = await client.query(
      `INSERT INTO app.historico
        (
          tenant_id,
          execucao_id,
          rota_id,
          rota_nome,
          motorista_id,
          motorista_nome,
          veiculo_id,
          veiculo_placa,
          km_total,
          alunos_embarcados,
          alunos_pulados,
          data_execucao,
          iniciada_em,
          concluida_em
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, CURRENT_DATE, $12, $13)
       RETURNING *`,
      [
        appReq.tenantId,
        execucaoId,
        execucao.rota_id,
        joined.rota_nome ?? null,
        execucao.motorista_id,
        joined.motorista_nome ?? null,
        execucao.veiculo_id,
        joined.veiculo_placa ?? null,
        null,
        stats.embarcados ?? 0,
        stats.pulados ?? 0,
        execucao.iniciada_em,
        execucao.concluida_em
      ]
    );

    await appendOutboxEvent(client, {
      eventType: "execution.completed",
      aggregateType: "execution",
      aggregateId: execucaoId,
      tenantId: appReq.tenantId,
      payload: {
        tenant_id: appReq.tenantId,
        execution_id: execucaoId,
        route_id: execucao.rota_id,
        driver_id: execucao.motorista_id,
        vehicle_id: execucao.veiculo_id,
        completed_at: execucao.concluida_em,
        stats: {
          completed_stops: stats.embarcados ?? 0,
          skipped_stops: stats.pulados ?? 0
        }
      }
    });

    await client.query("COMMIT");

    res.json({
      execucao,
      stats,
      historico: historicoResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.post("/:id/cancelar", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const execucaoId = Number(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE app.execucoes
       SET status = 'cancelada',
           concluida_em = NOW()
       WHERE id = $1
         AND tenant_id = $2
       RETURNING *`,
      [execucaoId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Execucao nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/ativa", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT *
       FROM app.execucoes
       WHERE tenant_id = $1
         AND motorista_id = $2
         AND status = 'em_andamento'
       ORDER BY iniciada_em DESC
       LIMIT 1`,
      [appReq.tenantId, appReq.user.sub]
    );

    res.json(result.rows[0] ?? null);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/historico", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT *
       FROM app.historico
       WHERE tenant_id = $1
       ORDER BY data_execucao DESC, criado_em DESC`,
      [appReq.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
