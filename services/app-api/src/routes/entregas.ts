import { Router } from "express";

import { pool } from "../db/pool";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("entregas"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        p.*,
        ep.id AS profile_id,
        ep.empresa,
        ep.tipo_carga,
        ep.peso_max_kg,
        ep.instrucoes,
        ep.contato_recebedor,
        ep.criado_em AS profile_criado_em
       FROM app.pessoas p
       JOIN app.entrega_profiles ep ON ep.pessoa_id = p.id
       WHERE p.tenant_id = $1
         AND p.tipo = 'cliente_entrega'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );

    res.json(
      result.rows.map((row) => ({
        ...row,
        profile: {
          id: row.profile_id,
          pessoa_id: row.id,
          empresa: row.empresa,
          tipo_carga: row.tipo_carga,
          peso_max_kg: row.peso_max_kg,
          instrucoes: row.instrucoes,
          contato_recebedor: row.contato_recebedor,
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
    telefone,
    endereco,
    lat,
    lng,
    empresa,
    tipo_carga,
    peso_max_kg,
    instrucoes,
    contato_recebedor
  } = req.body as Record<string, unknown>;

  if (!nome) {
    return res.status(400).json({ error: "nome e obrigatorio" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const pessoaResult = await client.query(
      `INSERT INTO app.pessoas (tenant_id, tipo, nome, telefone, endereco, lat, lng)
       VALUES ($1, 'cliente_entrega', $2, $3, $4, $5, $6)
       RETURNING *`,
      [appReq.tenantId, nome, telefone ?? null, endereco ?? null, lat ?? null, lng ?? null]
    );

    const pessoa = pessoaResult.rows[0];
    const profileResult = await client.query(
      `INSERT INTO app.entrega_profiles
        (pessoa_id, empresa, tipo_carga, peso_max_kg, instrucoes, contato_recebedor)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        pessoa.id,
        empresa ?? null,
        tipo_carga ?? null,
        peso_max_kg ?? null,
        instrucoes ?? null,
        contato_recebedor ?? null
      ]
    );

    await client.query("COMMIT");
    res.status(201).json({ ...pessoa, profile: profileResult.rows[0] });
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
  const entregaId = Number(req.params.id);
  const {
    nome,
    telefone,
    endereco,
    lat,
    lng,
    ativo,
    empresa,
    tipo_carga,
    peso_max_kg,
    instrucoes,
    contato_recebedor
  } = req.body as Record<string, unknown>;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const pessoaResult = await client.query(
      `UPDATE app.pessoas
       SET nome = COALESCE($1, nome),
           telefone = COALESCE($2, telefone),
           endereco = COALESCE($3, endereco),
           lat = COALESCE($4, lat),
           lng = COALESCE($5, lng),
           ativo = COALESCE($6, ativo),
           atualizado_em = NOW()
       WHERE id = $7
         AND tenant_id = $8
         AND tipo = 'cliente_entrega'
       RETURNING *`,
      [
        nome ?? null,
        telefone ?? null,
        endereco ?? null,
        lat ?? null,
        lng ?? null,
        ativo ?? null,
        entregaId,
        appReq.tenantId
      ]
    );

    if (!pessoaResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nao encontrado" });
    }

    const profileResult = await client.query(
      `UPDATE app.entrega_profiles
       SET empresa = COALESCE($1, empresa),
           tipo_carga = COALESCE($2, tipo_carga),
           peso_max_kg = COALESCE($3, peso_max_kg),
           instrucoes = COALESCE($4, instrucoes),
           contato_recebedor = COALESCE($5, contato_recebedor)
       WHERE pessoa_id = $6
       RETURNING *`,
      [
        empresa ?? null,
        tipo_carga ?? null,
        peso_max_kg ?? null,
        instrucoes ?? null,
        contato_recebedor ?? null,
        entregaId
      ]
    );

    await client.query("COMMIT");
    res.json({ ...pessoaResult.rows[0], profile: profileResult.rows[0] });
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
  const entregaId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.pessoas
       WHERE id = $1
         AND tenant_id = $2
         AND tipo = 'cliente_entrega'
       RETURNING id`,
      [entregaId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Nao encontrado" });
    }

    res.json({ message: "Removido" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
