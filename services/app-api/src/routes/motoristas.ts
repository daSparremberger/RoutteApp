import { Router } from "express";

import { pool } from "../db/pool";
import { setCsvHeaders, toCsv } from "../lib/csv";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("motoristas"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        p.*,
        mp.id AS profile_id,
        mp.cnh,
        mp.categoria_cnh,
        mp.validade_cnh,
        mp.documento_url,
        mp.convite_token,
        mp.convite_expira_em,
        mp.cadastro_completo,
        mp.criado_em AS profile_criado_em
       FROM app.pessoas p
       JOIN app.motorista_profiles mp ON mp.pessoa_id = p.id
       WHERE p.tenant_id = $1
         AND p.tipo = 'motorista'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );

    res.json(
      result.rows.map((row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        firebase_uid: row.firebase_uid,
        tipo: row.tipo,
        nome: row.nome,
        email: row.email,
        telefone: row.telefone,
        documento: row.documento,
        endereco: row.endereco,
        lat: row.lat,
        lng: row.lng,
        foto_url: row.foto_url,
        ativo: row.ativo,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
        profile: {
          id: row.profile_id,
          pessoa_id: row.id,
          cnh: row.cnh,
          categoria_cnh: row.categoria_cnh,
          validade_cnh: row.validade_cnh,
          documento_url: row.documento_url,
          convite_token: row.convite_token,
          convite_expira_em: row.convite_expira_em,
          cadastro_completo: row.cadastro_completo,
          criado_em: row.profile_criado_em
        }
      }))
    );
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
        p.nome,
        p.telefone,
        p.email,
        p.documento,
        mp.cnh,
        mp.categoria_cnh,
        mp.validade_cnh,
        mp.cadastro_completo
       FROM app.pessoas p
       JOIN app.motorista_profiles mp ON mp.pessoa_id = p.id
       WHERE p.tenant_id = $1
         AND p.tipo = 'motorista'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );

    const csv = toCsv(result.rows, [
      { key: "nome", label: "Nome" },
      { key: "telefone", label: "Telefone" },
      { key: "email", label: "Email" },
      { key: "documento", label: "Documento" },
      { key: "cnh", label: "CNH" },
      { key: "categoria_cnh", label: "Categoria" },
      { key: "validade_cnh", label: "Validade CNH" },
      { key: "cadastro_completo", label: "Cadastro Completo" }
    ]);

    setCsvHeaders(res, "motoristas.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const {
    nome,
    email,
    telefone,
    documento,
    endereco,
    lat,
    lng,
    foto_url,
    cnh,
    categoria_cnh,
    validade_cnh,
    documento_url
  } = req.body as Record<string, unknown>;

  if (!nome) {
    return res.status(400).json({ error: "nome e obrigatorio" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pessoaResult = await client.query(
      `INSERT INTO app.pessoas
        (tenant_id, tipo, nome, email, telefone, documento, endereco, lat, lng, foto_url)
       VALUES ($1, 'motorista', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        appReq.tenantId,
        nome,
        email ?? null,
        telefone ?? null,
        documento ?? null,
        endereco ?? null,
        lat ?? null,
        lng ?? null,
        foto_url ?? null
      ]
    );

    const pessoa = pessoaResult.rows[0];
    const inviteToken = crypto.randomUUID();

    const profileResult = await client.query(
      `INSERT INTO app.motorista_profiles
        (pessoa_id, cnh, categoria_cnh, validade_cnh, documento_url, convite_token, convite_expira_em, cadastro_completo)
       VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '7 days', false)
       RETURNING *`,
      [
        pessoa.id,
        cnh ?? null,
        categoria_cnh ?? null,
        validade_cnh ?? null,
        documento_url ?? null,
        inviteToken
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...pessoa,
      profile: profileResult.rows[0],
      convite_url: `/convite/${inviteToken}`
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const motoristaId = Number(req.params.id);
  const {
    nome,
    email,
    telefone,
    documento,
    endereco,
    lat,
    lng,
    foto_url,
    ativo,
    cnh,
    categoria_cnh,
    validade_cnh,
    documento_url
  } = req.body as Record<string, unknown>;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pessoaResult = await client.query(
      `UPDATE app.pessoas
       SET nome = COALESCE($1, nome),
           email = COALESCE($2, email),
           telefone = COALESCE($3, telefone),
           documento = COALESCE($4, documento),
           endereco = COALESCE($5, endereco),
           lat = COALESCE($6, lat),
           lng = COALESCE($7, lng),
           foto_url = COALESCE($8, foto_url),
           ativo = COALESCE($9, ativo),
           atualizado_em = NOW()
       WHERE id = $10
         AND tenant_id = $11
         AND tipo = 'motorista'
       RETURNING *`,
      [
        nome ?? null,
        email ?? null,
        telefone ?? null,
        documento ?? null,
        endereco ?? null,
        lat ?? null,
        lng ?? null,
        foto_url ?? null,
        ativo ?? null,
        motoristaId,
        appReq.tenantId
      ]
    );

    if (!pessoaResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Motorista nao encontrado" });
    }

    const profileResult = await client.query(
      `UPDATE app.motorista_profiles
       SET cnh = COALESCE($1, cnh),
           categoria_cnh = COALESCE($2, categoria_cnh),
           validade_cnh = COALESCE($3, validade_cnh),
           documento_url = COALESCE($4, documento_url)
       WHERE pessoa_id = $5
       RETURNING *`,
      [cnh ?? null, categoria_cnh ?? null, validade_cnh ?? null, documento_url ?? null, motoristaId]
    );

    await client.query("COMMIT");

    res.json({
      ...pessoaResult.rows[0],
      profile: profileResult.rows[0]
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const motoristaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.pessoas
       WHERE id = $1
         AND tenant_id = $2
         AND tipo = 'motorista'
       RETURNING id`,
      [motoristaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Motorista nao encontrado" });
    }

    res.json({ message: "Motorista removido" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/:id/invite", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const motoristaId = Number(req.params.id);
  const token = crypto.randomUUID();

  try {
    const pessoaResult = await pool.query(
      `SELECT id FROM app.pessoas
       WHERE id = $1
         AND tenant_id = $2
         AND tipo = 'motorista'`,
      [motoristaId, appReq.tenantId]
    );

    if (!pessoaResult.rowCount) {
      return res.status(404).json({ error: "Motorista nao encontrado" });
    }

    const result = await pool.query(
      `UPDATE app.motorista_profiles
       SET convite_token = $1,
           convite_expira_em = NOW() + INTERVAL '7 days'
       WHERE pessoa_id = $2
       RETURNING *`,
      [token, motoristaId]
    );

    res.json({
      ...result.rows[0],
      convite_url: `/convite/${token}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/:id/reenviar-convite", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const motoristaId = Number(req.params.id);
  const token = crypto.randomUUID();

  try {
    const pessoaResult = await pool.query(
      `SELECT id FROM app.pessoas
       WHERE id = $1
         AND tenant_id = $2
         AND tipo = 'motorista'`,
      [motoristaId, appReq.tenantId]
    );

    if (!pessoaResult.rowCount) {
      return res.status(404).json({ error: "Motorista nao encontrado" });
    }

    const result = await pool.query(
      `UPDATE app.motorista_profiles
       SET convite_token = $1,
           convite_expira_em = NOW() + INTERVAL '7 days'
       WHERE pessoa_id = $2
       RETURNING *`,
      [token, motoristaId]
    );

    res.json({
      ...result.rows[0],
      convite_url: `/convite/${token}`
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id/stats", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const motoristaId = Number(req.params.id);

  try {
    const [motoristaResult, statsResult, recentRoutesResult] = await Promise.all([
      pool.query(
        `SELECT
          p.*,
          mp.cadastro_completo
         FROM app.pessoas p
         JOIN app.motorista_profiles mp ON mp.pessoa_id = p.id
         WHERE p.id = $1
           AND p.tenant_id = $2
           AND p.tipo = 'motorista'`,
        [motoristaId, appReq.tenantId]
      ),
      pool.query(
        `SELECT
          COUNT(DISTINCT data_execucao)::int AS dias_trabalhados,
          COUNT(*)::int AS total_rotas,
          COALESCE(SUM(alunos_embarcados), 0)::int AS total_alunos,
          COALESCE(SUM(km_total), 0)::float AS total_km
         FROM app.historico
         WHERE tenant_id = $1
           AND motorista_id = $2`,
        [appReq.tenantId, motoristaId]
      ),
      pool.query(
        `SELECT *
         FROM app.historico
         WHERE tenant_id = $1
           AND motorista_id = $2
         ORDER BY data_execucao DESC, criado_em DESC
         LIMIT 10`,
        [appReq.tenantId, motoristaId]
      )
    ]);

    if (!motoristaResult.rowCount) {
      return res.status(404).json({ error: "Motorista nao encontrado" });
    }

    res.json({
      motorista: motoristaResult.rows[0],
      stats: statsResult.rows[0],
      recent_routes: recentRoutesResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
