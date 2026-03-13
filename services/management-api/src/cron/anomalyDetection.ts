import cron from "node-cron";

import { pool } from "../db/pool";
import { getRedis } from "../redis/client";

const LOCK_KEY = "cron:anomaly:lock";
const LOCK_TTL_SECONDS = 900;

async function insertAlert(
  tenantId: number,
  tipo: string,
  descricao: string,
  severidade: "info" | "warning" | "critical",
  dados: Record<string, unknown>
) {
  try {
    await pool.query(
      `INSERT INTO management.anomaly_alerts (tenant_id, tipo, descricao, severidade, dados)
       VALUES ($1, $2, $3, $4, $5::jsonb)`,
      [tenantId, tipo, descricao, severidade, JSON.stringify(dados)]
    );
  } catch (error: any) {
    if (error?.code !== "23505") {
      throw error;
    }
  }
}

async function checkDevicesOverLimit(tenantId: number, maxVeiculos: number) {
  const redis = getRedis();
  const today = new Date().toISOString().split("T")[0];
  const count = await redis.scard(`devices:${tenantId}:${today}`);

  if (count > maxVeiculos) {
    await insertAlert(
      tenantId,
      "devices_over_limit",
      `Tenant usando ${count} dispositivos, limite e ${maxVeiculos}`,
      "critical",
      { devices_today: count, max_veiculos: maxVeiculos }
    );
  }
}

async function checkMotoristasOverLimit(tenantId: number, maxMotoristas: number) {
  const result = await pool.query(
    `SELECT COUNT(*)::int AS total
     FROM app.motorista_profiles mp
     JOIN app.pessoas p ON p.id = mp.pessoa_id
     WHERE p.tenant_id = $1
       AND p.tipo = 'motorista'
       AND p.ativo = true`,
    [tenantId]
  );

  const count = result.rows[0]?.total ?? 0;

  if (count > maxMotoristas) {
    await insertAlert(
      tenantId,
      "motoristas_over_limit",
      `Tenant tem ${count} motoristas ativos, limite e ${maxMotoristas}`,
      "critical",
      { motoristas_ativos: count, max_motoristas: maxMotoristas }
    );
  }
}

async function updateVeiculosAtivos(tenantId: number) {
  const redis = getRedis();
  const today = new Date().toISOString().split("T")[0];
  const count = await redis.scard(`active_veiculos:${tenantId}:${today}`);

  await pool.query(
    `INSERT INTO management.tenant_metrics (tenant_id, data, veiculos_ativos)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, data)
     DO UPDATE SET veiculos_ativos = EXCLUDED.veiculos_ativos`,
    [tenantId, today, count]
  );
}

export async function runAnomalyChecks() {
  const redis = getRedis();
  const lock = await redis.set(LOCK_KEY, "1", "EX", LOCK_TTL_SECONDS, "NX");

  if (!lock) {
    return;
  }

  try {
    const tenants = await pool.query(
      `SELECT t.id, l.max_veiculos, l.max_motoristas
       FROM management.tenants t
       JOIN management.licenses l ON l.tenant_id = t.id AND l.ativo = true
       WHERE t.ativo = true`
    );

    for (const tenant of tenants.rows) {
      await Promise.allSettled([
        checkDevicesOverLimit(tenant.id, tenant.max_veiculos),
        checkMotoristasOverLimit(tenant.id, tenant.max_motoristas),
        updateVeiculosAtivos(tenant.id)
      ]);
    }
  } catch (error) {
    console.error("[cron] anomaly detection failed", error);
  }
}

export function startAnomalyCron() {
  cron.schedule("*/15 * * * *", () => {
    void runAnomalyChecks();
  });
}
