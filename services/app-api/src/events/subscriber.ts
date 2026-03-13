import type { EventEnvelope } from "@rotavans/shared";

import { pool } from "../db/pool";
import { sendToTenantRole } from "../lib/notifications";
import { getRedis } from "../redis/client";

async function isProcessed(eventId: string) {
  const result = await pool.query(`SELECT 1 FROM app.inbox_events WHERE event_id = $1`, [eventId]);
  return Boolean(result.rowCount);
}

async function markReceived(eventId: string, eventType: string) {
  await pool.query(
    `INSERT INTO app.inbox_events (event_id, event_type, status)
     VALUES ($1, $2, 'received')
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType]
  );
}

async function markProcessed(eventId: string) {
  await pool.query(
    `UPDATE app.inbox_events
     SET processed_at = NOW(),
         status = 'processed'
     WHERE event_id = $1`,
    [eventId]
  );
}

async function projectTenantActive(tenantId: number, active: boolean) {
  await getRedis().set(`tenant:${tenantId}:active`, String(active));
}

async function projectModuleState(tenantId: number, slug: string, enabled: boolean) {
  const redis = getRedis();
  await redis.set(`module:${tenantId}:${slug}`, String(enabled), "EX", 300);

  const modules = await pool.query(
    `SELECT m.slug
     FROM management.tenant_modules tm
     JOIN management.modules m ON m.id = tm.module_id
     WHERE tm.tenant_id = $1
       AND tm.habilitado = true
     ORDER BY m.slug`,
    [tenantId]
  );

  await redis.set(
    `modules:${tenantId}`,
    JSON.stringify(modules.rows.map((row) => row.slug)),
    "EX",
    300
  );
}

async function projectLicense(tenantId: number, license: Record<string, unknown>) {
  await getRedis().set(`license:${tenantId}`, JSON.stringify(license), "EX", 300);
}

export function startAppSubscriber() {
  const subscriber = getRedis().duplicate();
  subscriber.subscribe(
    "tenant.created",
    "tenant.deactivated",
    "tenant.module.enabled",
    "tenant.module.disabled",
    "license.updated",
    "execution.started",
    "execution.completed"
  );

  subscriber.on("message", (channel, rawMessage) => {
    void (async () => {
      const envelope = JSON.parse(rawMessage) as EventEnvelope<any>;

      if (await isProcessed(envelope.event_id)) {
        return;
      }

      await markReceived(envelope.event_id, envelope.event_type);

      switch (channel) {
        case "tenant.created":
          await projectTenantActive(envelope.payload.tenant_id, true);
          break;
        case "tenant.deactivated":
          await projectTenantActive(envelope.payload.tenant_id, false);
          break;
        case "tenant.module.enabled":
          await projectModuleState(envelope.payload.tenant_id, envelope.payload.module_slug, true);
          break;
        case "tenant.module.disabled":
          await projectModuleState(envelope.payload.tenant_id, envelope.payload.module_slug, false);
          break;
        case "license.updated":
          await projectLicense(envelope.payload.tenant_id, envelope.payload.effective_license);
          break;
        case "execution.started":
          await sendToTenantRole(envelope.payload.tenant_id, "gestor", {
            title: "Rota iniciada",
            body: `Motorista iniciou a rota ${String(envelope.payload.route_id)}`,
            data: {
              type: "execution.started",
              rota_id: String(envelope.payload.route_id)
            }
          }).catch((error) => {
            console.error("Push execution.started failed", error);
          });
          break;
        case "execution.completed":
          await sendToTenantRole(envelope.payload.tenant_id, "gestor", {
            title: "Rota concluida",
            body: `Rota finalizada: ${String(envelope.payload.stats?.completed_stops ?? 0)} embarcados`,
            data: {
              type: "execution.completed",
              rota_id: String(envelope.payload.route_id)
            }
          }).catch((error) => {
            console.error("Push execution.completed failed", error);
          });
          break;
      }

      await markProcessed(envelope.event_id);
    })().catch((error) => {
      console.error("[app-api] subscriber failed", error);
    });
  });
}
