import { Router } from "express";
import type { PoolClient } from "pg";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { appendOutboxEvent } from "../lib/outbox";

const router = Router();

router.use(requireSuperAdmin);

async function validateModuleDeps(
  client: PoolClient,
  slugs: string[]
): Promise<{ error: string; details: unknown } | null> {
  const modulesResult = await client.query(
    `SELECT id, slug FROM management.modules WHERE slug = ANY($1::text[]) AND ativo = true`,
    [slugs]
  );

  const foundSlugs = modulesResult.rows.map((r: any) => r.slug);
  const unknown = slugs.filter((s) => !foundSlugs.includes(s));
  if (unknown.length) {
    return { error: "Modulos desconhecidos", details: { unknown } };
  }

  for (const mod of modulesResult.rows) {
    const requiredDeps = await client.query(
      `SELECT dep.slug
       FROM management.module_dependencies md
       JOIN management.modules dep ON dep.id = md.depends_on_module_id
       WHERE md.module_id = $1 AND md.tipo = 'required'`,
      [mod.id]
    );

    const missingRequired = requiredDeps.rows
      .filter((d: any) => !slugs.includes(d.slug))
      .map((d: any) => d.slug);

    if (missingRequired.length) {
      return {
        error: `Modulo '${mod.slug}' requer: ${missingRequired.join(", ")}`,
        details: { module: mod.slug, missing_required: missingRequired },
      };
    }

    const groupDeps = await client.query(
      `SELECT md.grupo, array_agg(dep.slug ORDER BY dep.slug) AS options
       FROM management.module_dependencies md
       JOIN management.modules dep ON dep.id = md.depends_on_module_id
       WHERE md.module_id = $1 AND md.tipo = 'one_of_group'
       GROUP BY md.grupo`,
      [mod.id]
    );

    for (const group of groupDeps.rows) {
      const hasOne = group.options.some((opt: string) => slugs.includes(opt));
      if (!hasOne) {
        return {
          error: `Modulo '${mod.slug}' requer pelo menos um de grupo '${group.grupo}': ${group.options.join(", ")}`,
          details: { module: mod.slug, missing_group: group.grupo, options: group.options },
        };
      }
    }
  }

  return null;
}

async function syncContractToTenant(
  client: PoolClient,
  tenantId: number,
  contract: { max_veiculos: number; max_motoristas: number; max_gestores: number; modulos_incluidos: string[] }
) {
  await client.query(
    `UPDATE management.licenses
     SET max_veiculos = $1, max_motoristas = $2, max_gestores = $3
     WHERE tenant_id = $4 AND ativo = true`,
    [contract.max_veiculos, contract.max_motoristas, contract.max_gestores, tenantId]
  );

  await appendOutboxEvent(client, {
    eventType: "license.updated",
    aggregateType: "license",
    aggregateId: tenantId,
    tenantId,
    payload: {
      tenant_id: tenantId,
      effective_license: {
        max_vehicles: contract.max_veiculos,
        max_drivers: contract.max_motoristas,
        max_devices: contract.max_gestores,
      },
    },
  });

  const allModules = await client.query(
    `SELECT m.id, m.slug, COALESCE(tm.habilitado, false) AS habilitado
     FROM management.modules m
     LEFT JOIN management.tenant_modules tm ON tm.module_id = m.id AND tm.tenant_id = $1
     WHERE m.ativo = true`,
    [tenantId]
  );

  for (const mod of allModules.rows) {
    const shouldBeEnabled = contract.modulos_incluidos.includes(mod.slug);
    const isEnabled = mod.habilitado;

    if (shouldBeEnabled === isEnabled) continue;

    await client.query(
      `INSERT INTO management.tenant_modules (tenant_id, module_id, habilitado, habilitado_em, desabilitado_em)
       VALUES ($1, $2, $3,
         CASE WHEN $3 = true THEN NOW() ELSE NULL END,
         CASE WHEN $3 = false THEN NOW() ELSE NULL END)
       ON CONFLICT (tenant_id, module_id)
       DO UPDATE SET habilitado = $3,
         habilitado_em = CASE WHEN $3 = true THEN NOW() ELSE management.tenant_modules.habilitado_em END,
         desabilitado_em = CASE WHEN $3 = false THEN NOW() ELSE NULL END`,
      [tenantId, mod.id, shouldBeEnabled]
    );

    await appendOutboxEvent(client, {
      eventType: shouldBeEnabled ? "tenant.module.enabled" : "tenant.module.disabled",
      aggregateType: "tenant_module",
      aggregateId: mod.id,
      tenantId,
      payload: { tenant_id: tenantId, module_slug: mod.slug },
    });
  }
}

