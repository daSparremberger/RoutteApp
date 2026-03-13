import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.use(requireSuperAdmin);

// GET /organizations — list with tenant info and active contract
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*,
        t.nome AS tenant_nome, t.cidade, t.estado, t.ativo AS tenant_ativo,
        c.id AS contrato_id, c.valor_mensal, c.status AS contrato_status,
        c.data_inicio AS contrato_inicio, c.data_fim AS contrato_fim
       FROM management.organizations o
       JOIN management.tenants t ON t.id = o.tenant_id
       LEFT JOIN management.contracts c ON c.organization_id = o.id AND c.status = 'ativo'
       ORDER BY o.razao_social`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /organizations — create organization for existing tenant
router.post("/", async (req, res) => {
  const { tenant_id, razao_social, cnpj, email_financeiro, telefone_financeiro, endereco_cobranca } =
    req.body as Record<string, unknown>;

  if (!tenant_id || !razao_social) {
    return res.status(400).json({ error: "tenant_id e razao_social sao obrigatorios" });
  }

  try {
    const tenant = await pool.query(
      `SELECT id FROM management.tenants WHERE id = $1`,
      [tenant_id]
    );

    if (!tenant.rowCount) {
      return res.status(404).json({ error: "Tenant nao encontrado" });
    }

    const result = await pool.query(
      `INSERT INTO management.organizations
        (tenant_id, razao_social, cnpj, email_financeiro, telefone_financeiro, endereco_cobranca)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, razao_social, cnpj ?? null, email_financeiro ?? null, telefone_financeiro ?? null, endereco_cobranca ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Tenant ja possui organizacao vinculada" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /organizations/:id — detail with contracts and invoices
router.get("/:id", async (req, res) => {
  const orgId = Number(req.params.id);

  try {
    const org = await pool.query(
      `SELECT o.*, t.nome AS tenant_nome, t.cidade, t.estado, t.ativo AS tenant_ativo
       FROM management.organizations o
       JOIN management.tenants t ON t.id = o.tenant_id
       WHERE o.id = $1`,
      [orgId]
    );

    if (!org.rowCount) {
      return res.status(404).json({ error: "Organizacao nao encontrada" });
    }

    const [contracts, invoices] = await Promise.all([
      pool.query(
        `SELECT * FROM management.contracts WHERE organization_id = $1 ORDER BY criado_em DESC`,
        [orgId]
      ),
      pool.query(
        `SELECT i.* FROM management.invoices i
         JOIN management.contracts c ON c.id = i.contract_id
         WHERE c.organization_id = $1
         ORDER BY i.mes_referencia DESC
         LIMIT 50`,
        [orgId]
      ),
    ]);

    res.json({
      ...org.rows[0],
      contracts: contracts.rows,
      invoices: invoices.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PUT /organizations/:id — update commercial data
router.put("/:id", async (req, res) => {
  const orgId = Number(req.params.id);
  const { razao_social, cnpj, email_financeiro, telefone_financeiro, endereco_cobranca } =
    req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE management.organizations
       SET razao_social = COALESCE($1, razao_social),
           cnpj = COALESCE($2, cnpj),
           email_financeiro = COALESCE($3, email_financeiro),
           telefone_financeiro = COALESCE($4, telefone_financeiro),
           endereco_cobranca = COALESCE($5, endereco_cobranca),
           atualizado_em = NOW()
       WHERE id = $6
       RETURNING *`,
      [razao_social ?? null, cnpj ?? null, email_financeiro ?? null, telefone_financeiro ?? null, endereco_cobranca ?? null, orgId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Organizacao nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// DELETE /organizations/:id — soft delete (guard: no active contract)
router.delete("/:id", async (req, res) => {
  const orgId = Number(req.params.id);

  try {
    const activeContract = await pool.query(
      `SELECT 1 FROM management.contracts WHERE organization_id = $1 AND status = 'ativo'`,
      [orgId]
    );

    if (activeContract.rowCount) {
      return res.status(409).json({ error: "Organizacao possui contrato ativo. Encerre o contrato antes de desativar." });
    }

    const result = await pool.query(
      `UPDATE management.organizations SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING *`,
      [orgId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Organizacao nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
