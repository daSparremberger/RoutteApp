import { Router } from "express";

import { pool } from "../db/pool";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive, requireModule("veiculos"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;

  try {
    const result = await pool.query(
      `SELECT *
       FROM app.veiculos
       WHERE tenant_id = $1
       ORDER BY placa`,
      [appReq.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const veiculoId = Number(req.params.id);

  try {
    const [veiculoResult, motoristasResult, rotasResult] = await Promise.all([
      pool.query(
        `SELECT *
         FROM app.veiculos
         WHERE id = $1 AND tenant_id = $2`,
        [veiculoId, appReq.tenantId]
      ),
      pool.query(
        `SELECT
          p.*,
          mp.cadastro_completo,
          vm.motorista_id
         FROM app.veiculo_motorista vm
         JOIN app.pessoas p ON p.id = vm.motorista_id
         JOIN app.motorista_profiles mp ON mp.pessoa_id = p.id
         WHERE vm.veiculo_id = $1
           AND vm.desvinculado_em IS NULL
         ORDER BY p.nome`,
        [veiculoId]
      ),
      pool.query(
        `SELECT
          r.*,
          p.nome AS motorista_nome
         FROM app.rotas r
         LEFT JOIN app.pessoas p ON p.id = r.motorista_id
         WHERE r.veiculo_id = $1
           AND r.tenant_id = $2
         ORDER BY r.nome`,
        [veiculoId, appReq.tenantId]
      )
    ]);

    if (!veiculoResult.rowCount) {
      return res.status(404).json({ error: "Veiculo nao encontrado" });
    }

    res.json({
      ...veiculoResult.rows[0],
      motoristas_habilitados: motoristasResult.rows,
      rotas_vinculadas: rotasResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { placa, modelo, fabricante, ano, capacidade } = req.body as Record<string, unknown>;

  if (!placa) {
    return res.status(400).json({ error: "placa e obrigatoria" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO app.veiculos
        (tenant_id, placa, modelo, fabricante, ano, capacidade)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [appReq.tenantId, placa, modelo ?? null, fabricante ?? null, ano ?? null, capacidade ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    console.error(error);
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Placa ja cadastrada" });
    }
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const veiculoId = Number(req.params.id);
  const { placa, modelo, fabricante, ano, capacidade, ativo } = req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE app.veiculos
       SET placa = COALESCE($1, placa),
           modelo = COALESCE($2, modelo),
           fabricante = COALESCE($3, fabricante),
           ano = COALESCE($4, ano),
           capacidade = COALESCE($5, capacidade),
           ativo = COALESCE($6, ativo),
           atualizado_em = NOW()
       WHERE id = $7 AND tenant_id = $8
       RETURNING *`,
      [placa ?? null, modelo ?? null, fabricante ?? null, ano ?? null, capacidade ?? null, ativo ?? null, veiculoId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Veiculo nao encontrado" });
    }

    res.json(result.rows[0]);
  } catch (error: any) {
    console.error(error);
    if (error?.code === "23505") {
      return res.status(409).json({ error: "Placa ja cadastrada" });
    }
    res.status(500).json({ error: "Erro interno" });
  }
});

router.delete("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const veiculoId = Number(req.params.id);

  try {
    const result = await pool.query(
      `DELETE FROM app.veiculos
       WHERE id = $1 AND tenant_id = $2
       RETURNING id`,
      [veiculoId, appReq.tenantId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Veiculo nao encontrado" });
    }

    res.json({ message: "Veiculo removido" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.get("/:id/rotas", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const veiculoId = Number(req.params.id);

  try {
    const result = await pool.query(
      `SELECT id, nome, turno, ativo, criado_em, atualizado_em
       FROM app.rotas
       WHERE veiculo_id = $1 AND tenant_id = $2
       ORDER BY nome`,
      [veiculoId, appReq.tenantId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/:id/motoristas", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const veiculoId = Number(req.params.id);
  const { motorista_ids } = req.body as { motorista_ids?: number[] };

  if (!Array.isArray(motorista_ids)) {
    return res.status(400).json({ error: "motorista_ids deve ser um array" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const veiculoResult = await client.query(
      `SELECT id FROM app.veiculos WHERE id = $1 AND tenant_id = $2`,
      [veiculoId, appReq.tenantId]
    );

    if (!veiculoResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Veiculo nao encontrado" });
    }

    await client.query(
      `UPDATE app.veiculo_motorista
       SET desvinculado_em = NOW()
       WHERE veiculo_id = $1 AND desvinculado_em IS NULL`,
      [veiculoId]
    );

    for (const motoristaId of motorista_ids) {
      await client.query(
        `INSERT INTO app.veiculo_motorista (veiculo_id, motorista_id)
         VALUES ($1, $2)`,
        [veiculoId, motoristaId]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Motoristas atualizados", total: motorista_ids.length });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

export default router;
