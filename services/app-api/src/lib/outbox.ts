import type { CrossServiceEvent } from "@rotavans/shared";
import type { PoolClient } from "pg";

export async function appendOutboxEvent(
  client: PoolClient,
  input: {
    eventType: CrossServiceEvent;
    aggregateType: string;
    aggregateId: string | number;
    tenantId?: number | null;
    payload: Record<string, unknown>;
  }
) {
  await client.query(
    `INSERT INTO app.outbox_events
      (event_id, event_type, event_version, aggregate_type, aggregate_id, tenant_id, payload)
     VALUES ($1, $2, 1, $3, $4, $5, $6::jsonb)`,
    [
      crypto.randomUUID(),
      input.eventType,
      input.aggregateType,
      String(input.aggregateId),
      input.tenantId ?? null,
      JSON.stringify(input.payload)
    ]
  );
}
