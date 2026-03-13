import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { appendOutboxEvent } from "../lib/outbox";

const router = Router();

router.use(requireSuperAdmin);

router.put("/tenants/:id/license", async (req, res) => {
  const tenantId = Number(req.params.id);
  const { max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, ativo } =
    req.body as Record<string, unknown>;

  if (!tenantId) {
    return res.status(400).json({ error: "tenant invalido" });
  }

  // Guard: block manual license edit when active contract exists
  try {
    const activeContract = await pool.query(
      `SELECT 1 FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE o.tenant_id = $1 AND c.status = 'ativo'`,
      [tenantId]
    );

    if (activeContract.rowCount) {
      return res.status(409).json({ error: "Licenca controlada por contrato ativo. Atualize o contrato para alterar limites." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE management.licenses
       SET max_veiculos = COALESCE($1, max_veiculos),
           max_motoristas = COALESCE($2, max_motoristas),
           max_gestores = COALESCE($3, max_gestores),
           data_inicio = COALESCE($4, data_inicio),
           data_fim = $5,
           ativo = COALESCE($6, ativo)
       WHERE tenant_id = $7 AND ativo = true
       RETURNING *`,
      [
        max_veiculos ?? null,
        max_motoristas ?? null,
        max_gestores ?? null,
        data_inicio ?? null,
        data_fim ?? null,
        ativo ?? null,
        tenantId
      ]
    );

    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Licenca nao encontrada" });
    }

    const license = result.rows[0];

    await appendOutboxEvent(client, {
      eventType: "license.updated",
      aggregateType: "license",
      aggregateId: license.id,
      tenantId,
      payload: {
        tenant_id: tenantId,
        effective_license: {
          max_vehicles: license.max_veiculos,
          max_drivers: license.max_motoristas
        }
      }
    });

    await client.query("COMMIT");
    res.json(license);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

export default router;
