# Rotavans — Architecture Rewrite Design
**Date:** 2026-03-11
**Status:** Approved
**Scope:** Complete rewrite from scratch — no backward compatibility required

---

## Overview

Rewrite the current monolithic Express API into two independent services within the existing pnpm monorepo. The system manages school transportation routes for municipalities and companies (tenants). The architecture must be event-driven, modular, relational, scalable, and free of redundancy.

---

## Architecture

### Two Services, One Database, One Redis

```
monorepo/
├── services/
│   ├── management-api/   (port 3000) — tenant control, licenses, modules, monitoring
│   └── app-api/          (port 3001) — gestor + motorista operations, real-time
├── packages/
│   └── shared/           — event contracts, shared types, validation schemas
└── apps/
    ├── web/              — gestor dashboard (React)
    ├── mobile/           — motorista app (React Native)
    └── desktop/          — Electron (uses app-api)

Infrastructure:
  PostgreSQL — single instance, two schemas: management + app
  Redis      — Pub/Sub (cross-service events) + Socket.io Adapter + location cache
```

Both services are **stateless**. All session data, location cache, module config, and tenant status live in Redis. This enables horizontal scaling without code changes: run N replicas behind a load balancer.

---

## Database Design

### Schema: `management`

```sql
tenants (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  cidade TEXT NOT NULL,
  estado TEXT NOT NULL,
  cnpj TEXT,
  email_contato TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
)

licenses (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES management.tenants(id),
  max_veiculos INTEGER NOT NULL DEFAULT 10,
  max_motoristas INTEGER NOT NULL DEFAULT 10,
  max_gestores INTEGER NOT NULL DEFAULT 3,
  data_inicio DATE NOT NULL,
  data_fim DATE,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

modules (
  id SERIAL PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,  -- 'rotas', 'financeiro', 'rastreamento', 'mensagens', 'veiculos'
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

tenant_modules (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES management.tenants(id),
  module_id INTEGER REFERENCES management.modules(id),
  habilitado BOOLEAN DEFAULT true,
  habilitado_em TIMESTAMPTZ DEFAULT NOW(),
  desabilitado_em TIMESTAMPTZ,
  UNIQUE(tenant_id, module_id)
)

audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES management.tenants(id),  -- nullable = superadmin
  user_firebase_uid TEXT,
  user_role TEXT,            -- 'gestor' | 'motorista' | 'superadmin'
  action TEXT NOT NULL,      -- 'login' | 'api_request'
  endpoint TEXT,
  method TEXT,
  status_code INTEGER,
  ip TEXT,
  device_id TEXT,
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

tenant_metrics (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES management.tenants(id),
  data DATE NOT NULL,
  total_logins INTEGER DEFAULT 0,
  unique_devices INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  veiculos_ativos INTEGER DEFAULT 0,   -- recalculated daily by cron (see Anomaly section)
  motoristas_ativos INTEGER DEFAULT 0,
  execucoes_iniciadas INTEGER DEFAULT 0,
  execucoes_concluidas INTEGER DEFAULT 0,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, data)
)

-- Gestor invites live in management schema (created by management-api, read by app-api)
gestor_invites (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES management.tenants(id),
  token TEXT UNIQUE NOT NULL,
  email TEXT,
  usado BOOLEAN DEFAULT false,
  expira_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

anomaly_alerts (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES management.tenants(id),
  tipo TEXT NOT NULL,         -- 'devices_over_limit' | 'concurrent_logins_spike' | 'requests_spike' | 'motoristas_over_limit' | 'inactive_then_burst'
  descricao TEXT NOT NULL,
  severidade TEXT NOT NULL,   -- 'info' | 'warning' | 'critical'
  dados JSONB,                -- context snapshot at alert time
  resolvido BOOLEAN DEFAULT false,
  resolvido_em TIMESTAMPTZ,
  nota_resolucao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)
-- Deduplication: partial unique index ensures at most one OPEN alert per rule per tenant.
-- Resolved alerts (resolvido = true) are historical and do not block new alerts.
CREATE UNIQUE INDEX anomaly_alerts_open_unique
  ON management.anomaly_alerts (tenant_id, tipo)
  WHERE resolvido = false;
```

