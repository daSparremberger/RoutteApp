import { Router } from "express";

import { requireSuperAdmin } from "../middleware/auth";
import { pool } from "../db/pool";

const router = Router();

router.use(requireSuperAdmin);

router.get("/", async (_req, res) => {
  try {
    const [tenants, alerts, activity] = await Promise.all([
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE ativo = true) AS active_tenants,
          COUNT(*) AS total_tenants
         FROM management.tenants`
      ),
      pool.query(
        `SELECT
          COUNT(*) FILTER (WHERE resolvido = false) AS open_alerts,
          COUNT(*) FILTER (WHERE resolvido = false AND severidade = 'critical') AS critical_alerts
         FROM management.anomaly_alerts`
      ),
      pool.query(
        `SELECT
          COALESCE(SUM(total_logins), 0) AS total_logins_30d,
          COALESCE(SUM(total_requests), 0) AS total_requests_30d,
          COALESCE(SUM(execucoes_concluidas), 0) AS execucoes_30d
         FROM management.tenant_metrics
         WHERE data >= CURRENT_DATE - INTERVAL '30 days'`
      )
    ]);

    const comercial = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM management.contracts WHERE status = 'ativo') AS contratos_ativos,
        (SELECT COALESCE(SUM(valor_mensal), 0) FROM management.contracts WHERE status = 'ativo') AS receita_mensal_total,
        (SELECT COUNT(*) FROM management.invoices WHERE status = 'pendente') AS faturas_pendentes,
        (SELECT COALESCE(SUM(valor), 0) FROM management.invoices WHERE status = 'pendente') AS valor_faturas_pendentes,
        (SELECT COUNT(*) FROM management.contracts WHERE status = 'ativo' AND data_fim IS NOT NULL AND data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS contratos_vencendo_30d`
    );

    res.json({
      ...tenants.rows[0],
      ...alerts.rows[0],
      ...activity.rows[0],
      comercial: {
        contratos_ativos: Number(comercial.rows[0].contratos_ativos),
        receita_mensal_total: Number(comercial.rows[0].receita_mensal_total),
        faturas_pendentes: Number(comercial.rows[0].faturas_pendentes),
        valor_faturas_pendentes: Number(comercial.rows[0].valor_faturas_pendentes),
        contratos_vencendo_30d: Number(comercial.rows[0].contratos_vencendo_30d),
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
