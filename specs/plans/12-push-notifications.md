# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Firebase Cloud Messaging push notifications for route events, alerts, and messages.

**Architecture:** A `device_tokens` table stores FCM tokens per user. A notification helper uses Firebase Admin SDK (already installed) to send push messages. Notifications are triggered from the existing event subscriber when route executions start/complete and when chat messages arrive. Clients register tokens via `POST /device-tokens`.

**Tech Stack:** Firebase Admin SDK (already installed v13.1.0), FCM, PostgreSQL

---

## File Structure

### Backend (app-api)

| File | Action | Responsibility |
|------|--------|----------------|
| `services/app-api/src/db/migrations/003_device_tokens.sql` | Create | device_tokens table |
| `services/app-api/src/lib/notifications.ts` | Create | FCM send helper |
| `services/app-api/src/routes/device-tokens.ts` | Create | Register/unregister tokens |
| `services/app-api/src/app.ts` | Modify | Mount device-tokens router |
| `services/app-api/src/events/subscriber.ts` | Modify | Trigger notifications on events |

### Frontend (web)

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/public/firebase-messaging-sw.js` | Create | Service worker for web push |

---

## Chunk 1: Backend Infrastructure

### Task 1: Create device_tokens migration

**Files:**
- Create: `services/app-api/src/db/migrations/003_device_tokens.sql`

- [ ] **Step 1: Create migration**

```sql
-- 003_device_tokens.sql

CREATE TABLE IF NOT EXISTS app.device_tokens (
  id            SERIAL PRIMARY KEY,
  tenant_id     INTEGER NOT NULL,
  pessoa_id     INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  token         TEXT NOT NULL,
  platform      TEXT NOT NULL DEFAULT 'web' CHECK(platform IN ('web', 'android', 'ios')),
  criado_em     TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_unique
  ON app.device_tokens (pessoa_id, token);

CREATE INDEX IF NOT EXISTS idx_device_tokens_tenant
  ON app.device_tokens (tenant_id);
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/db/migrations/003_device_tokens.sql
git commit -m "feat: add device_tokens migration for push notifications"
```

### Task 2: Create notification helper

**Files:**
- Create: `services/app-api/src/lib/notifications.ts`

- [ ] **Step 1: Create helper**

```typescript
// services/app-api/src/lib/notifications.ts
import { getFirebaseAdmin } from "./firebase";
import { pool } from "../db/pool";

interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export async function sendToUser(pessoaId: number, payload: NotificationPayload): Promise<void> {
  const result = await pool.query(
    `SELECT token FROM app.device_tokens WHERE pessoa_id = $1`,
    [pessoaId]
  );

  if (!result.rowCount) return;

  const tokens = result.rows.map((r) => r.token);
  const admin = getFirebaseAdmin();
  if (!admin) return;

  const messaging = admin.messaging();

  const message = {
    notification: { title: payload.title, body: payload.body },
    data: payload.data || {},
    tokens,
  };

  try {
    const response = await messaging.sendEachForMulticast(message);

    // Clean up invalid tokens
    const tokensToRemove: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error?.code === "messaging/registration-token-not-registered") {
        tokensToRemove.push(tokens[idx]);
      }
    });

    if (tokensToRemove.length) {
      await pool.query(
        `DELETE FROM app.device_tokens WHERE pessoa_id = $1 AND token = ANY($2)`,
        [pessoaId, tokensToRemove]
      );
    }
  } catch (error) {
    console.error("FCM send error:", error);
  }
}