> **Deduplication:** The partial unique index on `(tenant_id, tipo) WHERE resolvido = false` guarantees at most one open alert per rule per tenant. Once resolved, the constraint no longer applies and a new alert can be created if the condition recurs.

**Indexes (management schema):**
- `audit_logs(tenant_id, criado_em)` — paginated listing per tenant
- `audit_logs(device_id)` — device tracking
- `audit_logs(tenant_id, action, criado_em)` — login spike queries
- `tenant_metrics(tenant_id, data)` — UNIQUE, time-series queries
- `anomaly_alerts(tenant_id, resolvido)` — open alerts per tenant

---

### Schema: `app`

```sql
-- Note: PostgreSQL supports cross-schema foreign keys (schema.table notation).
-- FK from app tables to management.tenants is intentionally omitted to keep
-- schema migrations independent. tenant_id integrity is enforced at the application layer.

gestores (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  firebase_uid TEXT UNIQUE NOT NULL,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

motoristas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  firebase_uid TEXT UNIQUE,
  nome TEXT NOT NULL,
  telefone TEXT,
  foto_url TEXT,
  documento_url TEXT,
  pin_hash TEXT,
  convite_token TEXT UNIQUE,
  convite_expira_em TIMESTAMPTZ,
  cadastro_completo BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

escolas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  turno_manha BOOLEAN DEFAULT false,
  turno_tarde BOOLEAN DEFAULT false,
  turno_noite BOOLEAN DEFAULT false,
  horario_entrada_manha TEXT,
  horario_saida_manha TEXT,
  horario_entrada_tarde TEXT,
  horario_saida_tarde TEXT,
  horario_entrada_noite TEXT,
  horario_saida_noite TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

alunos (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  escola_id INTEGER REFERENCES app.escolas(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  cpf_responsavel TEXT,
  telefone_responsavel TEXT,
  endereco TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  turno TEXT CHECK(turno IN ('manha','tarde','noite')),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

veiculos (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  placa TEXT NOT NULL,
  modelo TEXT,
  fabricante TEXT,
  ano INTEGER,
  capacidade INTEGER,          -- number of seats (operationally relevant)
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, placa)
)

-- Tracks which tablet (device) is currently bound to which vehicle.
-- Replaces the current-binding column approach with a history table.
tablet_vinculos (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id INTEGER REFERENCES app.motoristas(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,     -- UUID from tablet AsyncStorage
  vinculado_em TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ  -- NULL = currently active
)

-- Motorista-vehicle authorization (which driver is allowed to use which vehicle)
veiculo_motorista (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id INTEGER REFERENCES app.motoristas(id) ON DELETE CASCADE,
  vinculado_em TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
)
-- Partial unique index: only one active authorization per pair at a time.
-- Past deactivated rows (desvinculado_em IS NOT NULL) are kept as history and do not conflict.
CREATE UNIQUE INDEX veiculo_motorista_active_unique
  ON app.veiculo_motorista (veiculo_id, motorista_id)
  WHERE desvinculado_em IS NULL;

rotas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  motorista_id INTEGER REFERENCES app.motoristas(id) ON DELETE SET NULL,
  veiculo_id INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  turno TEXT CHECK(turno IN ('manha','tarde','noite')),
  rota_geojson JSONB,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

rota_paradas (
  id SERIAL PRIMARY KEY,
  rota_id INTEGER REFERENCES app.rotas(id) ON DELETE CASCADE,
  aluno_id INTEGER REFERENCES app.alunos(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  UNIQUE(rota_id, ordem)
  -- PUT /rotas/:id/paradas performs DELETE + INSERT (replace-all) to avoid duplicate ordem
)

execucoes (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  rota_id INTEGER REFERENCES app.rotas(id) ON DELETE SET NULL,
  motorista_id INTEGER REFERENCES app.motoristas(id) ON DELETE SET NULL,
  veiculo_id INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'em_andamento' CHECK(status IN ('em_andamento','concluida','cancelada')),
  iniciada_em TIMESTAMPTZ DEFAULT NOW(),
  concluida_em TIMESTAMPTZ
)

execucao_paradas (
  id SERIAL PRIMARY KEY,
  execucao_id INTEGER REFERENCES app.execucoes(id) ON DELETE CASCADE,
  aluno_id INTEGER REFERENCES app.alunos(id) ON DELETE SET NULL,
  status TEXT CHECK(status IN ('embarcou','pulou')),
  horario TIMESTAMPTZ DEFAULT NOW()
)

-- Immutable snapshot written by app-api at POST /execucao/:id/finalizar.
-- Denormalized fields preserve readable data even if source records are deleted.
historico (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  execucao_id INTEGER REFERENCES app.execucoes(id) ON DELETE SET NULL,
  rota_id INTEGER,
  rota_nome TEXT,
  motorista_id INTEGER,
  motorista_nome TEXT,
  veiculo_id INTEGER,
  veiculo_placa TEXT,
  km_total DOUBLE PRECISION,
  alunos_embarcados INTEGER DEFAULT 0,
  alunos_pulados INTEGER DEFAULT 0,
  data_execucao DATE NOT NULL,
  iniciada_em TIMESTAMPTZ,
  concluida_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

mensagens (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  remetente_id INTEGER NOT NULL,
  remetente_tipo TEXT NOT NULL CHECK(remetente_tipo IN ('gestor','motorista')),
  destinatario_id INTEGER NOT NULL,
  destinatario_tipo TEXT NOT NULL CHECK(destinatario_tipo IN ('gestor','motorista')),
  conteudo TEXT NOT NULL,
  lido BOOLEAN DEFAULT false,
  criado_em TIMESTAMPTZ DEFAULT NOW()
)

cobrancas (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL,
  aluno_id INTEGER REFERENCES app.alunos(id) ON DELETE SET NULL,
  mes_referencia DATE NOT NULL,  -- first day of the month
  valor NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','pago','cancelado')),
  criado_em TIMESTAMPTZ DEFAULT NOW()
)
```

