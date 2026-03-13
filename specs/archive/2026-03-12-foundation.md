# Architecture Rewrite — Plan 1: Foundation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the monorepo foundation: delete the old `api/` monolith, create the two new service skeletons (`management-api` and `app-api`), rebuild `packages/shared` with typed event contracts, write all database migrations, and verify both services boot with a passing health endpoint test.

> **⚠️ Note on apps/web and apps/mobile:** Rebuilding `packages/shared` in this plan will break existing imports in `apps/web` and `apps/mobile` (they reference old types from shared). This is **intentional and accepted** — those apps are fully updated in Plan 4. Do not attempt to fix app import errors during this plan.

**Architecture:** pnpm monorepo with two independent Express + TypeScript services under `services/`. A single PostgreSQL instance with two schemas (`management`, `app`). Redis for Pub/Sub and caching. All shared types and Redis event contracts live in `packages/shared`.

**Tech Stack:** Node.js 20, TypeScript 5, Express 4, PostgreSQL >= 15 (pg), Redis (ioredis), Jest + ts-jest + Supertest, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-03-11-architecture-rewrite-design.md`

---

## Chunk 1: Cleanup and Shared Package

### Task 1: Delete old API and restructure monorepo

**Files:**
- Delete: `api/` (entire directory)
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json` (root)
- Create: `services/management-api/.gitkeep`
- Create: `services/app-api/.gitkeep`

- [ ] **Step 1: Delete the old api directory**

```bash
rm -rf api/
```

- [ ] **Step 2: Update pnpm-workspace.yaml**

Replace contents with:

```yaml
packages:
  - 'services/*'
  - 'apps/*'
  - 'packages/*'
```

- [ ] **Step 3: Update root package.json**

Ensure `workspaces` matches and remove any `api` reference. Root `package.json` should be:

