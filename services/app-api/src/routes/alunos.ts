import { Router } from "express";

import { pool } from "../db/pool";
import { setCsvHeaders, toCsv } from "../lib/csv";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("alunos"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        p.*,
        ap.id AS profile_id,
        ap.escola_id,
        ap.turno,
        ap.cpf_responsavel,
        ap.telefone_responsavel,
        ap.responsavel_id,
        ap.serie,
        ap.necessidades_especiais,
        ap.criado_em AS profile_criado_em
       FROM app.pessoas p
       JOIN app.aluno_profiles ap ON ap.pessoa_id = p.id
       WHERE p.tenant_id = $1
         AND p.tipo = 'aluno'
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
          escola_id: row.escola_id,
          turno: row.turno,
          cpf_responsavel: row.cpf_responsavel,
          telefone_responsavel: row.telefone_responsavel,
          responsavel_id: row.responsavel_id,
          serie: row.serie,
          necessidades_especiais: row.necessidades_especiais,
          criado_em: row.profile_criado_em
        }
      }))
    );
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
    escola_id,
    turno,
    cpf_responsavel,
    telefone_responsavel,
    responsavel_id,
    serie,
    necessidades_especiais
  } = req.body as Record<string, unknown>;

  if (!nome || !endereco) {
    return res.status(400).json({ error: "nome e endereco sao obrigatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pessoaResult = await client.query(
      `INSERT INTO app.pessoas
        (tenant_id, tipo, nome, email, telefone, documento, endereco, lat, lng, foto_url)
       VALUES ($1, 'aluno', $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        appReq.tenantId,
        nome,
        email ?? null,
        telefone ?? null,
        documento ?? null,
        endereco,
        lat ?? null,
        lng ?? null,
        foto_url ?? null
      ]
    );

    const pessoa = pessoaResult.rows[0];

    const profileResult = await client.query(
      `INSERT INTO app.aluno_profiles
        (
          pessoa_id,
          escola_id,
          turno,
          cpf_responsavel,
          telefone_responsavel,
          responsavel_id,
          serie,
          necessidades_especiais
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        pessoa.id,
        escola_id ?? null,
        turno ?? null,
        cpf_responsavel ?? null,
        telefone_responsavel ?? null,
        responsavel_id ?? null,
        serie ?? null,
        necessidades_especiais ?? null
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...pessoa,
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

router.put("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const alunoId = Number(req.params.id);
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
    escola_id,
    turno,
    cpf_responsavel,
    telefone_responsavel,
    responsavel_id,
    serie,
    necessidades_especiais
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
         AND tipo = 'aluno'
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
        alunoId,
        appReq.tenantId
      ]
    );

    if (!pessoaResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Aluno nao encontrado" });
    }

    const profileResult = await client.query(
      `UPDATE app.aluno_profiles
       SET escola_id = COALESCE($1, escola_id),
           turno = COALESCE($2, turno),
           cpf_responsavel = COALESCE($3, cpf_responsavel),
           telefone_responsavel = COALESCE($4, telefone_responsavel),
           responsavel_id = COALESCE($5, responsavel_id),
           serie = COALESCE($6, serie),
           necessidades_especiais = COALESCE($7, necessidades_especiais)
       WHERE pessoa_id = $8
       RETURNING *`,
      [
        escola_id ?? null,
        turno ?? null,
        cpf_responsavel ?? null,
        telefone_responsavel ?? null,
        responsavel_id ?? null,
        serie ?? null,
        necessidades_especiais ?? null,
        alunoId
      ]
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
  const alunoId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.pessoas
       WHERE id = $1
         AND tenant_id = $2
         AND tipo = 'aluno'
       RETURNING id`,
      [alunoId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Aluno nao encontrado" });
    }

    res.json({ message: "Aluno removido" });
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
        p.endereco,
        p.email,
        ps.nome AS escola_nome,
        ap.turno,
        ap.serie,
        ap.cpf_responsavel,
        ap.telefone_responsavel
       FROM app.pessoas p
       JOIN app.aluno_profiles ap ON ap.pessoa_id = p.id
       LEFT JOIN app.pontos_servico ps ON ps.id = ap.escola_id
       WHERE p.tenant_id = $1
         AND p.tipo = 'aluno'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );

    const csv = toCsv(result.rows, [
      { key: "nome", label: "Nome" },
      { key: "telefone", label: "Telefone" },
      { key: "endereco", label: "Endereco" },
      { key: "email", label: "Email" },
      { key: "escola_nome", label: "Escola" },
      { key: "turno", label: "Turno" },
      { key: "serie", label: "Serie" },
      { key: "cpf_responsavel", label: "CPF Responsavel" },
      { key: "telefone_responsavel", label: "Telefone Responsavel" }
    ]);

    setCsvHeaders(res, "alunos.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
