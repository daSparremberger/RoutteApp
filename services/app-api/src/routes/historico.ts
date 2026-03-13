import { Router } from "express";

import { pool } from "../db/pool";
import { setCsvHeaders, toCsv } from "../lib/csv";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("historico"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const motoristaId = req.query.motorista_id ? Number(req.query.motorista_id) : null;
  const rotaId = req.query.rota_id ? Number(req.query.rota_id) : null;
  const data = req.query.data ? String(req.query.data) : null;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT *
       FROM app.historico
       WHERE tenant_id = $1
         AND ($2::int IS NULL OR motorista_id = $2)
         AND ($3::int IS NULL OR rota_id = $3)
         AND ($4::date IS NULL OR data_execucao = $4::date)
       ORDER BY data_execucao DESC, criado_em DESC
       LIMIT $5 OFFSET $6`,
      [appReq.tenantId, motoristaId, rotaId, data, limit, offset]
    );

    res.json({
      page,
      limit,
      items: result.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/export", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        data_execucao,
        rota_nome,
        motorista_nome,
        alunos_embarcados,
        alunos_pulados,
        km_total,
        iniciada_em,
        concluida_em
       FROM app.historico
       WHERE tenant_id = $1
       ORDER BY data_execucao DESC, criado_em DESC`,
      [appReq.tenantId]
    );

    const csv = toCsv(result.rows, [
      { key: "data_execucao", label: "Data" },
      { key: "rota_nome", label: "Rota" },
      { key: "motorista_nome", label: "Motorista" },
      { key: "alunos_embarcados", label: "Embarcados" },
      { key: "alunos_pulados", label: "Pulados" },
      { key: "km_total", label: "KM" },
      { key: "iniciada_em", label: "Inicio" },
      { key: "concluida_em", label: "Fim" }
    ]);

    setCsvHeaders(res, "historico.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
