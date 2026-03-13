import type { EventEnvelope, EventPayloads } from "@rotavans/shared";

import { pool } from "../db/pool";
import { getRedis } from "../redis/client";

async function isProcessed(eventId: string) {
  const result = await pool.query(
    `SELECT 1 FROM management.inbox_events WHERE event_id = $1`,
    [eventId]
  );
  return Boolean(result.rowCount);
}

async function markReceived(eventId: string, eventType: string) {
  await pool.query(
    `INSERT INTO management.inbox_events (event_id, event_type, status)
     VALUES ($1, $2, 'received')
     ON CONFLICT (event_id) DO NOTHING`,
    [eventId, eventType]
  );
}

async function markProcessed(eventId: string) {
  await pool.query(
    `UPDATE management.inbox_events
     SET processed_at = NOW(),
         status = 'processed'
     WHERE event_id = $1`,
    [eventId]
  );
}

async function handleUserLoggedIn(payload: EventPayloads["user.logged_in"]) {
  const today = new Date().toISOString().split("T")[0];

  await Promise.all([
    pool.query(
      `INSERT INTO management.audit_logs
        (tenant_id, user_firebase_uid, user_role, action, ip, device_id, user_agent)
       VALUES ($1, $2, $3, 'login', $4, $5, $6)`,
      [
        payload.tenant_id,
        payload.firebase_uid ?? null,
        payload.user_type,
        payload.ip ?? null,
        payload.device_id ?? null,
        payload.user_agent ?? null
      ]
    ),
    pool.query(
      `INSERT INTO management.tenant_metrics (tenant_id, data, total_logins)
       VALUES ($1, $2, 1)
       ON CONFLICT (tenant_id, data)
       DO UPDATE SET total_logins = management.tenant_metrics.total_logins + 1`,
      [payload.tenant_id, today]
    )
  ]);
}

async function handleExecutionStarted(payload: EventPayloads["execution.started"]) {
  const today = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO management.tenant_metrics (tenant_id, data, execucoes_iniciadas)
     VALUES ($1, $2, 1)
     ON CONFLICT (tenant_id, data)
     DO UPDATE SET execucoes_iniciadas = management.tenant_metrics.execucoes_iniciadas + 1`,
    [payload.tenant_id, today]
  );
}

async function handleExecutionCompleted(payload: EventPayloads["execution.completed"]) {
  const today = new Date().toISOString().split("T")[0];
  await pool.query(
    `INSERT INTO management.tenant_metrics (tenant_id, data, execucoes_concluidas)
     VALUES ($1, $2, 1)
     ON CONFLICT (tenant_id, data)
     DO UPDATE SET execucoes_concluidas = management.tenant_metrics.execucoes_concluidas + 1`,
    [payload.tenant_id, today]
  );
}

async function handleDeviceBound(payload: EventPayloads["device.bound"]) {
  const today = new Date().toISOString().split("T")[0];
  const redis = getRedis();
  await redis.sadd(`devices:${payload.tenant_id}:${today}`, payload.device_id);
  await redis.expire(`devices:${payload.tenant_id}:${today}`, 48 * 60 * 60);
}

export function startManagementSubscriber() {
  const subscriber = getRedis().duplicate();
  subscriber.subscribe(
    "user.logged_in",
    "execution.started",
    "execution.completed",
    "device.bound",
    "device.unbound"
  );

  subscriber.on("message", (channel, rawMessage) => {
    void (async () => {
      const envelope = JSON.parse(rawMessage) as EventEnvelope<any>;

      if (await isProcessed(envelope.event_id)) {
        return;
      }

      await markReceived(envelope.event_id, envelope.event_type);

      switch (channel) {
        case "user.logged_in":
          await handleUserLoggedIn(envelope.payload);
          break;
        case "execution.started":
          await handleExecutionStarted(envelope.payload);
          break;
        case "execution.completed":
          await handleExecutionCompleted(envelope.payload);
          break;
        case "device.bound":
          await handleDeviceBound(envelope.payload);
          break;
        case "device.unbound":
          break;
      }

      await markProcessed(envelope.event_id);
    })().catch((error) => {
      console.error("[management-api] subscriber failed", error);
    });
  });
}
