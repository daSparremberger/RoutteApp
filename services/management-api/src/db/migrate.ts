import fs from "fs";
import path from "path";

import { pool } from "./pool";

const migrationsDir = path.join(__dirname, "migrations");

export async function runMigrations() {
  const client = await pool.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS management");
    await client.query(`
      CREATE TABLE IF NOT EXISTS management.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    if (!fs.existsSync(migrationsDir)) {
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const existing = await client.query(
        "SELECT 1 FROM management.schema_migrations WHERE filename = $1",
        [file]
      );

      if (existing.rowCount) {
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
      await client.query(sql);
      await client.query(
        "INSERT INTO management.schema_migrations (filename) VALUES ($1)",
        [file]
      );
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
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
