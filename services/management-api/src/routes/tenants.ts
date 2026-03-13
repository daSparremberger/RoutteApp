import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { appendOutboxEvent } from "../lib/outbox";

const router = Router();

router.use(requireSuperAdmin);

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        t.*,
        l.max_veiculos,
        l.max_motoristas,
        l.max_gestores,
        (
          SELECT COUNT(*)
          FROM management.tenant_modules tm
          WHERE tm.tenant_id = t.id AND tm.habilitado = true
        ) AS modulos_habilitados
      FROM management.tenants t
      LEFT JOIN management.licenses l
        ON l.tenant_id = t.id AND l.ativo = true
      ORDER BY t.criado_em DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const { nome, cidade, estado, cnpj, email_contato } = req.body as Record<string, string>;

  if (!nome || !cidade || !estado) {
    return res.status(400).json({ error: "nome, cidade e estado sao obrigatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const tenantResult = await client.query(
      `INSERT INTO management.tenants (nome, cidade, estado, cnpj, email_contato)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [nome, cidade, estado, cnpj ?? null, email_contato ?? null]
    );

    const tenant = tenantResult.rows[0];

    const licenseResult = await client.query(
      `INSERT INTO management.licenses (tenant_id, max_veiculos, max_motoristas, max_gestores, data_inicio)
       VALUES ($1, 10, 10, 3, CURRENT_DATE)
       RETURNING *`,
      [tenant.id]
    );

    await client.query(
      `INSERT INTO management.tenant_modules (tenant_id, module_id, habilitado)
       SELECT $1, id, true
       FROM management.modules
       WHERE ativo = true`,
      [tenant.id]
    );

    await appendOutboxEvent(client, {
      eventType: "tenant.created",
      aggregateType: "tenant",
      aggregateId: tenant.id,
      tenantId: tenant.id,
      payload: {
        tenant_id: tenant.id
      }
    });

    await client.query("COMMIT");

    res.status(201).json({
      ...tenant,
      license: licenseResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.get("/:id", async (req, res) => {
  const tenantId = Number(req.params.id);

  try {
    const tenantResult = await pool.query(
      `SELECT * FROM management.tenants WHERE id = $1`,
      [tenantId]
    );

    if (!tenantResult.rowCount) {
      return res.status(404).json({ error: "Tenant nao encontrado" });
    }

    const [licenseResult, modulesResult, metricsResult, invitesResult] = await Promise.all([
      pool.query(
        `SELECT * FROM management.licenses WHERE tenant_id = $1 AND ativo = true LIMIT 1`,
        [tenantId]
      ),
      pool.query(
        `SELECT
          m.slug,
          m.nome,
          m.tipo,
          tm.habilitado,
          tm.habilitado_em,
          tm.desabilitado_em
         FROM management.tenant_modules tm
         JOIN management.modules m ON m.id = tm.module_id
         WHERE tm.tenant_id = $1
         ORDER BY m.tipo, m.nome`,
        [tenantId]
      ),
      pool.query(
        `SELECT *
         FROM management.tenant_metrics
         WHERE tenant_id = $1
         ORDER BY data DESC
         LIMIT 30`,
        [tenantId]
      ),
      pool.query(
        `SELECT id, email, usado, expira_em, criado_em
         FROM management.gestor_invites
         WHERE tenant_id = $1
         ORDER BY criado_em DESC`,
        [tenantId]
      )
    ]);

    res.json({
      ...tenantResult.rows[0],
      license: licenseResult.rows[0] ?? null,
      modules: modulesResult.rows,
      metrics: metricsResult.rows,
      invites: invitesResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/:id", async (req, res) => {
  const tenantId = Number(req.params.id);
  const { nome, cidade, estado, cnpj, email_contato, ativo } =
    req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE management.tenants
       SET nome = COALESCE($1, nome),
           cidade = COALESCE($2, cidade),
           estado = COALESCE($3, estado),
           cnpj = COALESCE($4, cnpj),
           email_contato = COALESCE($5, email_contato),
           ativo = COALESCE($6, ativo),
           atualizado_em = NOW()
       WHERE id = $7
       RETURNING *`,
      [nome ?? null, cidade ?? null, estado ?? null, cnpj ?? null, email_contato ?? null, ativo ?? null, tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Tenant nao encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id", async (req, res) => {
  const tenantId = Number(req.params.id);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE management.tenants
       SET ativo = false,
           atualizado_em = NOW()
       WHERE id = $1
       RETURNING *`,
      [tenantId]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Tenant nao encontrado" });
    }

    await appendOutboxEvent(client, {
      eventType: "tenant.deactivated",
      aggregateType: "tenant",
      aggregateId: tenantId,
      tenantId,
      payload: {
        tenant_id: tenantId,
        reason: "manual_deactivation"
      }
    });

    await client.query("COMMIT");

    res.json({ message: "Tenant desativado" });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.post("/:id/invite", async (req, res) => {
  const tenantId = Number(req.params.id);
  const { email } = req.body as { email?: string };

  try {
    const token = crypto.randomUUID();
    const result = await pool.query(
      `INSERT INTO management.gestor_invites (tenant_id, token, email, expira_em)
       VALUES ($1, $2, $3, NOW() + INTERVAL '7 days')
       RETURNING id, tenant_id, token, email, usado, expira_em, criado_em`,
      [tenantId, token, email ?? null]
    );

    res.status(201).json({
      ...result.rows[0],
      convite_url: `/convite/${token}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id/invites", async (req, res) => {
  const tenantId = Number(req.params.id);

  try {
    const result = await pool.query(
      `SELECT id, tenant_id, email, token, usado, expira_em, criado_em
       FROM management.gestor_invites
       WHERE tenant_id = $1
       ORDER BY criado_em DESC`,
      [tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id/metrics", async (req, res) => {
  const tenantId = Number(req.params.id);
  const { from, to } = req.query as { from?: string; to?: string };

  try {
    const result = await pool.query(
      `SELECT *
       FROM management.tenant_metrics
       WHERE tenant_id = $1
         AND ($2::date IS NULL OR data >= $2::date)
         AND ($3::date IS NULL OR data <= $3::date)
       ORDER BY data DESC`,
      [tenantId, from ?? null, to ?? null]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id/audit", async (req, res) => {
  const tenantId = Number(req.params.id);
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
  const offset = (page - 1) * limit;

  try {
    const result = await pool.query(
      `SELECT *
       FROM management.audit_logs
       WHERE tenant_id = $1
       ORDER BY criado_em DESC
       LIMIT $2 OFFSET $3`,
      [tenantId, limit, offset]
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

export default router;
