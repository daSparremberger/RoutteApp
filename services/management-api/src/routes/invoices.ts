import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.use(requireSuperAdmin);

router.get("/", async (req, res) => {
  const { status, mes, organization_id } = req.query as Record<string, string | undefined>;

  try {
    let where = "WHERE 1=1";
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      where += ` AND i.status = $${idx++}`;
      params.push(status);
    }
    if (mes) {
      where += ` AND i.mes_referencia = $${idx++}`;
      params.push(mes);
    }
    if (organization_id) {
      where += ` AND c.organization_id = $${idx++}`;
      params.push(Number(organization_id));
    }

    const result = await pool.query(
      `SELECT i.*, c.organization_id, c.valor_mensal AS contrato_valor,
        o.razao_social, o.tenant_id
       FROM management.invoices i
       JOIN management.contracts c ON c.id = i.contract_id
       JOIN management.organizations o ON o.id = c.organization_id
       ${where}
       ORDER BY i.mes_referencia DESC, o.razao_social`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const { contract_id, mes_referencia, observacoes } = req.body as Record<string, unknown>;

  if (!contract_id || !mes_referencia) {
    return res.status(400).json({ error: "contract_id e mes_referencia sao obrigatorios" });
  }

  try {
    const contract = await pool.query(
      `SELECT id, valor_mensal, status FROM management.contracts WHERE id = $1`,
      [contract_id]
    );

    if (!contract.rowCount) {
      return res.status(404).json({ error: "Contrato nao encontrado" });
    }

    if (contract.rows[0].status !== "ativo") {
      return res.status(400).json({ error: "Contrato nao esta ativo" });
    }

    const result = await pool.query(
      `INSERT INTO management.invoices (contract_id, mes_referencia, valor, observacoes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [contract_id, mes_referencia, contract.rows[0].valor_mensal, observacoes ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Fatura ja existe para este contrato e mes" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/batch", async (req, res) => {
  const { mes_referencia } = req.body as { mes_referencia?: string };

  if (!mes_referencia) {
    return res.status(400).json({ error: "mes_referencia e obrigatorio" });
  }

  try {
    const activeContracts = await pool.query(
      `SELECT c.id, c.valor_mensal, o.razao_social
       FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE c.status = 'ativo'`
    );

    const created: unknown[] = [];
    const skipped: unknown[] = [];
    const errors: unknown[] = [];

    for (const contract of activeContracts.rows) {
      try {
        const result = await pool.query(
          `INSERT INTO management.invoices (contract_id, mes_referencia, valor)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [contract.id, mes_referencia, contract.valor_mensal]
        );
        created.push({ ...result.rows[0], razao_social: contract.razao_social });
      } catch (error: any) {
        if (error.code === "23505") {
          skipped.push({ contract_id: contract.id, razao_social: contract.razao_social, reason: "ja existe" });
        } else {
          errors.push({ contract_id: contract.id, razao_social: contract.razao_social, error: error.message });
        }
      }
    }

    res.status(201).json({ created, skipped, errors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.patch("/:id/status", async (req, res) => {
  const invoiceId = Number(req.params.id);
  const { status, observacoes } = req.body as { status?: string; observacoes?: string };

  if (!status || !["pago", "cancelado", "pendente"].includes(status)) {
    return res.status(400).json({ error: "status deve ser 'pago', 'cancelado' ou 'pendente'" });
  }

  try {
    const result = await pool.query(
      `UPDATE management.invoices
       SET status = $1,
           pago_em = CASE WHEN $1 = 'pago' THEN NOW() ELSE NULL END,
           observacoes = COALESCE($2, observacoes)
       WHERE id = $3
       RETURNING *`,
      [status, observacoes ?? null, invoiceId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Fatura nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
