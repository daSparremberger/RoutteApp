import dotenv from "dotenv";

import { pool } from "./pool";

dotenv.config();

async function runSeed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existingTenant = await client.query(
      `SELECT id
       FROM management.tenants
       WHERE nome = 'Rotavans Demo'
       ORDER BY id
       LIMIT 1`
    );

    let tenantId = existingTenant.rows[0]?.id as number | undefined;

    if (!tenantId) {
      const tenantResult = await client.query(
        `INSERT INTO management.tenants (nome, cidade, estado, cnpj, email_contato, ativo)
         VALUES ('Rotavans Demo', 'Brasilia', 'DF', '00.000.000/0001-00', 'contato@rotavans.local', true)
         RETURNING id`
      );
      tenantId = tenantResult.rows[0]?.id;
    }

    if (!tenantId) {
      throw new Error("Nao foi possivel obter tenant demo");
    }

    const existingLicense = await client.query(
      `SELECT id
       FROM management.licenses
       WHERE tenant_id = $1
         AND ativo = true
       ORDER BY id
       LIMIT 1`,
      [tenantId]
    );

    if (!existingLicense.rowCount) {
      await client.query(
        `INSERT INTO management.licenses
          (tenant_id, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, ativo)
         VALUES ($1, 25, 25, 5, CURRENT_DATE, CURRENT_DATE + INTERVAL '1 year', true)`,
        [tenantId]
      );
    }

    await client.query(
      `INSERT INTO management.tenant_modules (tenant_id, module_id, habilitado)
       SELECT $1, m.id, true
       FROM management.modules m
       ON CONFLICT (tenant_id, module_id)
       DO UPDATE SET habilitado = true, desabilitado_em = NULL`,
      [tenantId]
    );

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          tenant_id: tenantId,
          tenant_nome: "Rotavans Demo",
          modules_enabled: "all"
        },
        null,
        2
      )
    );
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runSeed()
    .then(async () => {
      await pool.end();
      process.exit(0);
    })
    .catch(async (error) => {
      console.error(error);
      await pool.end();
      process.exit(1);
    });
}