**Indexes (app schema):**
- `gestores(tenant_id)`, `gestores(firebase_uid)`
- `motoristas(tenant_id)`, `motoristas(firebase_uid)`, `motoristas(convite_token)`
- `alunos(tenant_id)`, `alunos(escola_id)`
- `rotas(tenant_id)`, `rotas(motorista_id)`, `rotas(veiculo_id)`
- `rota_paradas(rota_id)`
- `execucoes(tenant_id, status)`, `execucoes(motorista_id)`
- `execucao_paradas(execucao_id)`
- `mensagens(tenant_id, destinatario_id, lido)`
- `veiculos(tenant_id)` — placa uniqueness already enforced by UNIQUE(tenant_id, placa)
- `tablet_vinculos(device_id)`, `tablet_vinculos(veiculo_id, desvinculado_em)`
- `historico(tenant_id, data_execucao)` — primary filter for paginated listing
- `historico(motorista_id)`, `historico(rota_id)` — secondary filters

---

## Event Architecture

### Redis Pub/Sub — Cross-Service Events

All event contracts defined in `packages/shared/src/events.ts`. Services never call each other via HTTP.

**management-api → app-api:**
| Event | Payload | app-api Action |
|---|---|---|
| `tenant:created` | `{ tenant_id }` | Write `tenant:{id}:active = true` to Redis |
| `tenant:deactivated` | `{ tenant_id }` | Set `tenant:{id}:active = false`; disconnect all sockets in room `tenant:{id}` |
| `module:enabled` | `{ tenant_id, module_slug }` | Set `module:{tenant_id}:{slug} = true` in Redis |
| `module:disabled` | `{ tenant_id, module_slug }` | Set `module:{tenant_id}:{slug} = false` in Redis |
| `license:updated` | `{ tenant_id, max_veiculos, max_motoristas, max_gestores }` | Update `license:{tenant_id}` hash in Redis |

