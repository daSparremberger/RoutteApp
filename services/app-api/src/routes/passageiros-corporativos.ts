import { Router } from "express";

import { pool } from "../db/pool";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("passageiros_corporativos"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT
        p.*,
        pc.id AS profile_id,
        pc.empresa,
        pc.cargo,
        pc.centro_custo,
        pc.horario_entrada,
        pc.horario_saida,
        pc.criado_em AS profile_criado_em
       FROM app.pessoas p
       JOIN app.passageiro_corp_profiles pc ON pc.pessoa_id = p.id
       WHERE p.tenant_id = $1
         AND p.tipo = 'passageiro_corp'
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
          cargo: row.cargo,
          centro_custo: row.centro_custo,
          horario_entrada: row.horario_entrada,
          horario_saida: row.horario_saida,
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
    email,
    endereco,
    lat,
    lng,
    empresa,
    cargo,
    centro_custo,
    horario_entrada,
    horario_saida
  } = req.body as Record<string, unknown>;

  if (!nome) {
    return res.status(400).json({ error: "nome e obrigatorio" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const pessoaResult = await client.query(
      `INSERT INTO app.pessoas (tenant_id, tipo, nome, telefone, email, endereco, lat, lng)
       VALUES ($1, 'passageiro_corp', $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        appReq.tenantId,
        nome,
        telefone ?? null,
        email ?? null,
        endereco ?? null,
        lat ?? null,
        lng ?? null
      ]
    );

    const pessoa = pessoaResult.rows[0];
    const profileResult = await client.query(
      `INSERT INTO app.passageiro_corp_profiles
        (pessoa_id, empresa, cargo, centro_custo, horario_entrada, horario_saida)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        pessoa.id,
        empresa ?? null,
        cargo ?? null,
        centro_custo ?? null,
        horario_entrada ?? null,
        horario_saida ?? null
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
  const passageiroId = Number(req.params.id);
  const {
    nome,
    telefone,
    email,
    endereco,
    lat,
    lng,
    ativo,
    empresa,
    cargo,
    centro_custo,
    horario_entrada,
    horario_saida
  } = req.body as Record<string, unknown>;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const pessoaResult = await client.query(
      `UPDATE app.pessoas
       SET nome = COALESCE($1, nome),
           telefone = COALESCE($2, telefone),
           email = COALESCE($3, email),
           endereco = COALESCE($4, endereco),
           lat = COALESCE($5, lat),
           lng = COALESCE($6, lng),
           ativo = COALESCE($7, ativo),
           atualizado_em = NOW()
       WHERE id = $8
         AND tenant_id = $9
         AND tipo = 'passageiro_corp'
       RETURNING *`,
      [
        nome ?? null,
        telefone ?? null,
        email ?? null,
        endereco ?? null,
        lat ?? null,
        lng ?? null,
        ativo ?? null,
        passageiroId,
        appReq.tenantId
      ]
    );

    if (!pessoaResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Nao encontrado" });
    }

    const profileResult = await client.query(
      `UPDATE app.passageiro_corp_profiles
       SET empresa = COALESCE($1, empresa),
           cargo = COALESCE($2, cargo),
           centro_custo = COALESCE($3, centro_custo),
           horario_entrada = COALESCE($4, horario_entrada),
           horario_saida = COALESCE($5, horario_saida)
       WHERE pessoa_id = $6
       RETURNING *`,
      [
        empresa ?? null,
        cargo ?? null,
        centro_custo ?? null,
        horario_entrada ?? null,
        horario_saida ?? null,
        passageiroId
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
  const passageiroId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.pessoas
       WHERE id = $1
         AND tenant_id = $2
         AND tipo = 'passageiro_corp'
       RETURNING id`,
      [passageiroId, appReq.tenantId]
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
