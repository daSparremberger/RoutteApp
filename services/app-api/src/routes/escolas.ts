import { Router } from "express";

import { pool } from "../db/pool";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("escolas"));

async function loadEscolaContatos(escolaId: number) {
  const contatosResult = await pool.query(
    `SELECT id, cargo, nome, telefone, email
     FROM app.escola_contatos
     WHERE escola_id = $1
     ORDER BY id`,
    [escolaId]
  );

  return contatosResult.rows;
}

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        ps.*,
        ep.id AS profile_id,
        ep.turno_manha,
        ep.turno_tarde,
        ep.turno_noite,
        ep.horario_entrada_manha,
        ep.horario_saida_manha,
        ep.horario_entrada_tarde,
        ep.horario_saida_tarde,
        ep.horario_entrada_noite,
        ep.horario_saida_noite,
        ep.criado_em AS profile_criado_em
       FROM app.pontos_servico ps
       JOIN app.escola_profiles ep ON ep.ponto_servico_id = ps.id
       WHERE ps.tenant_id = $1
         AND ps.tipo = 'escola'
       ORDER BY ps.nome`,
      [appReq.tenantId]
    );

    const escolas = await Promise.all(
      result.rows.map(async (row) => ({
        id: row.id,
        tenant_id: row.tenant_id,
        tipo: row.tipo,
        nome: row.nome,
        endereco: row.endereco,
        lat: row.lat,
        lng: row.lng,
        criado_em: row.criado_em,
        atualizado_em: row.atualizado_em,
        profile: {
          id: row.profile_id,
          ponto_servico_id: row.id,
          turno_manha: row.turno_manha,
          turno_tarde: row.turno_tarde,
          turno_noite: row.turno_noite,
          horario_entrada_manha: row.horario_entrada_manha,
          horario_saida_manha: row.horario_saida_manha,
          horario_entrada_tarde: row.horario_entrada_tarde,
          horario_saida_tarde: row.horario_saida_tarde,
          horario_entrada_noite: row.horario_entrada_noite,
          horario_saida_noite: row.horario_saida_noite,
          criado_em: row.profile_criado_em
        },
        turno_manha: row.turno_manha,
        turno_tarde: row.turno_tarde,
        turno_noite: row.turno_noite,
        contatos: await loadEscolaContatos(row.id)
      }))
    );

    res.json(escolas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const escolaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `SELECT
        ps.*,
        ep.id AS profile_id,
        ep.turno_manha,
        ep.turno_tarde,
        ep.turno_noite,
        ep.horario_entrada_manha,
        ep.horario_saida_manha,
        ep.horario_entrada_tarde,
        ep.horario_saida_tarde,
        ep.horario_entrada_noite,
        ep.horario_saida_noite,
        ep.criado_em AS profile_criado_em
       FROM app.pontos_servico ps
       JOIN app.escola_profiles ep ON ep.ponto_servico_id = ps.id
       WHERE ps.id = $1
         AND ps.tenant_id = $2
         AND ps.tipo = 'escola'`,
      [escolaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Escola nao encontrada" });
    }

    const row = result.rows[0];

    res.json({
      id: row.id,
      tenant_id: row.tenant_id,
      tipo: row.tipo,
      nome: row.nome,
      endereco: row.endereco,
      lat: row.lat,
      lng: row.lng,
      criado_em: row.criado_em,
      atualizado_em: row.atualizado_em,
      profile: {
        id: row.profile_id,
        ponto_servico_id: row.id,
        turno_manha: row.turno_manha,
        turno_tarde: row.turno_tarde,
        turno_noite: row.turno_noite,
        horario_entrada_manha: row.horario_entrada_manha,
        horario_saida_manha: row.horario_saida_manha,
        horario_entrada_tarde: row.horario_entrada_tarde,
        horario_saida_tarde: row.horario_saida_tarde,
        horario_entrada_noite: row.horario_entrada_noite,
        horario_saida_noite: row.horario_saida_noite,
        criado_em: row.profile_criado_em
      },
      turno_manha: row.turno_manha,
      turno_tarde: row.turno_tarde,
      turno_noite: row.turno_noite,
      contatos: await loadEscolaContatos(row.id)
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const {
    nome,
    endereco,
    lat,
    lng,
    turno_manha,
    turno_tarde,
    turno_noite,
    horario_entrada_manha,
    horario_saida_manha,
    horario_entrada_tarde,
    horario_saida_tarde,
    horario_entrada_noite,
    horario_saida_noite
  } = req.body as Record<string, unknown>;

  if (!nome || !endereco) {
    return res.status(400).json({ error: "nome e endereco sao obrigatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const baseResult = await client.query(
      `INSERT INTO app.pontos_servico
        (tenant_id, tipo, nome, endereco, lat, lng)
       VALUES ($1, 'escola', $2, $3, $4, $5)
       RETURNING *`,
      [appReq.tenantId, nome, endereco, lat ?? null, lng ?? null]
    );

    const base = baseResult.rows[0];

    const profileResult = await client.query(
      `INSERT INTO app.escola_profiles
        (
          ponto_servico_id,
          turno_manha,
          turno_tarde,
          turno_noite,
          horario_entrada_manha,
          horario_saida_manha,
          horario_entrada_tarde,
          horario_saida_tarde,
          horario_entrada_noite,
          horario_saida_noite
        )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        base.id,
        Boolean(turno_manha),
        Boolean(turno_tarde),
        Boolean(turno_noite),
        horario_entrada_manha ?? null,
        horario_saida_manha ?? null,
        horario_entrada_tarde ?? null,
        horario_saida_tarde ?? null,
        horario_entrada_noite ?? null,
        horario_saida_noite ?? null
      ]
    );

    await client.query("COMMIT");

    res.status(201).json({
      ...base,
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
  const escolaId = Number(req.params.id);
  const {
    nome,
    endereco,
    lat,
    lng,
    turno_manha,
    turno_tarde,
    turno_noite,
    horario_entrada_manha,
    horario_saida_manha,
    horario_entrada_tarde,
    horario_saida_tarde,
    horario_entrada_noite,
    horario_saida_noite
  } = req.body as Record<string, unknown>;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const baseResult = await client.query(
      `UPDATE app.pontos_servico
       SET nome = COALESCE($1, nome),
           endereco = COALESCE($2, endereco),
           lat = COALESCE($3, lat),
           lng = COALESCE($4, lng),
           atualizado_em = NOW()
       WHERE id = $5
         AND tenant_id = $6
         AND tipo = 'escola'
       RETURNING *`,
      [nome ?? null, endereco ?? null, lat ?? null, lng ?? null, escolaId, appReq.tenantId]
    );

    if (!baseResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Escola nao encontrada" });
    }

    const profileResult = await client.query(
      `UPDATE app.escola_profiles
       SET turno_manha = COALESCE($1, turno_manha),
           turno_tarde = COALESCE($2, turno_tarde),
           turno_noite = COALESCE($3, turno_noite),
           horario_entrada_manha = COALESCE($4, horario_entrada_manha),
           horario_saida_manha = COALESCE($5, horario_saida_manha),
           horario_entrada_tarde = COALESCE($6, horario_entrada_tarde),
           horario_saida_tarde = COALESCE($7, horario_saida_tarde),
           horario_entrada_noite = COALESCE($8, horario_entrada_noite),
           horario_saida_noite = COALESCE($9, horario_saida_noite)
       WHERE ponto_servico_id = $10
       RETURNING *`,
      [
        turno_manha ?? null,
        turno_tarde ?? null,
        turno_noite ?? null,
        horario_entrada_manha ?? null,
        horario_saida_manha ?? null,
        horario_entrada_tarde ?? null,
        horario_saida_tarde ?? null,
        horario_entrada_noite ?? null,
        horario_saida_noite ?? null,
        escolaId
      ]
    );

    await client.query("COMMIT");

    res.json({
      ...baseResult.rows[0],
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
  const escolaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.pontos_servico
       WHERE id = $1
         AND tenant_id = $2
         AND tipo = 'escola'
       RETURNING id`,
      [escolaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Escola nao encontrada" });
    }

    res.json({ message: "Escola removida" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/:id/contatos", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const escolaId = Number(req.params.id);
  const { cargo, nome, telefone, email } = req.body as Record<string, unknown>;

  if (!nome) {
    return res.status(400).json({ error: "nome e obrigatorio" });
  }

  try {
    const escolaResult = await pool.query(
      `SELECT id
       FROM app.pontos_servico
       WHERE id = $1 AND tenant_id = $2 AND tipo = 'escola'`,
      [escolaId, appReq.tenantId]
    );

    if (!escolaResult.rowCount) {
      return res.status(404).json({ error: "Escola nao encontrada" });
    }

    const result = await pool.query(
      `INSERT INTO app.escola_contatos (escola_id, cargo, nome, telefone, email)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [escolaId, cargo ?? null, nome, telefone ?? null, email ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/:id/contatos/:contatoId", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const escolaId = Number(req.params.id);
  const contatoId = Number(req.params.contatoId);
  const { cargo, nome, telefone, email } = req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE app.escola_contatos ec
       SET cargo = COALESCE($1, ec.cargo),
           nome = COALESCE($2, ec.nome),
           telefone = COALESCE($3, ec.telefone),
           email = COALESCE($4, ec.email)
       FROM app.pontos_servico ps
       WHERE ec.id = $5
         AND ec.escola_id = $6
         AND ps.id = ec.escola_id
         AND ps.tenant_id = $7
         AND ps.tipo = 'escola'
       RETURNING ec.*`,
      [cargo ?? null, nome ?? null, telefone ?? null, email ?? null, contatoId, escolaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Contato nao encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id/contatos/:contatoId", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const escolaId = Number(req.params.id);
  const contatoId = Number(req.params.contatoId);

  try {
    const result = await pool.query(
      `DELETE FROM app.escola_contatos ec
       USING app.pontos_servico ps
       WHERE ec.id = $1
         AND ec.escola_id = $2
         AND ps.id = ec.escola_id
         AND ps.tenant_id = $3
         AND ps.tipo = 'escola'
       RETURNING ec.id`,
      [contatoId, escolaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Contato nao encontrado" });
    }

    res.json({ message: "Contato removido" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
