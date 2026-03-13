import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.use(requireSuperAdmin);

router.get("/", async (req, res) => {
  const tenantId = req.query.tenant_id ? Number(req.query.tenant_id) : null;

  try {
    const result = await pool.query(
      `SELECT *
       FROM management.anomaly_alerts
       WHERE resolvido = false
         AND ($1::int IS NULL OR tenant_id = $1)
       ORDER BY
         CASE severidade
           WHEN 'critical' THEN 1
           WHEN 'warning' THEN 2
           ELSE 3
         END,
         criado_em DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/resolve", async (req, res) => {
  const anomalyId = Number(req.params.id);
  const { nota_resolucao } = req.body as { nota_resolucao?: string };

  try {
    const result = await pool.query(
      `UPDATE management.anomaly_alerts
       SET resolvido = true,
           resolvido_em = NOW(),
           nota_resolucao = $1
       WHERE id = $2
       RETURNING *`,
      [nota_resolucao ?? null, anomalyId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Alerta nao encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