**app-api → management-api:**
| Event | Payload | management-api Action |
|---|---|---|
| `auth:login` | `{ tenant_id, user_id, role, ip, device_id, user_agent }` | INSERT audit_log, UPSERT metrics total_logins |
| `auth:device_seen` | `{ tenant_id, device_id, motorista_id }` | Add to Redis set `devices:{tenant_id}:{date}` (TTL 2d); if SCARD > max_veiculos → INSERT anomaly_alert |
| `location:updated` | `{ tenant_id, motorista_id, veiculo_id }` | Add veiculo_id to Redis set `active_veiculos:{tenant_id}:{date}` (TTL 2d). veiculo_id is required — app-api resolves it from the motorista's active tablet_vinculos before publishing. If no active binding exists, the event is published with veiculo_id = 0 (sentinel) and counted as an unbound vehicle. |
| `execucao:started` | `{ tenant_id, execucao_id, rota_id, motorista_id }` | UPSERT metrics execucoes_iniciadas |
| `execucao:completed` | `{ tenant_id, execucao_id, stats }` | UPSERT metrics execucoes_concluidas |

### `historico` Write Path

`POST /execucao/:id/finalizar` in app-api:
1. Sets `execucoes.status = 'concluida'`, `concluida_em = NOW()`
2. Counts `execucao_paradas` for embarcados/pulados
3. INSERTs a row into `app.historico` with all denormalized fields assembled from the execucao join
4. Publishes `execucao:completed` to Redis

management-api does **not** write to `historico` — it only increments its own metrics counter.

### Internal Events (Node.js EventEmitter — within each service)

**app-api internal:**
- `rota:started`, `rota:parada_completed`, `rota:finished`
- `motorista:online`, `motorista:offline`
- `veiculo:vinculado`, `veiculo:desvinculado`

These never cross service boundaries.

---

## Authentication

### management-api
- Firebase Admin SDK verifies Google token
- Issues signed JWT: `{ sub: uid, role: 'superadmin', iat, exp }`
- Single user (the software owner). No tenant_id in token.
- All routes protected by `requireSuperAdmin` middleware

### app-api
- Firebase Admin SDK verifies Google token (login + invite acceptance)
- Issues signed JWT: `{ sub: user_id, tenant_id, role: 'gestor'|'motorista', firebase_uid, nome, email }`
- Separate JWT secret from management-api
- Middleware stack per protected route: `verifyAppToken → requireTenantActive → requireModule(slug)`

### `requireTenantActive` Middleware

```
1. Read Redis key: tenant:{tenant_id}:active
   - Hit "true"  → allow
   - Hit "false" → 403 { error: 'Tenant desativado' }
   - Miss        → query management.tenants WHERE id = tenant_id
                   → cache result (true/false) with TTL 60s
                   → if not found or ativo = false → 403

On tenant:deactivated event:
  app-api sets tenant:{id}:active = false in Redis
  app-api calls io.in('tenant:{id}').disconnectSockets() to drop live connections
```

### Module Guard

```
requireModule('financeiro') middleware:
  1. Read Redis key: module:{tenant_id}:financeiro
     - Hit "true"  → allow
     - Hit "false" → 403 { error: 'Modulo nao habilitado para este tenant' }
     - Miss        → query management.tenant_modules JOIN modules
                     → cache result with TTL 300s
                     → if not found or habilitado = false → 403
```

### License Enforcement
- Every motorista login sends `device_id` (UUID stored in device AsyncStorage, stable across sessions)
- app-api publishes `auth:device_seen` on every login
- management-api adds device_id to Redis set `devices:{tenant_id}:{YYYY-MM-DD}` (TTL 48h)
- Cron job reads SCARD of the set vs `license.max_veiculos`
- Violation → INSERT `anomaly_alerts` (skipped if open alert for same rule already exists)
- Enforcement is **monitoring-first**: dashboard shows alert, manual action follows

---

## Real-Time (Socket.io)

