import { Router } from "express";

import { pool } from "../db/pool";
import { setCsvHeaders, toCsv } from "../lib/csv";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("financeiro"));

function mapLegacyQueryToStatus(query: unknown) {
  if (query === "true") return "pago";
  if (query === "false") return "pendente";
  return null;
}

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const status = mapLegacyQueryToStatus(req.query.pago);

  try {
    const result = await pool.query(
      `SELECT
        c.id,
        c.tenant_id,
        c.pessoa_id,
        p.nome AS aluno_nome,
        c.valor::float AS valor,
        c.criado_em,
        c.criado_em::date::text AS data,
        CASE WHEN c.status = 'pago' THEN true ELSE false END AS pago,
        CASE WHEN c.pessoa_id IS NULL THEN 'despesa' ELSE 'receita' END AS tipo,
        'mensalidade' AS categoria,
        NULL::text AS descricao,
        c.status,
        to_char(c.mes_referencia, 'YYYY-MM') AS mes_referencia
       FROM app.cobrancas c
       LEFT JOIN app.pessoas p ON p.id = c.pessoa_id
       WHERE c.tenant_id = $1
         AND ($2::text IS NULL OR c.status = $2)
       ORDER BY c.criado_em DESC`,
      [appReq.tenantId, status]
    );

    res.json(result.rows);
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
        c.criado_em AS data,
        CASE WHEN c.pessoa_id IS NULL THEN 'despesa' ELSE 'receita' END AS tipo,
        'mensalidade' AS categoria,
        NULL::text AS descricao,
        p.nome AS pessoa,
        c.valor::float AS valor,
        c.status
       FROM app.cobrancas c
       LEFT JOIN app.pessoas p ON p.id = c.pessoa_id
       WHERE c.tenant_id = $1
       ORDER BY c.criado_em DESC`,
      [appReq.tenantId]
    );

    const csv = toCsv(result.rows, [
      { key: "data", label: "Data" },
      { key: "tipo", label: "Tipo" },
      { key: "categoria", label: "Categoria" },
      { key: "descricao", label: "Descricao" },
      { key: "pessoa", label: "Pessoa" },
      { key: "valor", label: "Valor" },
      { key: "status", label: "Status" }
    ]);

    setCsvHeaders(res, "financeiro.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/cobrancas", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const status = req.query.status ? String(req.query.status) : null;

  try {
    const result = await pool.query(
      `SELECT
        c.*,
        p.nome AS pessoa_nome
       FROM app.cobrancas c
       LEFT JOIN app.pessoas p ON p.id = c.pessoa_id
       WHERE c.tenant_id = $1
         AND ($2::text IS NULL OR c.status = $2)
       ORDER BY c.mes_referencia DESC, c.criado_em DESC`,
      [appReq.tenantId, status]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/cobrancas", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { pessoa_id, mes_referencia, valor, status } = req.body as Record<string, unknown>;

  if (!mes_referencia || valor == null) {
    return res.status(400).json({ error: "mes_referencia e valor sao obrigatorios" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO app.cobrancas (tenant_id, pessoa_id, mes_referencia, valor, status)
       VALUES ($1, $2, $3, $4, COALESCE($5, 'pendente'))
       RETURNING *`,
      [appReq.tenantId, pessoa_id ?? null, mes_referencia, valor, status ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { aluno_id, valor, data, pago } = req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `INSERT INTO app.cobrancas (tenant_id, pessoa_id, mes_referencia, valor, status)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5)
       RETURNING
         id,
         tenant_id,
         pessoa_id,
         valor::float AS valor,
         criado_em,
         criado_em::date::text AS data,
         CASE WHEN status = 'pago' THEN true ELSE false END AS pago,
         CASE WHEN pessoa_id IS NULL THEN 'despesa' ELSE 'receita' END AS tipo,
         'mensalidade' AS categoria,
         NULL::text AS descricao,
         status,
         to_char(mes_referencia, 'YYYY-MM') AS mes_referencia`,
      [appReq.tenantId, aluno_id ?? null, data ?? null, valor, pago ? "pago" : "pendente"]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/cobrancas/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const cobrancaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `SELECT
        c.*,
        p.nome AS pessoa_nome
       FROM app.cobrancas c
       LEFT JOIN app.pessoas p ON p.id = c.pessoa_id
       WHERE c.id = $1 AND c.tenant_id = $2`,
      [cobrancaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Cobranca nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/cobrancas/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const cobrancaId = Number(req.params.id);
  const { pessoa_id, mes_referencia, valor, status } = req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE app.cobrancas
       SET pessoa_id = COALESCE($1, pessoa_id),
           mes_referencia = COALESCE($2, mes_referencia),
           valor = COALESCE($3, valor),
           status = COALESCE($4, status)
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [pessoa_id ?? null, mes_referencia ?? null, valor ?? null, status ?? null, cobrancaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Cobranca nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/:id/pagar", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const cobrancaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `UPDATE app.cobrancas
       SET status = 'pago'
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [cobrancaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Cobranca nao encontrada" });
    }

    res.json({ message: "Cobranca paga" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const cobrancaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.cobrancas
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [cobrancaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Cobranca nao encontrada" });
    }

    res.json({ message: "Cobranca removida" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/resumo", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        COALESCE(SUM(valor) FILTER (WHERE pessoa_id IS NOT NULL AND status = 'pago'), 0)::float AS receitas,
        COALESCE(SUM(valor) FILTER (WHERE pessoa_id IS NULL AND status = 'pago'), 0)::float AS despesas,
        COALESCE(SUM(valor) FILTER (WHERE pessoa_id IS NOT NULL AND status = 'pago'), 0)::float
          - COALESCE(SUM(valor) FILTER (WHERE pessoa_id IS NULL AND status = 'pago'), 0)::float AS saldo,
        COUNT(*) FILTER (WHERE pessoa_id IS NOT NULL AND status = 'pendente')::int AS inadimplentes
       FROM app.cobrancas
       WHERE tenant_id = $1`,
      [appReq.tenantId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/gerar-mensalidades", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { mes, ano } = req.body as Record<string, unknown>;
  const mesNumero = Number(mes);
  const anoNumero = Number(ano);

  try {
    const alunosResult = await pool.query(
      `SELECT p.id
       FROM app.pessoas p
       JOIN app.aluno_profiles ap ON ap.pessoa_id = p.id
       WHERE p.tenant_id = $1 AND p.tipo = 'aluno' AND p.ativo = true`,
      [appReq.tenantId]
    );

    let criadas = 0;
    const referencia = `${anoNumero}-${String(mesNumero).padStart(2, "0")}-01`;

    for (const aluno of alunosResult.rows) {
      await pool.query(
        `INSERT INTO app.cobrancas (tenant_id, pessoa_id, mes_referencia, valor, status)
         VALUES ($1, $2, $3::date, 0, 'pendente')`,
        [appReq.tenantId, aluno.id, referencia]
      );
      criadas += 1;
    }

    res.json({ criadas });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