```json
{
  "name": "rotavans",
  "private": true,
  "scripts": {
    "dev:management": "pnpm --filter management-api dev",
    "dev:app": "pnpm --filter app-api dev",
    "build": "pnpm --filter './services/*' build",
    "test": "pnpm --filter './services/*' test"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 4: Create services directory**

```bash
mkdir -p services/management-api services/app-api
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: delete old api monolith, scaffold services/ directory"
```

---

### Task 2: Rebuild packages/shared

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/src/events.ts`
- Create: `packages/shared/src/types.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `packages/shared/tsconfig.json`

- [ ] **Step 1: Update packages/shared/package.json**

```json
{
  "name": "@rotavans/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Update packages/shared/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Write packages/shared/src/types.ts**

```typescript
// Domain types shared across services

export interface Tenant {
  id: number;
  nome: string;
  cidade: string;
  estado: string;
  cnpj?: string;
  email_contato?: string;
  ativo: boolean;
  criado_em: string;
}

export interface License {
  id: number;
  tenant_id: number;
  max_veiculos: number;
  max_motoristas: number;
  max_gestores: number;
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
}

export interface Module {
  id: number;
  slug: string;
  nome: string;
  descricao?: string;
  ativo: boolean;
}

// JWT payloads
export interface AppTokenPayload {
  sub: number;        // integer user_id (gestor.id or motorista.id)
  tenant_id: number;
  role: 'gestor' | 'motorista';
  firebase_uid: string;
  nome: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export interface ManagementTokenPayload {
  sub: string;        // firebase_uid of superadmin
  role: 'superadmin';
  iat?: number;
  exp?: number;
}

// Socket.io real-time types
export interface MotoristaLocation {
  motorista_id: number;
  tenant_id: number;
  nome: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  rota_id?: number;
  rota_nome?: string;
  timestamp: number;
}
```

- [ ] **Step 4: Write packages/shared/src/events.ts**

```typescript
// Redis Pub/Sub cross-service event contracts.
// Both services import these types to ensure contract consistency.

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
  | 'execucao:completed';

export interface EventPayloads {
  'tenant:created': { tenant_id: number };
  'tenant:deactivated': { tenant_id: number };
  'module:enabled': { tenant_id: number; module_slug: string };
  'module:disabled': { tenant_id: number; module_slug: string };
  'license:updated': {
    tenant_id: number;
    max_veiculos: number;
    max_motoristas: number;
    max_gestores: number;
  };
  'auth:login': {
    tenant_id: number;
    user_id: number;
    role: 'gestor' | 'motorista';
    ip: string;
    device_id?: string;
    user_agent?: string;
  };
  'auth:device_seen': {
    tenant_id: number;
    device_id: string;
    motorista_id: number;
  };
  'location:updated': {
    tenant_id: number;
    motorista_id: number;
    veiculo_id: number;   // 0 = unbound (no active tablet_vinculos)
  };
  'execucao:started': {
    tenant_id: number;
    execucao_id: number;
    rota_id: number;
    motorista_id: number;
  };
  'execucao:completed': {
    tenant_id: number;
    execucao_id: number;
    stats: { embarcados: number; pulados: number };
  };
}

// Type-safe Redis event publisher/subscriber helper types
export type EventPayload<E extends CrossServiceEvent> = EventPayloads[E];
```

- [ ] **Step 5: Write packages/shared/src/index.ts**

```typescript
export * from './types';
export * from './events';
```

- [ ] **Step 6: Build the shared package**

```bash
cd packages/shared && pnpm build
```

Expected: `dist/` directory created with `.js` and `.d.ts` files. No TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/
git commit -m "feat(shared): rebuild with typed event contracts and domain types"
```

---

## Chunk 2: Database Migrations

### Task 3: management schema migration

**Files:**
- Create: `services/management-api/src/db/migrations/001_management_schema.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- services/management-api/src/db/migrations/001_management_schema.sql

CREATE SCHEMA IF NOT EXISTS management;

CREATE TABLE IF NOT EXISTS management.tenants (
  id          SERIAL PRIMARY KEY,
  nome        TEXT NOT NULL,
  cidade      TEXT NOT NULL,
  estado      TEXT NOT NULL,
  cnpj        TEXT,
  email_contato TEXT,
  ativo       BOOLEAN DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.licenses (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  max_veiculos    INTEGER NOT NULL DEFAULT 10,
  max_motoristas  INTEGER NOT NULL DEFAULT 10,
  max_gestores    INTEGER NOT NULL DEFAULT 3,
  data_inicio     DATE NOT NULL,
  data_fim        DATE,
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.modules (
  id        SERIAL PRIMARY KEY,
  slug      TEXT UNIQUE NOT NULL,
  nome      TEXT NOT NULL,
  descricao TEXT,
  ativo     BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.tenant_modules (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  module_id       INTEGER NOT NULL REFERENCES management.modules(id) ON DELETE CASCADE,
  habilitado      BOOLEAN DEFAULT true,
  habilitado_em   TIMESTAMPTZ DEFAULT NOW(),
  desabilitado_em TIMESTAMPTZ,
  UNIQUE(tenant_id, module_id)
);

CREATE TABLE IF NOT EXISTS management.gestor_invites (
  id        SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  token     TEXT UNIQUE NOT NULL,
  email     TEXT,
  usado     BOOLEAN DEFAULT false,
  expira_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.audit_logs (
  id               BIGSERIAL PRIMARY KEY,
  tenant_id        INTEGER REFERENCES management.tenants(id) ON DELETE SET NULL,
  user_firebase_uid TEXT,
  user_role        TEXT,
  action           TEXT NOT NULL,
  endpoint         TEXT,
  method           TEXT,
  status_code      INTEGER,
  ip               TEXT,
  device_id        TEXT,
  user_agent       TEXT,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.tenant_metrics (
  id                   SERIAL PRIMARY KEY,
  tenant_id            INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  data                 DATE NOT NULL,
  total_logins         INTEGER DEFAULT 0,
  unique_devices       INTEGER DEFAULT 0,
  total_requests       INTEGER DEFAULT 0,
  veiculos_ativos      INTEGER DEFAULT 0,
  motoristas_ativos    INTEGER DEFAULT 0,
  execucoes_iniciadas  INTEGER DEFAULT 0,
  execucoes_concluidas INTEGER DEFAULT 0,
  criado_em            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, data)
);

CREATE TABLE IF NOT EXISTS management.anomaly_alerts (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  tipo           TEXT NOT NULL,
  descricao      TEXT NOT NULL,
  severidade     TEXT NOT NULL CHECK(severidade IN ('info','warning','critical')),
  dados          JSONB,
  resolvido      BOOLEAN DEFAULT false,
  resolvido_em   TIMESTAMPTZ,
  nota_resolucao TEXT,
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

-- Partial unique index: at most one open alert per rule per tenant
CREATE UNIQUE INDEX IF NOT EXISTS anomaly_alerts_open_unique
  ON management.anomaly_alerts (tenant_id, tipo)
  WHERE resolvido = false;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_tenant_time    ON management.audit_logs(tenant_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_audit_device         ON management.audit_logs(device_id);
CREATE INDEX IF NOT EXISTS idx_audit_action_time    ON management.audit_logs(tenant_id, action, criado_em);
CREATE INDEX IF NOT EXISTS idx_anomaly_tenant_open  ON management.anomaly_alerts(tenant_id, resolvido);
CREATE INDEX IF NOT EXISTS idx_licenses_tenant      ON management.licenses(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_modules_tenant ON management.tenant_modules(tenant_id);

-- Seed default modules
INSERT INTO management.modules (slug, nome, descricao) VALUES
  ('rotas',       'Rotas',       'Gerenciamento de rotas, alunos, escolas e execução'),
  ('rastreamento','Rastreamento','Rastreamento em tempo real dos motoristas'),
  ('mensagens',   'Mensagens',   'Chat entre gestores e motoristas'),
  ('financeiro',  'Financeiro',  'Controle de cobranças e pagamentos'),
  ('veiculos',    'Veículos',    'Cadastro e vinculação de veículos e tablets')
ON CONFLICT (slug) DO NOTHING;
```

- [ ] **Step 2: Commit**

```bash
git add services/management-api/
git commit -m "feat(management-api): add management schema migration"
```

---

### Task 4: app schema migration

**Files:**
- Create: `services/app-api/src/db/migrations/001_app_schema.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- services/app-api/src/db/migrations/001_app_schema.sql
-- NOTE: tenant_id in app tables is a logical FK to management.tenants.
-- Cross-schema FK is intentionally omitted to keep migration scripts independent.
-- tenant_id integrity is enforced at the application layer.

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.gestores (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  firebase_uid TEXT UNIQUE NOT NULL,
  nome         TEXT NOT NULL,
  email        TEXT NOT NULL,
  ativo        BOOLEAN DEFAULT true,
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.motoristas (
  id                 SERIAL PRIMARY KEY,
  tenant_id          INTEGER NOT NULL,
  firebase_uid       TEXT UNIQUE,
  nome               TEXT NOT NULL,
  telefone           TEXT,
  foto_url           TEXT,
  documento_url      TEXT,
  pin_hash           TEXT,
  convite_token      TEXT UNIQUE,
  convite_expira_em  TIMESTAMPTZ,
  cadastro_completo  BOOLEAN DEFAULT false,
  ativo              BOOLEAN DEFAULT true,
  criado_em          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.escolas (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL,
  nome                  TEXT NOT NULL,
  endereco              TEXT NOT NULL,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  turno_manha           BOOLEAN DEFAULT false,
  turno_tarde           BOOLEAN DEFAULT false,
  turno_noite           BOOLEAN DEFAULT false,
  horario_entrada_manha TEXT,
  horario_saida_manha   TEXT,
  horario_entrada_tarde TEXT,
  horario_saida_tarde   TEXT,
  horario_entrada_noite TEXT,
  horario_saida_noite   TEXT,
  criado_em             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.alunos (
  id                    SERIAL PRIMARY KEY,
  tenant_id             INTEGER NOT NULL,
  escola_id             INTEGER REFERENCES app.escolas(id) ON DELETE SET NULL,
  nome                  TEXT NOT NULL,
  cpf_responsavel       TEXT,
  telefone_responsavel  TEXT,
  endereco              TEXT NOT NULL,
  lat                   DOUBLE PRECISION,
  lng                   DOUBLE PRECISION,
  turno                 TEXT CHECK(turno IN ('manha','tarde','noite')),
  ativo                 BOOLEAN DEFAULT true,
  criado_em             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.veiculos (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL,
  placa       TEXT NOT NULL,
  modelo      TEXT,
  fabricante  TEXT,
  ano         INTEGER,
  capacidade  INTEGER,
  ativo       BOOLEAN DEFAULT true,
  criado_em   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, placa)
);

CREATE TABLE IF NOT EXISTS app.tablet_vinculos (
  id              SERIAL PRIMARY KEY,
  veiculo_id      INTEGER NOT NULL REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id    INTEGER NOT NULL REFERENCES app.motoristas(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,
  vinculado_em    TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app.veiculo_motorista (
  id              SERIAL PRIMARY KEY,
  veiculo_id      INTEGER NOT NULL REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id    INTEGER NOT NULL REFERENCES app.motoristas(id) ON DELETE CASCADE,
  vinculado_em    TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

-- Partial unique: at most one active authorization per pair
CREATE UNIQUE INDEX IF NOT EXISTS veiculo_motorista_active_unique
  ON app.veiculo_motorista (veiculo_id, motorista_id)
  WHERE desvinculado_em IS NULL;

CREATE TABLE IF NOT EXISTS app.rotas (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  motorista_id INTEGER REFERENCES app.motoristas(id) ON DELETE SET NULL,
  veiculo_id   INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  nome         TEXT NOT NULL,
  turno        TEXT CHECK(turno IN ('manha','tarde','noite')),
  rota_geojson JSONB,
  ativo        BOOLEAN DEFAULT true,
  criado_em    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.rota_paradas (
  id       SERIAL PRIMARY KEY,
  rota_id  INTEGER NOT NULL REFERENCES app.rotas(id) ON DELETE CASCADE,
  aluno_id INTEGER NOT NULL REFERENCES app.alunos(id) ON DELETE CASCADE,
  ordem    INTEGER NOT NULL,
  lat      DOUBLE PRECISION,
  lng      DOUBLE PRECISION,
  UNIQUE(rota_id, ordem)
);

CREATE TABLE IF NOT EXISTS app.execucoes (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  rota_id      INTEGER REFERENCES app.rotas(id) ON DELETE SET NULL,
  motorista_id INTEGER REFERENCES app.motoristas(id) ON DELETE SET NULL,
  veiculo_id   INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'em_andamento'
                 CHECK(status IN ('em_andamento','concluida','cancelada')),
  iniciada_em  TIMESTAMPTZ DEFAULT NOW(),
  concluida_em TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS app.execucao_paradas (
  id          SERIAL PRIMARY KEY,
  execucao_id INTEGER NOT NULL REFERENCES app.execucoes(id) ON DELETE CASCADE,
  aluno_id    INTEGER REFERENCES app.alunos(id) ON DELETE SET NULL,
  status      TEXT CHECK(status IN ('embarcou','pulou')),
  horario     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.historico (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL,
  execucao_id      INTEGER REFERENCES app.execucoes(id) ON DELETE SET NULL,
  rota_id          INTEGER,
  rota_nome        TEXT,
  motorista_id     INTEGER,
  motorista_nome   TEXT,
  veiculo_id       INTEGER,
  veiculo_placa    TEXT,
  km_total         DOUBLE PRECISION,
  alunos_embarcados INTEGER DEFAULT 0,
  alunos_pulados   INTEGER DEFAULT 0,
  data_execucao    DATE NOT NULL,
  iniciada_em      TIMESTAMPTZ,
  concluida_em     TIMESTAMPTZ,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.mensagens (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL,
  remetente_id     INTEGER NOT NULL,
  remetente_tipo   TEXT NOT NULL CHECK(remetente_tipo IN ('gestor','motorista')),
  destinatario_id  INTEGER NOT NULL,
  destinatario_tipo TEXT NOT NULL CHECK(destinatario_tipo IN ('gestor','motorista')),
  conteudo         TEXT NOT NULL,
  lido             BOOLEAN DEFAULT false,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app.cobrancas (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL,
  aluno_id       INTEGER REFERENCES app.alunos(id) ON DELETE SET NULL,
  mes_referencia DATE NOT NULL,
  valor          NUMERIC(10,2) NOT NULL,
  status         TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','pago','cancelado')),
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gestores_tenant     ON app.gestores(tenant_id);
CREATE INDEX IF NOT EXISTS idx_gestores_firebase   ON app.gestores(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_motoristas_tenant   ON app.motoristas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_motoristas_firebase ON app.motoristas(firebase_uid);
CREATE INDEX IF NOT EXISTS idx_motoristas_convite  ON app.motoristas(convite_token);
CREATE INDEX IF NOT EXISTS idx_alunos_tenant       ON app.alunos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_alunos_escola       ON app.alunos(escola_id);
CREATE INDEX IF NOT EXISTS idx_rotas_tenant        ON app.rotas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_rotas_motorista     ON app.rotas(motorista_id);
CREATE INDEX IF NOT EXISTS idx_rotas_veiculo       ON app.rotas(veiculo_id);
CREATE INDEX IF NOT EXISTS idx_rota_paradas_rota   ON app.rota_paradas(rota_id);
CREATE INDEX IF NOT EXISTS idx_execucoes_tenant    ON app.execucoes(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_execucoes_motorista ON app.execucoes(motorista_id);
CREATE INDEX IF NOT EXISTS idx_execucao_paradas    ON app.execucao_paradas(execucao_id);
CREATE INDEX IF NOT EXISTS idx_historico_tenant_data ON app.historico(tenant_id, data_execucao);
CREATE INDEX IF NOT EXISTS idx_historico_motorista ON app.historico(motorista_id);
CREATE INDEX IF NOT EXISTS idx_historico_rota      ON app.historico(rota_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_dest      ON app.mensagens(tenant_id, destinatario_id, lido);
CREATE INDEX IF NOT EXISTS idx_veiculos_tenant     ON app.veiculos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tablet_device       ON app.tablet_vinculos(device_id);
CREATE INDEX IF NOT EXISTS idx_tablet_veiculo      ON app.tablet_vinculos(veiculo_id, desvinculado_em);
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/
git commit -m "feat(app-api): add app schema migration"
```

---

## Chunk 3: Service Skeletons

### Task 5: management-api skeleton

**Files:**
- Create: `services/management-api/package.json`
- Create: `services/management-api/tsconfig.json`
- Create: `services/management-api/jest.config.ts`
- Create: `services/management-api/src/__tests__/setup.ts`
- Create: `services/management-api/src/__tests__/health.test.ts`
- Create: `services/management-api/src/db/pool.ts`
- Create: `services/management-api/src/db/migrate.ts`
- Create: `services/management-api/src/redis/client.ts`
- Create: `services/management-api/src/app.ts`
- Create: `services/management-api/src/index.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "management-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand",
    "migrate": "ts-node src/db/migrate.ts"
  },
  "dependencies": {
    "@rotavans/shared": "workspace:*",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "firebase-admin": "^12.0.0",
    "ioredis": "^5.3.0",
    "jsonwebtoken": "^9.0.0",
    "node-cron": "^3.0.0",
    "pg": "^8.11.0"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.11.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@rotavans/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@rotavans/shared$': '<rootDir>/../../packages/shared/src',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
};

export default config;
```

- [ ] **Step 4: Create src/__tests__/setup.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.test' });
```

- [ ] **Step 5: Write the failing health test**

```typescript
// src/__tests__/health.test.ts
import request from 'supertest';
import { createApp } from '../app';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
```

- [ ] **Step 6: Run test to confirm it fails**

> Note: `.env.test` does not exist yet (created in Task 7). The health test does not use the database or Redis, so missing env vars will not affect the expected failure mode.

```bash
cd services/management-api && pnpm install && pnpm test
```

Expected: FAIL — `Cannot find module '../app'`

- [ ] **Step 7: Create src/db/pool.ts**

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
});
```

- [ ] **Step 8: Create src/db/migrate.ts**

```typescript
import fs from 'fs';
import path from 'path';
import { pool } from './pool';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create the schema first so the migrations tracking table can be placed inside it.
    // The first SQL migration file also creates the schema (idempotent via IF NOT EXISTS).
    await client.query('CREATE SCHEMA IF NOT EXISTS management');

    await client.query(`
      CREATE TABLE IF NOT EXISTS management.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM management.schema_migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) {
        console.log(`[migrate] skipping ${file} (already applied)`);
        continue;
      }
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO management.schema_migrations (filename) VALUES ($1)',
        [file]
      );
      console.log(`[migrate] applied ${file}`);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => { console.log('[migrate] done'); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}

export { runMigrations };
```

- [ ] **Step 9: Create src/redis/client.ts**

```typescript
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export function createRedisClient(): Redis {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
}

// Singleton for the service
let _redis: Redis | null = null;

export function getRedis(): Redis {
  if (!_redis) _redis = createRedisClient();
  return _redis;
}
```

- [ ] **Step 10: Create src/app.ts**

```typescript
import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'management-api', ts: new Date().toISOString() });
  });

  return app;
}
```

- [ ] **Step 11: Create src/index.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import { createApp } from './app';
import { pool } from './db/pool';

const PORT = process.env.MANAGEMENT_PORT || 3000;

const app = createApp();

app.listen(PORT, () => {
  console.log(`[management-api] listening on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
```

- [ ] **Step 12: Run the health test — expect PASS**

```bash
pnpm test
```

Expected: PASS — `GET /health returns 200 with status ok`

- [ ] **Step 13: Commit**

```bash
git add services/management-api/
git commit -m "feat(management-api): bootstrap service skeleton with health endpoint"
```

---

### Task 6: app-api skeleton

**Files:**
- Create: `services/app-api/package.json`
- Create: `services/app-api/tsconfig.json`
- Create: `services/app-api/jest.config.ts`
- Create: `services/app-api/src/db/pool.ts`
- Create: `services/app-api/src/db/migrate.ts`
- Create: `services/app-api/src/redis/client.ts`
- Create: `services/app-api/src/app.ts`
- Create: `services/app-api/src/index.ts`
- Create: `services/app-api/src/__tests__/health.test.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "app-api",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand",
    "migrate": "ts-node src/db/migrate.ts"
  },
  "dependencies": {
    "@rotavans/shared": "workspace:*",
    "@socket.io/redis-adapter": "^8.3.0",
    "bcrypt": "^5.1.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.19.0",
    "firebase-admin": "^12.0.0",
    "ioredis": "^5.3.0",
    "jsonwebtoken": "^9.0.0",
    "pg": "^8.11.0",
    "socket.io": "^4.7.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.0",
    "@types/jsonwebtoken": "^9.0.0",
    "@types/node": "^20.0.0",
    "@types/pg": "^8.11.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.7.0",
    "supertest": "^6.3.0",
    "ts-jest": "^29.1.0",
    "ts-node": "^10.9.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json** (same pattern as management-api)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "paths": {
      "@rotavans/shared": ["../../packages/shared/src"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@rotavans/shared$': '<rootDir>/../../packages/shared/src',
  },
  setupFiles: ['<rootDir>/src/__tests__/setup.ts'],
};

export default config;
```

- [ ] **Step 4: Create src/__tests__/setup.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env.test' });
```

- [ ] **Step 5: Write the failing health test**

```typescript
// src/__tests__/health.test.ts
import request from 'supertest';
import { createApp } from '../app';

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const app = createApp();
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('app-api');
  });
});
```

- [ ] **Step 6: Run test to confirm it fails**

> Note: `.env.test` does not exist yet (created in Task 7). The health test does not use the database or Redis, so missing env vars will not affect the expected failure mode.

```bash
cd services/app-api && pnpm install && pnpm test
```

Expected: FAIL — `Cannot find module '../app'`

- [ ] **Step 7: Create src/db/pool.ts** (same as management-api)

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : false,
});
```

- [ ] **Step 8: Create src/db/migrate.ts** (same pattern, `app` schema)

```typescript
import fs from 'fs';
import path from 'path';
import { pool } from './pool';

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function runMigrations() {
  const client = await pool.connect();
  try {
    // Create schema first — must exist before the migrations table can be placed inside it.
    await client.query('CREATE SCHEMA IF NOT EXISTS app');

    await client.query(`
      CREATE TABLE IF NOT EXISTS app.schema_migrations (
        filename TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT 1 FROM app.schema_migrations WHERE filename = $1',
        [file]
      );
      if (rows.length > 0) continue;
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      await client.query(sql);
      await client.query(
        'INSERT INTO app.schema_migrations (filename) VALUES ($1)',
        [file]
      );
      console.log(`[migrate] applied ${file}`);
    }
  } finally {
    client.release();
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => { console.log('[migrate] done'); process.exit(0); })
    .catch(err => { console.error(err); process.exit(1); });
}

export { runMigrations };
```

- [ ] **Step 9: Create src/redis/client.ts** (same as management-api)

```typescript
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

export function createRedisClient(): Redis {
  return new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
    lazyConnect: true,
    maxRetriesPerRequest: 3,
  });
}

let _redis: Redis | null = null;
export function getRedis(): Redis {
  if (!_redis) _redis = createRedisClient();
  return _redis;
}
```

- [ ] **Step 10: Create src/app.ts**

```typescript
import express from 'express';
import cors from 'cors';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'app-api', ts: new Date().toISOString() });
  });

  return app;
}
```

- [ ] **Step 11: Create src/index.ts**

```typescript
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' });

import http from 'http';
import { createApp } from './app';
import { pool } from './db/pool';

const PORT = process.env.APP_PORT || 3001;

const app = createApp();
// Export httpServer so Plan 3 can attach Socket.io without refactoring this file
export const httpServer = http.createServer(app);

httpServer.listen(PORT, () => {
  console.log(`[app-api] listening on http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
```

- [ ] **Step 12: Run health test — expect PASS**

```bash
pnpm test
```

Expected: PASS

- [ ] **Step 13: Commit**

```bash
git add services/app-api/
git commit -m "feat(app-api): bootstrap service skeleton with health endpoint"
```

---

### Task 7: Environment files

**Files:**
- Modify: `.env.example`
- Create: `.env.test` (gitignored)

- [ ] **Step 1: Update .env.example**

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/rotavans

# Redis
REDIS_URL=redis://localhost:6379

# Firebase
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# JWT secrets (different per service)
MANAGEMENT_JWT_SECRET=change-me-management-32-chars-min
APP_JWT_SECRET=change-me-app-32-chars-minimum-val

# Ports
MANAGEMENT_PORT=3000
APP_PORT=3001
```

- [ ] **Step 2: Create .env.test for local test runs**

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/rotavans_test
REDIS_URL=redis://localhost:6379
MANAGEMENT_JWT_SECRET=test-management-secret-32-chars-ok
APP_JWT_SECRET=test-app-jwt-secret-32-chars-okay
FIREBASE_PROJECT_ID=test-project
```

- [ ] **Step 3: Ensure .env.test is gitignored**

Add to `.gitignore` if not present:
```
.env
.env.test
.env.local
```

- [ ] **Step 4: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: update env template for dual-service architecture"
```

---

### Task 8: Docker Compose for local development

**Files:**
- Create: `docker-compose.yml`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
# No 'version' field — deprecated in Docker Compose v2

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: rotavans
      POSTGRES_PASSWORD: rotavans
      POSTGRES_DB: rotavans
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    command: redis-server --save 60 1 --loglevel warning

volumes:
  postgres_data:
```

- [ ] **Step 2: Start services and run migrations**

```bash
docker-compose up -d
# Wait for postgres to be ready
sleep 3

# Run both migrations
cd services/management-api && pnpm migrate
cd ../app-api && pnpm migrate
```

Expected output:
```
[migrate] applied 001_management_schema.sql
[migrate] done
[migrate] applied 001_app_schema.sql
[migrate] done
```

- [ ] **Step 3: Verify schemas in database**

```bash
docker exec -it $(docker ps -q -f name=postgres) psql -U rotavans -c "\dn"
```

Expected: schemas `management` and `app` both listed.

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml
git commit -m "chore: add docker-compose for local postgres + redis"
```

---

## Verification

- [ ] **Run all tests from root**

```bash
cd /path/to/rotavans && pnpm test
```

Expected: All tests PASS in both `management-api` and `app-api`.

- [ ] **Boot both services**

```bash
# Terminal 1
cd services/management-api && pnpm dev

# Terminal 2
cd services/app-api && pnpm dev
```

```bash
# Verify health endpoints
curl http://localhost:3000/health
# Expected: {"status":"ok","service":"management-api","ts":"..."}

curl http://localhost:3001/health
# Expected: {"status":"ok","service":"app-api","ts":"..."}
```

---

## What's Next

- **Plan 2:** `management-api` — auth, tenants CRUD, modules, licenses, invites, monitoring dashboard, anomaly detection cron
- **Plan 3:** `app-api` — auth, all business routes, Socket.io, module guard, tablet binding
- **Plan 4:** Apps — web/mobile/desktop URL updates