- `app-api` runs Socket.io with **Redis Adapter** (`@socket.io/redis-adapter`)
- Rooms: `tenant:{id}` — all gestores and motoristas join on connect
- Location updates broadcast only within the tenant room
- **Scalability:** Multiple `app-api` replicas share socket state via Redis. Redis Adapter syncs room membership and event delivery across instances automatically

### Location Cache in Redis

Active motorista locations are stored in Redis (not in-memory), enabling stateless app-api:

```
Key:   location:{tenant_id}:{motorista_id}
Value: JSON { motorista_id, nome, lat, lng, speed, heading, rota_id?, rota_nome?, timestamp }
TTL:   5 minutes (auto-expires after disconnect; refreshed on every location_update)
```

On `get_locations`: app-api scans `location:{tenant_id}:*` keys and returns all values.
On motorista disconnect: key expires naturally via TTL (no explicit delete needed).

### Socket.io Event Contracts

```
Client → Server:
  location_update    { lat, lng, speed, heading, rota_id? }
  get_locations      (gestor only)
  chat:message       { destinatario_id, destinatario_tipo, conteudo }
  chat:read          { remetente_id, remetente_tipo }

Server → Client:
  location_update    MotoristaLocation
  all_locations      MotoristaLocation[]
  motorista_offline  { motorista_id }    -- emitted on socket disconnect event (not Redis TTL)
  chat:message       Mensagem
  chat:read          { reader_id, reader_tipo }
```

> **Note on `motorista_offline`:** Offline detection uses the Socket.io `disconnect` event, not Redis keyspace notifications. On disconnect, the app-api emits `motorista_offline` to the tenant room and sets the Redis location key TTL to 5 minutes (grace period for reconnects). This avoids any dependency on Redis keyspace notification config (`notify-keyspace-events`).

---

## API Routes

### management-api

```
Auth
  POST /auth/login                           → superadmin login (Firebase → JWT)

Dashboard
  GET  /dashboard                            → overview: active tenants, open alerts, top usage

Tenants
  GET  /tenants                              → list with license + usage summary
  POST /tenants                              → create tenant (also creates default license, enables all modules)
  GET  /tenants/:id                          → detail: modules, license, 30-day metrics
  PUT  /tenants/:id                          → update tenant info
  DELETE /tenants/:id                        → soft delete → publishes tenant:deactivated

Licenses
  PUT  /tenants/:id/license                  → update limits → publishes license:updated

Modules
  GET  /modules                              → list all available modules
  PUT  /tenants/:id/modules                  → enable/disable modules → publishes module:enabled|disabled

Invites
  POST /tenants/:id/invite                   → generate gestor invite link
                                               management-api generates the token and stores it in
                                               management.gestor_invites (see table below).
                                               app-api reads from this table during invite validation.
  GET  /tenants/:id/invites                  → list invites

Monitoring
  GET  /tenants/:id/metrics?from=&to=        → daily metrics time series
  GET  /tenants/:id/devices                  → unique device_ids seen (from audit_logs)
  GET  /tenants/:id/audit?page=&limit=       → paginated audit log

Anomalies
  GET  /anomalies                            → all open alerts ordered by severity
  GET  /anomalies?tenant_id=                 → filtered by tenant
  PATCH /anomalies/:id/resolve               → mark resolved + optional note
```

### app-api

