import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { appendOutboxEvent } from "../lib/outbox";

const router = Router();

router.use(requireSuperAdmin);

router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT
        m.id,
        m.slug,
        m.nome,
        m.descricao,
        m.tipo,
        m.ativo,
        COALESCE(
          json_agg(
            json_build_object(
              'depends_on_slug', dm.slug,
              'tipo', md.tipo,
              'grupo', md.grupo
            )
          ) FILTER (WHERE md.id IS NOT NULL),
          '[]'::json
        ) AS dependencies
       FROM management.modules m
       LEFT JOIN management.module_dependencies md ON md.module_id = m.id
       LEFT JOIN management.modules dm ON dm.id = md.depends_on_module_id
       GROUP BY m.id
       ORDER BY m.tipo, m.nome`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.put("/tenants/:id/modules", async (req, res) => {
  const tenantId = Number(req.params.id);
  const { slug, habilitado } = req.body as {
    slug?: string;
    habilitado?: boolean;
  };

  if (!tenantId || !slug || typeof habilitado !== "boolean") {
    return res.status(400).json({ error: "tenant, slug e habilitado sao obrigatorios" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const moduleResult = await client.query(
      `SELECT id, slug, nome FROM management.modules WHERE slug = $1 AND ativo = true`,
      [slug]
    );

    if (!moduleResult.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Modulo nao encontrado" });
    }

    const moduleRow = moduleResult.rows[0];

    if (habilitado) {
      const requiredDeps = await client.query(
        `SELECT dep.slug
         FROM management.module_dependencies md
         JOIN management.modules dep ON dep.id = md.depends_on_module_id
         WHERE md.module_id = $1 AND md.tipo = 'required'`,
        [moduleRow.id]
      );

      const missingRequired: string[] = [];

      for (const dep of requiredDeps.rows) {
        const enabledResult = await client.query(
          `SELECT 1
           FROM management.tenant_modules tm
           JOIN management.modules m ON m.id = tm.module_id
           WHERE tm.tenant_id = $1 AND m.slug = $2 AND tm.habilitado = true`,
          [tenantId, dep.slug]
        );

        if (!enabledResult.rowCount) {
          missingRequired.push(dep.slug);
        }
      }

      const groupedDeps = await client.query(
        `SELECT md.grupo, array_agg(dep.slug ORDER BY dep.slug) AS slugs
         FROM management.module_dependencies md
         JOIN management.modules dep ON dep.id = md.depends_on_module_id
         WHERE md.module_id = $1 AND md.tipo = 'one_of_group'
         GROUP BY md.grupo`,
        [moduleRow.id]
      );

      const missingGroups: Array<{ grupo: string; options: string[] }> = [];

      for (const group of groupedDeps.rows) {
        const enabledGroup = await client.query(
          `SELECT 1
           FROM management.tenant_modules tm
           JOIN management.modules m ON m.id = tm.module_id
           WHERE tm.tenant_id = $1
             AND tm.habilitado = true
             AND m.slug = ANY($2::text[])
           LIMIT 1`,
          [tenantId, group.slugs]
        );

        if (!enabledGroup.rowCount) {
          missingGroups.push({
            grupo: group.grupo,
            options: group.slugs
          });
        }
      }

      if (missingRequired.length || missingGroups.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Dependencias nao satisfeitas",
          missing_required: missingRequired,
          missing_groups: missingGroups
        });
      }
    } else {
      const dependents = await client.query(
        `SELECT m.slug
         FROM management.module_dependencies md
         JOIN management.modules m ON m.id = md.module_id
         JOIN management.tenant_modules tm ON tm.module_id = m.id
         JOIN management.modules dep ON dep.id = md.depends_on_module_id
         WHERE dep.slug = $1
           AND tm.tenant_id = $2
           AND tm.habilitado = true
           AND md.tipo = 'required'`,
        [slug, tenantId]
      );

      if (dependents.rowCount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          error: "Modulo possui dependentes ativos",
          dependents: dependents.rows.map((row) => row.slug)
        });
      }
    }

    const updateResult = await client.query(
      `UPDATE management.tenant_modules
       SET habilitado = $1,
           habilitado_em = CASE WHEN $1 = true THEN NOW() ELSE habilitado_em END,
           desabilitado_em = CASE WHEN $1 = false THEN NOW() ELSE NULL END
       WHERE tenant_id = $2 AND module_id = $3
       RETURNING id, tenant_id, module_id, habilitado, habilitado_em, desabilitado_em`,
      [habilitado, tenantId, moduleRow.id]
    );

    if (!updateResult.rowCount) {
      const inserted = await client.query(
        `INSERT INTO management.tenant_modules (tenant_id, module_id, habilitado, habilitado_em, desabilitado_em)
         VALUES ($1, $2, $3, CASE WHEN $3 = true THEN NOW() ELSE NULL END, CASE WHEN $3 = false THEN NOW() ELSE NULL END)
         RETURNING id, tenant_id, module_id, habilitado, habilitado_em, desabilitado_em`,
        [tenantId, moduleRow.id, habilitado]
      );
      updateResult.rows.push(inserted.rows[0]);
    }

    await appendOutboxEvent(client, {
      eventType: habilitado ? "tenant.module.enabled" : "tenant.module.disabled",
      aggregateType: "tenant_module",
      aggregateId: updateResult.rows[0].id,
      tenantId,
      payload: {
        tenant_id: tenantId,
        module_slug: slug
      }
    });

    await client.query("COMMIT");

    res.json({
      ...updateResult.rows[0],
      slug
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

export default router;