router.get("/organizations/:orgId/contracts", async (req, res) => {
  const orgId = Number(req.params.orgId);

  try {
    const result = await pool.query(
      `SELECT * FROM management.contracts WHERE organization_id = $1 ORDER BY criado_em DESC`,
      [orgId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/organizations/:orgId/contracts", async (req, res) => {
  const orgId = Number(req.params.orgId);
  const { valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, observacoes } =
    req.body as Record<string, unknown>;

  if (valor_mensal == null || !modulos_incluidos || max_veiculos == null || max_motoristas == null || max_gestores == null || !data_inicio) {
    return res.status(400).json({ error: "valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio sao obrigatorios" });
  }

  const slugs = modulos_incluidos as string[];
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const org = await client.query(
      `SELECT tenant_id FROM management.organizations WHERE id = $1 AND ativo = true`,
      [orgId]
    );

    if (!org.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Organizacao nao encontrada ou inativa" });
    }

    const tenantId = org.rows[0].tenant_id;

    const depError = await validateModuleDeps(client, slugs);
    if (depError) {
      await client.query("ROLLBACK");
      return res.status(400).json(depError);
    }

    const result = await client.query(
      `INSERT INTO management.contracts
        (organization_id, valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orgId, valor_mensal, slugs, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim ?? null, observacoes ?? null]
    );

    const contract = result.rows[0];

    await syncContractToTenant(client, tenantId, {
      max_veiculos: contract.max_veiculos,
      max_motoristas: contract.max_motoristas,
      max_gestores: contract.max_gestores,
      modulos_incluidos: contract.modulos_incluidos,
    });

    await client.query("COMMIT");
    res.status(201).json(contract);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error.code === "23505" && error.constraint === "contracts_active_unique") {
      return res.status(409).json({ error: "Organizacao ja possui contrato ativo" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.put("/contracts/:id", async (req, res) => {
  const contractId = Number(req.params.id);
  const { valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, observacoes } =
    req.body as Record<string, unknown>;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT c.*, o.tenant_id
       FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE c.id = $1 AND c.status = 'ativo'`,
      [contractId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Contrato ativo nao encontrado" });
    }

    const tenantId = existing.rows[0].tenant_id;
    const newSlugs = (modulos_incluidos as string[] | undefined) ?? existing.rows[0].modulos_incluidos;

    if (modulos_incluidos) {
      const depError = await validateModuleDeps(client, newSlugs);
      if (depError) {
        await client.query("ROLLBACK");
        return res.status(400).json(depError);
      }
    }

    const newDataFim = "data_fim" in req.body ? (data_fim ?? null) : existing.rows[0].data_fim;

    const result = await client.query(
      `UPDATE management.contracts
       SET valor_mensal = COALESCE($1, valor_mensal),
           modulos_incluidos = COALESCE($2, modulos_incluidos),
           max_veiculos = COALESCE($3, max_veiculos),
           max_motoristas = COALESCE($4, max_motoristas),
           max_gestores = COALESCE($5, max_gestores),
           data_inicio = COALESCE($6, data_inicio),
           data_fim = $7,
           observacoes = COALESCE($8, observacoes),
           atualizado_em = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        valor_mensal ?? null,
        modulos_incluidos ? newSlugs : null,
        max_veiculos ?? null,
        max_motoristas ?? null,
        max_gestores ?? null,
        data_inicio ?? null,
        newDataFim,
        observacoes ?? null,
        contractId,
      ]
    );

    const contract = result.rows[0];

    await syncContractToTenant(client, tenantId, {
      max_veiculos: contract.max_veiculos,
      max_motoristas: contract.max_motoristas,
      max_gestores: contract.max_gestores,
      modulos_incluidos: contract.modulos_incluidos,
    });

    await client.query("COMMIT");
    res.json(contract);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.patch("/contracts/:id/status", async (req, res) => {
  const contractId = Number(req.params.id);
  const { status } = req.body as { status?: string };

  if (!status || !["suspenso", "encerrado", "ativo"].includes(status)) {
    return res.status(400).json({ error: "status deve ser 'ativo', 'suspenso' ou 'encerrado'" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT c.status, c.organization_id, o.tenant_id
       FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE c.id = $1`,
      [contractId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Contrato nao encontrado" });
    }

    const current = existing.rows[0].status;
    const tenantId = existing.rows[0].tenant_id;

    const validTransitions: Record<string, string[]> = {
      ativo: ["suspenso", "encerrado"],
      suspenso: ["ativo", "encerrado"],
    };

    if (!validTransitions[current]?.includes(status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Transicao invalida: ${current} -> ${status}` });
    }

    await client.query(
      `UPDATE management.contracts SET status = $1, atualizado_em = NOW() WHERE id = $2`,
      [status, contractId]
    );

    if (status === "suspenso" || status === "encerrado") {
      await client.query(
        `UPDATE management.tenants SET ativo = false, atualizado_em = NOW() WHERE id = $1`,
        [tenantId]
      );

      await appendOutboxEvent(client, {
        eventType: "tenant.deactivated",
        aggregateType: "tenant",
        aggregateId: tenantId,
        tenantId,
        payload: { tenant_id: tenantId, reason: `contrato ${status}` },
      });
    } else if (status === "ativo") {
      await client.query(
        `UPDATE management.tenants SET ativo = true, atualizado_em = NOW() WHERE id = $1`,
        [tenantId]
      );

      const contract = await client.query(
        `SELECT * FROM management.contracts WHERE id = $1`,
        [contractId]
      );

      await syncContractToTenant(client, tenantId, {
        max_veiculos: contract.rows[0].max_veiculos,
        max_motoristas: contract.rows[0].max_motoristas,
        max_gestores: contract.rows[0].max_gestores,
        modulos_incluidos: contract.rows[0].modulos_incluidos,
      });
    }

    await client.query("COMMIT");

    const updated = await pool.query(`SELECT * FROM management.contracts WHERE id = $1`, [contractId]);
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

export default router;