```
Auth
  POST /auth/login                           → gestor/motorista login (Firebase → app JWT)
                                               publishes auth:login + auth:device_seen (motorista only)
  GET  /auth/profile                         → current user profile (from JWT: sub, role, nome, email)
  GET  /auth/invite/:token                   → validate invite (gestor or motorista)
  POST /auth/invite/:token/accept            → accept invite (Firebase token body)

Gestores
  GET  /gestores                             → list for tenant
  DELETE /gestores/:id                       → soft delete

Motoristas [module: rotas]
  GET  /motoristas
  POST /motoristas                           → create + generate invite link
  GET  /motoristas/:id
  PUT  /motoristas/:id
  DELETE /motoristas/:id
  POST /motoristas/:id/invite                → regenerate invite

Escolas [module: rotas]
  GET/POST /escolas
  GET/PUT/DELETE /escolas/:id

Alunos [module: rotas]
  GET/POST /alunos
  GET/PUT/DELETE /alunos/:id

Veiculos [module: veiculos]
  GET/POST /veiculos
  GET/PUT/DELETE /veiculos/:id
  POST /veiculos/:id/vincular-motorista      → INSERT veiculo_motorista
  DELETE /veiculos/:id/desvincular-motorista → SET desvinculado_em on veiculo_motorista
  GET  /veiculos/:id/rotas                   → routes assigned to this vehicle

Rotas [module: rotas]
  GET/POST /rotas
  GET/PUT/DELETE /rotas/:id
  GET /rotas/:id/paradas
  PUT /rotas/:id/paradas                     → DELETE all + INSERT new (replace-all)

Execucao [module: rotas]
  POST /execucao/iniciar                     → creates execucao, publishes execucao:started
  POST /execucao/:id/parada                  → records embarcou|pulou
  POST /execucao/:id/finalizar               → sets concluida, writes historico, publishes execucao:completed
  POST /execucao/:id/cancelar                → sets cancelada
  GET  /execucao/ativa                       → motorista: current active execucao with paradas

Historico [module: rotas]
  GET  /historico                            → paginated, filterable by motorista/data/rota

Mensagens [module: mensagens]
  GET  /mensagens/conversas
  GET  /mensagens/:contato_id
  (real-time send/read via Socket.io)

Financeiro [module: financeiro]
  GET/POST /financeiro/cobrancas
  GET/PUT  /financeiro/cobrancas/:id

Dashboard
  GET  /dashboard                            → gestor stats for tenant (counts, active execucoes)

Motorista App
  GET  /motorista/rota-ativa                 → current route with ordered paradas and aluno data
  POST /motorista/pin/set                    → set or update PIN (requires Firebase auth)
  POST /motorista/pin/verify                 → verify PIN (requires Firebase auth, returns true/false)
  POST /motorista/pin/login                  → PIN-only login on bound tablet (no Firebase):
                                               body: { device_id, pin }
                                               1. Looks up active tablet_vinculos by device_id
                                               2. Loads motoristas row → verifies pin_hash
                                               3. Uses motoristas.firebase_uid (set during onboarding)
                                                  to populate the JWT firebase_uid field
                                               4. Returns app JWT with full AppTokenPayload
                                               5. Publishes auth:login + auth:device_seen
                                               Note: motoristas.firebase_uid is always populated
                                               after onboarding (cadastro_completo = true), so
                                               PIN login is only available post-onboarding.

Tablet Binding [module: veiculos]
  POST /motorista/vincular-tablet            → body: { veiculo_id, pin }
                                               device_id from header X-Device-ID
                                               verifies PIN, deactivates previous binding for device_id,
                                               INSERTs tablet_vinculos record
  DELETE /motorista/desvincular-tablet       → device_id from header X-Device-ID
                                               sets desvinculado_em on active tablet_vinculos
  GET  /motorista/tablet-status              → device_id from header X-Device-ID
                                               returns current binding info

  Note: X-Device-ID header is required on all tablet endpoints and on PIN login.
        It is a UUID generated once by the mobile app and persisted in AsyncStorage.
```

---

## Anomaly Detection Rules

Cron job runs every 15 minutes inside management-api. Guarded by a Redis distributed lock (`SET cron:anomaly:lock NX EX 900`) to prevent duplicate execution across multiple management-api replicas.

| Rule | Condition | Severity |
|---|---|---|
| `devices_over_limit` | SCARD `devices:{tenant_id}:{today}` > license.max_veiculos | critical |
| `motoristas_over_limit` | COUNT motoristas WHERE ativo=true > license.max_motoristas | critical |
| `concurrent_logins_spike` | logins last 1h > 7-day hourly average × 3 | warning |
| `requests_spike` | requests last 1h > 7-day hourly average × 5 | warning |
| `inactive_then_burst` | 0 total_requests for 7 days, then > 0 today | info |

