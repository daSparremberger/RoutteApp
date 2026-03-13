import { pool } from "../db/pool";
import { getFirebaseAdmin } from "./firebase";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function removeInvalidTokens(tokens: string[]) {
  if (!tokens.length) return;

  await pool.query(`DELETE FROM app.device_tokens WHERE token = ANY($1::text[])`, [tokens]);
}

export async function sendToUser(pessoaId: number, payload: NotificationPayload) {
  const result = await pool.query(`SELECT token FROM app.device_tokens WHERE pessoa_id = $1`, [pessoaId]);
  const tokens = result.rows.map((row) => row.token as string);

  if (!tokens.length) return;

  const response = await getFirebaseAdmin().messaging().sendEachForMulticast({
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: payload.data ?? {},
    tokens
  });

  const invalidTokens = response.responses.flatMap((item, index) =>
    !item.success && item.error?.code === "messaging/registration-token-not-registered"
      ? [tokens[index]]
      : []
  );

  await removeInvalidTokens(invalidTokens);
}

export async function sendToTenantRole(
  tenantId: number,
  role: string,
  payload: NotificationPayload
) {
  const result = await pool.query(
    `SELECT DISTINCT dt.token
     FROM app.device_tokens dt
     JOIN app.pessoas p ON p.id = dt.pessoa_id
     WHERE dt.tenant_id = $1
       AND p.tipo = $2`,
    [tenantId, role]
  );

  const tokens = result.rows.map((row) => row.token as string);
  if (!tokens.length) return;

  const response = await getFirebaseAdmin().messaging().sendEachForMulticast({
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: payload.data ?? {},
    tokens
  });

  const invalidTokens = response.responses.flatMap((item, index) =>
    !item.success && item.error?.code === "messaging/registration-token-not-registered"
      ? [tokens[index]]
      : []
  );

  await removeInvalidTokens(invalidTokens);
}