export async function sendToTenantRole(
  tenantId: number,
  role: string,
  payload: NotificationPayload
): Promise<void> {
  const result = await pool.query(
    `SELECT DISTINCT dt.token, dt.pessoa_id
     FROM app.device_tokens dt
     JOIN app.pessoas p ON p.id = dt.pessoa_id
     WHERE dt.tenant_id = $1 AND p.tipo = $2`,
    [tenantId, role]
  );

  if (!result.rowCount) return;

  const admin = getFirebaseAdmin();
  if (!admin) return;

  const tokens = result.rows.map((r) => r.token);
  const messaging = admin.messaging();

  try {
    await messaging.sendEachForMulticast({
      notification: { title: payload.title, body: payload.body },
      data: payload.data || {},
      tokens,
    });
  } catch (error) {
    console.error("FCM send error:", error);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/lib/notifications.ts
git commit -m "feat: add FCM notification helper"
```

### Task 3: Create device-tokens route

**Files:**
- Create: `services/app-api/src/routes/device-tokens.ts`

- [ ] **Step 1: Create route**

```typescript
// services/app-api/src/routes/device-tokens.ts
import { Router } from "express";
import { pool } from "../db/pool";
import { requireAppAuth, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();

router.use(requireAppAuth, requireTenantActive);

// Register token
router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { token, platform } = req.body as { token?: string; platform?: string };

  if (!token) {
    return res.status(400).json({ error: "token e obrigatorio" });
  }

  try {
    await pool.query(
      `INSERT INTO app.device_tokens (tenant_id, pessoa_id, token, platform)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (pessoa_id, token) DO UPDATE SET atualizado_em = NOW()`,
      [appReq.tenantId, appReq.userId, token, platform || "web"]
    );
    res.status(201).json({ message: "Token registrado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// Unregister token
router.delete("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { token } = req.body as { token?: string };

  if (!token) {
    return res.status(400).json({ error: "token e obrigatorio" });
  }

  try {
    await pool.query(
      `DELETE FROM app.device_tokens WHERE pessoa_id = $1 AND token = $2`,
      [appReq.userId, token]
    );
    res.json({ message: "Token removido" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
```

- [ ] **Step 2: Mount in app.ts**

Add to `services/app-api/src/app.ts`:

```typescript
import deviceTokensRouter from "./routes/device-tokens";
// ...
app.use("/device-tokens", deviceTokensRouter);
```

- [ ] **Step 3: Build to verify**

```bash
cd services/app-api && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add services/app-api/src/routes/device-tokens.ts services/app-api/src/app.ts
git commit -m "feat: add device-tokens registration route"
```

---

## Chunk 2: Notification Triggers + Web Push

### Task 4: Integrate notifications into event subscriber

**Files:**
- Modify: `services/app-api/src/events/subscriber.ts`

- [ ] **Step 1: Add notification triggers**

Import the notification helper and add cases for key events:

```typescript
import { sendToUser, sendToTenantRole } from "../lib/notifications";
```

In the event handler switch/if chain, add:

For `execution.started`:
```typescript
await sendToTenantRole(event.tenantId, "gestor", {
  title: "Rota iniciada",
  body: `Motorista iniciou a rota ${event.payload.rota_nome || ""}`.trim(),
  data: { type: "execution.started", rota_id: String(event.payload.rota_id || "") },
});
```

For `execution.completed`:
```typescript
await sendToTenantRole(event.tenantId, "gestor", {
  title: "Rota concluida",
  body: `Rota finalizada: ${event.payload.alunos_embarcados || 0} embarcados`,
  data: { type: "execution.completed", rota_id: String(event.payload.rota_id || "") },
});
```

For chat messages (in the Socket.IO handler or messaging route, after saving message):
```typescript
await sendToUser(destinatario_id, {
  title: `Mensagem de ${remetente_nome}`,
  body: conteudo.substring(0, 100),
  data: { type: "chat.message", remetente_id: String(remetente_id) },
});
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/events/subscriber.ts
git commit -m "feat: trigger push notifications on route events and messages"
```

### Task 5: Create web push service worker

**Files:**
- Create: `apps/web/public/firebase-messaging-sw.js`

- [ ] **Step 1: Create service worker**

```javascript
// apps/web/public/firebase-messaging-sw.js
// Firebase Cloud Messaging service worker for web push notifications

importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "PLACEHOLDER",
  projectId: "PLACEHOLDER",
  messagingSenderId: "PLACEHOLDER",
  appId: "PLACEHOLDER",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body: body || "",
      icon: "/icon-192.png",
    });
  }
});
```

Note: The PLACEHOLDER values must be replaced with actual Firebase config before deployment. These are safe to include in client-side code (they are not secrets).

- [ ] **Step 2: Commit**

```bash
git add apps/web/public/firebase-messaging-sw.js
git commit -m "feat: add Firebase messaging service worker for web push"
```
