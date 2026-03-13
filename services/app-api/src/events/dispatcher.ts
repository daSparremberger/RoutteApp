import type { EventEnvelope } from "@rotavans/shared";

import { pool } from "../db/pool";
import { getRedis } from "../redis/client";

export async function dispatchPendingOutboxEvents() {
  const result = await pool.query(
    `SELECT *
     FROM app.outbox_events
     WHERE published_at IS NULL
     ORDER BY occurred_at ASC
     LIMIT 100`
  );

  if (!result.rowCount) {
    return;
  }

  const redis = getRedis();

  for (const row of result.rows) {
    const envelope: EventEnvelope<Record<string, unknown>> = {
      event_id: row.event_id,
      event_type: row.event_type,
      event_version: row.event_version,
      occurred_at: row.occurred_at.toISOString(),
      producer: "app-api",
      tenant_id: row.tenant_id ?? undefined,
      payload: row.payload
    };

    await redis.publish(row.event_type, JSON.stringify(envelope));
    await pool.query(
      `UPDATE app.outbox_events
       SET published_at = NOW(),
           publish_attempts = publish_attempts + 1
       WHERE id = $1`,
      [row.id]
    );
  }
}

export function startOutboxDispatcher() {
  setInterval(() => {
    void dispatchPendingOutboxEvents().catch((error) => {
      console.error("[app-api] outbox dispatch failed", error);
    });
  }, 2000);
}