**Deduplication:** Before inserting, cron checks: `SELECT 1 FROM anomaly_alerts WHERE tenant_id = $1 AND tipo = $2 AND resolvido = false`. If found, skip. This is also enforced by the DB constraint.

**`veiculos_ativos` metric calculation:** The cron job reads SCARD of `active_veiculos:{tenant_id}:{today}` (populated by `location:updated` events, Redis set of unique veiculo_ids) and writes the result to `tenant_metrics.veiculos_ativos` for today. This avoids double-counting from multiple location updates by the same vehicle.

---

## Shared Package (`packages/shared`)

```typescript
// events.ts — Redis cross-service event contracts
export type CrossServiceEvent =
  | 'tenant:created'
  | 'tenant:deactivated'
  | 'module:enabled'
  | 'module:disabled'
  | 'license:updated'
  | 'auth:login'
  | 'auth:device_seen'
  | 'location:updated'
  | 'execucao:started'
  | 'execucao:completed'

export interface EventPayloads {
  'tenant:created': { tenant_id: number }
  'tenant:deactivated': { tenant_id: number }
  'module:enabled': { tenant_id: number; module_slug: string }
  'module:disabled': { tenant_id: number; module_slug: string }
  'license:updated': { tenant_id: number; max_veiculos: number; max_motoristas: number; max_gestores: number }
  'auth:login': { tenant_id: number; user_id: number; role: 'gestor' | 'motorista'; ip: string; device_id?: string; user_agent?: string }
  'auth:device_seen': { tenant_id: number; device_id: string; motorista_id: number }
  'location:updated': { tenant_id: number; motorista_id: number; veiculo_id: number }
  'execucao:started': { tenant_id: number; execucao_id: number; rota_id: number; motorista_id: number }
  'execucao:completed': { tenant_id: number; execucao_id: number; stats: { embarcados: number; pulados: number } }
}

// types.ts — shared domain types
export interface AppTokenPayload {
  sub: number       // integer user_id (gestor.id or motorista.id) — intentionally numeric
  tenant_id: number
  role: 'gestor' | 'motorista'
  firebase_uid: string
  nome: string
  email?: string
  iat?: number      // issued-at (added by jsonwebtoken automatically)
  exp?: number      // expiry (added by jsonwebtoken automatically)
}

export interface ManagementTokenPayload {
  sub: string   // firebase_uid of superadmin
  role: 'superadmin'
}
```

---

## Technology Stack

| Concern | Technology |
|---|---|
| Runtime | Node.js + TypeScript |
| HTTP Framework | Express |
| Database | PostgreSQL >= 15 (pg pool) |
| Cache / Events / Location | Redis (ioredis) |
| Real-time | Socket.io + @socket.io/redis-adapter |
| Auth | Firebase Admin SDK |
| Session tokens | jsonwebtoken |
| Schema migrations | Custom SQL runner (existing pattern) |
| Monorepo | pnpm workspaces |
| Scheduled jobs | node-cron + Redis distributed lock |

---

## Scalability Notes

- **Stateless services:** No in-memory state. Locations, module cache, tenant status, session data all in Redis
- **Horizontal scaling app-api:** Add replicas + load balancer. Socket.io Redis Adapter handles room sync and broadcasts automatically
- **Horizontal scaling management-api:** HTTP only + Redis lock on cron job prevents duplicate anomaly processing
- **New modules:** Add row to `modules` table + new router in app-api wrapped in `requireModule('slug')`. Zero changes elsewhere
- **New tenants:** management-api creates tenant + license + enables default modules + publishes `tenant:created`. app-api and client apps pick up from there

---

## Rewrite Approach

Complete rewrite from scratch. Current `api/` directory and all service code will be deleted and replaced by `services/management-api/` and `services/app-api/`. Apps (`web/`, `mobile/`, `desktop/`) will be updated to point to the new API URLs and updated invite endpoint paths (Portuguese → English).
