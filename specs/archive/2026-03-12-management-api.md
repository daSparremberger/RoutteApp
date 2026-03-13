# Architecture Rewrite — Plan 2: management-api

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the complete `management-api` service: superadmin Firebase auth, tenant CRUD, module management, license control, gestor invite generation, monitoring dashboard, anomaly detection cron, and Redis event bus (publish + subscribe).

**Architecture:** Express + TypeScript service. Reads/writes only to `management` schema. Publishes Redis events when tenant/module/license state changes. Subscribes to Redis events from `app-api` to write audit logs and metrics. Cron job runs every 15 minutes to detect license anomalies, guarded by a Redis distributed lock.

**Tech Stack:** Express, TypeScript, pg (PostgreSQL), ioredis, firebase-admin, jsonwebtoken, node-cron, Jest + Supertest.

**Prerequisite:** Plan 1 (Foundation) must be complete. Both schemas must exist in the database. `packages/shared` must be built.

> **Shared package update required (Task 11):** The `auth:login` event payload in `packages/shared/src/events.ts` must include `firebase_uid?: string` so the management-api subscriber can populate the `audit_logs.user_firebase_uid` column. This is a one-line change to the shared package made as part of Task 11.

**Spec:** `docs/superpowers/specs/2026-03-11-architecture-rewrite-design.md`

---

## Chunk 1: Auth and Middleware

### Task 1: Firebase Admin initialization

**Files:**
- Create: `services/management-api/src/lib/firebase.ts`
- Create: `services/management-api/src/__tests__/lib/firebase.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/firebase.test.ts
import { getFirebaseAdmin } from '../../lib/firebase';

describe('getFirebaseAdmin', () => {
  it('returns a Firebase Admin app instance', () => {
    const admin = getFirebaseAdmin();
    expect(admin).toBeDefined();
    expect(typeof admin.auth).toBe('function');
  });

  it('returns the same instance on repeated calls', () => {
    const a = getFirebaseAdmin();
    const b = getFirebaseAdmin();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
cd services/management-api && pnpm test -- --testPathPattern=firebase
```

Expected: FAIL — `Cannot find module '../../lib/firebase'`

- [ ] **Step 3: Implement**

```typescript
// src/lib/firebase.ts
import * as admin from 'firebase-admin';

let _app: admin.app.App | null = null;

export function getFirebaseAdmin(): admin.app.App {
  if (_app) return _app;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (clientEmail && privateKey) {
    _app = admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    // Test/local environment without service account credentials
    _app = admin.initializeApp({ projectId });
  }

  return _app;
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=firebase
```

- [ ] **Step 5: Commit**

```bash
git add services/management-api/src/lib/ services/management-api/src/__tests__/lib/
git commit -m "feat(management-api): initialize Firebase Admin SDK"
```

---

### Task 2: JWT utilities

**Files:**
- Create: `services/management-api/src/lib/jwt.ts`
- Create: `services/management-api/src/__tests__/lib/jwt.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/lib/jwt.test.ts
import { signManagementToken, verifyManagementToken } from '../../lib/jwt';

beforeAll(() => {
  process.env.MANAGEMENT_JWT_SECRET = 'test-management-secret-32-chars-ok';
});

describe('signManagementToken', () => {
  it('returns a JWT string', () => {
    const token = signManagementToken({ sub: 'firebase-uid-123', role: 'superadmin' });
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });
});

describe('verifyManagementToken', () => {
  it('decodes a valid token', () => {
    const token = signManagementToken({ sub: 'uid-abc', role: 'superadmin' });
    const payload = verifyManagementToken(token);
    expect(payload?.sub).toBe('uid-abc');
    expect(payload?.role).toBe('superadmin');
  });

  it('returns null for an invalid token', () => {
    const payload = verifyManagementToken('not.a.token');
    expect(payload).toBeNull();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=jwt
```

- [ ] **Step 3: Implement**

```typescript
// src/lib/jwt.ts
import jwt from 'jsonwebtoken';
import type { ManagementTokenPayload } from '@rotavans/shared';

function getSecret(): string {
  const secret = process.env.MANAGEMENT_JWT_SECRET;
  if (!secret) throw new Error('MANAGEMENT_JWT_SECRET is not set');
  return secret;
}

export function signManagementToken(
  payload: Omit<ManagementTokenPayload, 'iat' | 'exp'>
): string {
  return jwt.sign(payload, getSecret(), { expiresIn: '30d' });
}

export function verifyManagementToken(token: string): ManagementTokenPayload | null {
  try {
    return jwt.verify(token, getSecret()) as ManagementTokenPayload;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=jwt
```

- [ ] **Step 5: Commit**

```bash
git add services/management-api/src/lib/jwt.ts services/management-api/src/__tests__/lib/jwt.test.ts
git commit -m "feat(management-api): add JWT sign/verify for superadmin tokens"
```

---

### Task 3: Auth middleware

**Files:**
- Create: `services/management-api/src/middleware/auth.ts`
- Create: `services/management-api/src/__tests__/middleware/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/middleware/auth.test.ts
import { Request, Response } from 'express';
import { requireSuperAdmin } from '../../middleware/auth';
import { signManagementToken } from '../../lib/jwt';

beforeAll(() => {
  process.env.MANAGEMENT_JWT_SECRET = 'test-management-secret-32-chars-ok';
});

function makeReq(authHeader?: string): Partial<Request> {
  return { headers: { authorization: authHeader } } as any;
}

function makeRes(): { status: jest.Mock; json: jest.Mock; locals: Record<string, unknown> } {
  const res = { locals: {} } as any;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('requireSuperAdmin', () => {
  it('calls next() with a valid superadmin token', () => {
    const token = signManagementToken({ sub: 'uid-123', role: 'superadmin' });
    const req = makeReq(`Bearer ${token}`);
    const res = makeRes();
    const next = jest.fn();

    requireSuperAdmin(req as Request, res as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect((req as any).admin).toMatchObject({ sub: 'uid-123', role: 'superadmin' });
  });

  it('returns 401 when no token is provided', () => {
    const req = makeReq();
    const res = makeRes();
    const next = jest.fn();

    requireSuperAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for an invalid token', () => {
    const req = makeReq('Bearer invalid.token.here');
    const res = makeRes();
    const next = jest.fn();

    requireSuperAdmin(req as Request, res as Response, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=auth
```

- [ ] **Step 3: Implement**

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import { verifyManagementToken } from '../lib/jwt';
import type { ManagementTokenPayload } from '@rotavans/shared';

export interface AdminRequest extends Request {
  admin: ManagementTokenPayload;
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token ausente' });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyManagementToken(token);

  if (!payload || payload.role !== 'superadmin') {
    res.status(401).json({ error: 'Token invalido' });
    return;
  }

  (req as AdminRequest).admin = payload;
  next();
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=auth
```

- [ ] **Step 5: Commit**

```bash
git add services/management-api/src/middleware/ services/management-api/src/__tests__/middleware/
git commit -m "feat(management-api): add requireSuperAdmin middleware"
```

---

### Task 4: Auth login route

**Files:**
- Create: `services/management-api/src/routes/auth.ts`
- Create: `services/management-api/src/__tests__/routes/auth.test.ts`
- Modify: `services/management-api/src/app.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/routes/auth.test.ts
import request from 'supertest';
import { createApp } from '../../app';

// Mock Firebase Admin to avoid real token verification in tests
jest.mock('../../lib/firebase', () => ({
  getFirebaseAdmin: () => ({
    auth: () => ({
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: 'firebase-uid-test',
        email: 'admin@rotavans.com',
        name: 'Admin Test',
      }),
    }),
  }),
}));

describe('POST /auth/login', () => {
  const app = createApp();

  it('returns 400 when no token is provided', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
  });

  it('returns 200 with a management JWT for a valid Firebase token', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ firebase_id_token: 'valid-firebase-token' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.role).toBe('superadmin');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=routes/auth
```

- [ ] **Step 3: Implement the auth route**

```typescript
// src/routes/auth.ts
import { Router } from 'express';
import { getFirebaseAdmin } from '../lib/firebase';
import { signManagementToken } from '../lib/jwt';

const router = Router();

router.post('/login', async (req, res) => {
  const { firebase_id_token } = req.body as { firebase_id_token?: string };

  if (!firebase_id_token) {
    return res.status(400).json({ error: 'firebase_id_token is required' });
  }

  try {
    const decodedToken = await getFirebaseAdmin().auth().verifyIdToken(firebase_id_token);
    const token = signManagementToken({ sub: decodedToken.uid, role: 'superadmin' });
    return res.json({ token, role: 'superadmin' });
  } catch {
    return res.status(401).json({ error: 'Token Firebase invalido' });
  }
});

export default router;
```

- [ ] **Step 4: Register route in app.ts**

```typescript
// src/app.ts
import express from 'express';
import cors from 'cors';
import authRouter from './routes/auth';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'management-api', ts: new Date().toISOString() });
  });

  app.use('/auth', authRouter);

  return app;
}
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=routes/auth
```

- [ ] **Step 6: Commit**

```bash
git add services/management-api/src/routes/auth.ts services/management-api/src/app.ts services/management-api/src/__tests__/routes/
git commit -m "feat(management-api): add superadmin login route"
```

---

## Chunk 2: Tenant, Module, and License Management

### Task 5: Tenant CRUD routes

**Files:**
- Create: `services/management-api/src/routes/tenants.ts`
- Create: `services/management-api/src/__tests__/routes/tenants.test.ts`

> **Note:** These tests require a real PostgreSQL connection. Set `DATABASE_URL` in `.env.test` pointing to a test database. Each test cleans up its own data.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/routes/tenants.test.ts
import request from 'supertest';
import { createApp } from '../../app';
import { pool } from '../../db/pool';
import { signManagementToken } from '../../lib/jwt';

const app = createApp();
const adminToken = signManagementToken({ sub: 'test-uid', role: 'superadmin' });
const authHeader = `Bearer ${adminToken}`;

afterEach(async () => {
  await pool.query("DELETE FROM management.tenants WHERE nome LIKE 'Test%'");
});

afterAll(async () => {
  await pool.end();
});

describe('POST /tenants', () => {
  it('creates a tenant with required fields', async () => {
    const res = await request(app)
      .post('/tenants')
      .set('Authorization', authHeader)
      .send({ nome: 'Test Prefeitura', cidade: 'Sao Paulo', estado: 'SP' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.nome).toBe('Test Prefeitura');
  });

  it('returns 400 when required fields are missing', async () => {
    const res = await request(app)
      .post('/tenants')
      .set('Authorization', authHeader)
      .send({ nome: 'Test Only' });

    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/tenants').send({ nome: 'X', cidade: 'Y', estado: 'Z' });
    expect(res.status).toBe(401);
  });
});

describe('GET /tenants', () => {
  it('returns a list of tenants', async () => {
    await pool.query(
      "INSERT INTO management.tenants (nome, cidade, estado) VALUES ('Test List', 'Rio', 'RJ')"
    );
    const res = await request(app).get('/tenants').set('Authorization', authHeader);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /tenants/:id', () => {
  it('returns 404 for unknown tenant', async () => {
    const res = await request(app).get('/tenants/999999').set('Authorization', authHeader);
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=routes/tenants
```

- [ ] **Step 3: Implement**

```typescript
// src/routes/tenants.ts
import { Router } from 'express';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router();
router.use(requireSuperAdmin);

router.get('/', async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*,
        l.max_veiculos, l.max_motoristas, l.max_gestores, l.ativo as license_ativo,
        (SELECT COUNT(*) FROM management.tenant_modules tm
         WHERE tm.tenant_id = t.id AND tm.habilitado = true) as modulos_habilitados
      FROM management.tenants t
      LEFT JOIN management.licenses l ON l.tenant_id = t.id AND l.ativo = true
      ORDER BY t.criado_em DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/', async (req, res) => {
  const { nome, cidade, estado, cnpj, email_contato } = req.body as Record<string, string>;
  if (!nome || !cidade || !estado) {
    return res.status(400).json({ error: 'nome, cidade e estado sao obrigatorios' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const tenantResult = await client.query(
      `INSERT INTO management.tenants (nome, cidade, estado, cnpj, email_contato)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nome, cidade, estado, cnpj || null, email_contato || null]
    );
    const tenant = tenantResult.rows[0];

    // Create default license
    await client.query(
      `INSERT INTO management.licenses (tenant_id, max_veiculos, max_motoristas, max_gestores, data_inicio)
       VALUES ($1, 10, 10, 3, CURRENT_DATE)`,
      [tenant.id]
    );

    // Enable all active modules by default
    await client.query(
      `INSERT INTO management.tenant_modules (tenant_id, module_id)
       SELECT $1, id FROM management.modules WHERE ativo = true`,
      [tenant.id]
    );

    await client.query('COMMIT');
    res.status(201).json(tenant);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  } finally {
    client.release();
  }
});

router.get('/:id', async (req, res) => {
  try {
    const tenantResult = await pool.query(
      'SELECT * FROM management.tenants WHERE id = $1',
      [req.params.id]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ error: 'Tenant nao encontrado' });
    }

    const [licenseResult, modulesResult, metricsResult] = await Promise.all([
      pool.query(
        'SELECT * FROM management.licenses WHERE tenant_id = $1 AND ativo = true LIMIT 1',
        [req.params.id]
      ),
      pool.query(
        `SELECT m.slug, m.nome, tm.habilitado
         FROM management.tenant_modules tm
         JOIN management.modules m ON m.id = tm.module_id
         WHERE tm.tenant_id = $1`,
        [req.params.id]
      ),
      pool.query(
        `SELECT * FROM management.tenant_metrics
         WHERE tenant_id = $1
         ORDER BY data DESC LIMIT 30`,
        [req.params.id]
      ),
    ]);

    res.json({
      ...tenantResult.rows[0],
      license: licenseResult.rows[0] || null,
      modules: modulesResult.rows,
      metrics: metricsResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/:id', async (req, res) => {
  const { nome, cidade, estado, cnpj, email_contato, ativo } = req.body as Record<string, unknown>;
  try {
    const result = await pool.query(
      `UPDATE management.tenants SET
         nome = COALESCE($1, nome),
         cidade = COALESCE($2, cidade),
         estado = COALESCE($3, estado),
         cnpj = COALESCE($4, cnpj),
         email_contato = COALESCE($5, email_contato),
         ativo = COALESCE($6, ativo),
         atualizado_em = NOW()
       WHERE id = $7 RETURNING *`,
      [nome, cidade, estado, cnpj, email_contato, ativo, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant nao encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE management.tenants SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING *",
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tenant nao encontrado' });
    res.json({ message: 'Tenant desativado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
```

- [ ] **Step 4: Register route in app.ts**

Add to `src/app.ts`:
```typescript
import tenantsRouter from './routes/tenants';
// ...
app.use('/tenants', tenantsRouter);
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=routes/tenants
```

- [ ] **Step 6: Commit**

```bash
git add services/management-api/src/routes/tenants.ts services/management-api/src/__tests__/routes/tenants.test.ts services/management-api/src/app.ts
git commit -m "feat(management-api): add tenant CRUD routes"
```

---

### Task 6: License and module management routes

**Files:**
- Create: `services/management-api/src/routes/licenses.ts`
- Create: `services/management-api/src/routes/modules.ts`
- Create: `services/management-api/src/__tests__/routes/licenses.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/__tests__/routes/licenses.test.ts
import request from 'supertest';
import { createApp } from '../../app';
import { pool } from '../../db/pool';
import { signManagementToken } from '../../lib/jwt';

const app = createApp();
const auth = `Bearer ${signManagementToken({ sub: 'uid', role: 'superadmin' })}`;
let tenantId: number;

beforeAll(async () => {
  const r = await pool.query(
    "INSERT INTO management.tenants (nome, cidade, estado) VALUES ('Test Lic', 'SP', 'SP') RETURNING id"
  );
  tenantId = r.rows[0].id;
  await pool.query(
    'INSERT INTO management.licenses (tenant_id, max_veiculos, max_motoristas, max_gestores, data_inicio) VALUES ($1, 5, 5, 2, CURRENT_DATE)',
    [tenantId]
  );
});

afterAll(async () => {
  await pool.query('DELETE FROM management.tenants WHERE id = $1', [tenantId]);
  await pool.end();
});

describe('PUT /tenants/:id/license', () => {
  it('updates license limits', async () => {
    const res = await request(app)
      .put(`/tenants/${tenantId}/license`)
      .set('Authorization', auth)
      .send({ max_veiculos: 20, max_motoristas: 15, max_gestores: 5 });

    expect(res.status).toBe(200);
    expect(res.body.max_veiculos).toBe(20);
  });

  it('returns 404 for unknown tenant', async () => {
    const res = await request(app)
      .put('/tenants/999999/license')
      .set('Authorization', auth)
      .send({ max_veiculos: 10 });
    expect(res.status).toBe(404);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=licenses
```

- [ ] **Step 3: Implement licenses route**

```typescript
// src/routes/licenses.ts
import { Router } from 'express';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(requireSuperAdmin);

router.put('/', async (req, res) => {
  const { id } = req.params;
  const { max_veiculos, max_motoristas, max_gestores, data_fim } = req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE management.licenses SET
         max_veiculos  = COALESCE($1, max_veiculos),
         max_motoristas = COALESCE($2, max_motoristas),
         max_gestores   = COALESCE($3, max_gestores),
         data_fim       = COALESCE($4, data_fim)
       WHERE tenant_id = $5 AND ativo = true RETURNING *`,
      [max_veiculos, max_motoristas, max_gestores, data_fim, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Licenca nao encontrada' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
```

- [ ] **Step 4: Implement modules route**

```typescript
// src/routes/modules.ts
import { Router } from 'express';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router();
router.use(requireSuperAdmin);

// GET /modules — list all available modules
router.get('/', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM management.modules ORDER BY slug');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// PUT /tenants/:id/modules — enable or disable a module for a tenant
// Body: { slug: string, habilitado: boolean }
const tenantModulesRouter = Router({ mergeParams: true });
tenantModulesRouter.use(requireSuperAdmin);

tenantModulesRouter.put('/', async (req, res) => {
  const { id } = req.params;
  const { slug, habilitado } = req.body as { slug: string; habilitado: boolean };

  if (!slug || typeof habilitado !== 'boolean') {
    return res.status(400).json({ error: 'slug e habilitado sao obrigatorios' });
  }

  try {
    const moduleResult = await pool.query(
      'SELECT id FROM management.modules WHERE slug = $1',
      [slug]
    );
    if (moduleResult.rows.length === 0) {
      return res.status(404).json({ error: 'Modulo nao encontrado' });
    }
    const moduleId = moduleResult.rows[0].id;

    await pool.query(
      `INSERT INTO management.tenant_modules (tenant_id, module_id, habilitado)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, module_id) DO UPDATE
         SET habilitado = $3,
             habilitado_em = CASE WHEN $3 THEN NOW() ELSE habilitado_em END,
             desabilitado_em = CASE WHEN NOT $3 THEN NOW() ELSE NULL END`,
      [id, moduleId, habilitado]
    );

    res.json({ tenant_id: Number(id), slug, habilitado });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export { router as modulesRouter, tenantModulesRouter };
```

- [ ] **Step 5: Register in app.ts**

```typescript
import licenseRouter from './routes/licenses';
import { modulesRouter, tenantModulesRouter } from './routes/modules';
// ...
app.use('/modules', modulesRouter);
app.use('/tenants/:id/license', licenseRouter);
app.use('/tenants/:id/modules', tenantModulesRouter);
```

- [ ] **Step 6: Run tests — expect PASS**

```bash
pnpm test -- --testPathPattern=licenses
```

- [ ] **Step 7: Commit**

```bash
git add services/management-api/src/routes/licenses.ts services/management-api/src/routes/modules.ts services/management-api/src/__tests__/routes/licenses.test.ts services/management-api/src/app.ts
git commit -m "feat(management-api): add license and module management routes"
```

---

### Task 7: Gestor invite generation

**Files:**
- Create: `services/management-api/src/routes/invites.ts`
- Create: `services/management-api/src/__tests__/routes/invites.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/routes/invites.test.ts
import request from 'supertest';
import { createApp } from '../../app';
import { pool } from '../../db/pool';
import { signManagementToken } from '../../lib/jwt';

const app = createApp();
const auth = `Bearer ${signManagementToken({ sub: 'uid', role: 'superadmin' })}`;
let tenantId: number;

beforeAll(async () => {
  const r = await pool.query(
    "INSERT INTO management.tenants (nome, cidade, estado) VALUES ('Test Invite', 'SP', 'SP') RETURNING id"
  );
  tenantId = r.rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM management.tenants WHERE id = $1', [tenantId]);
  await pool.end();
});

describe('POST /tenants/:id/invite', () => {
  it('creates an invite and returns a link', async () => {
    process.env.APP_URL = 'https://app.rotavans.com';
    const res = await request(app)
      .post(`/tenants/${tenantId}/invite`)
      .set('Authorization', auth)
      .send({ email: 'gestor@empresa.com', dias_validade: 7 });

    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.link).toContain(res.body.token);
  });
});

describe('GET /tenants/:id/invites', () => {
  it('returns the list of invites for a tenant', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/invites`)
      .set('Authorization', auth);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=invites
```

- [ ] **Step 3: Implement**

```typescript
// src/routes/invites.ts
import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(requireSuperAdmin);

router.post('/', async (req, res) => {
  const { id } = req.params;
  const { email, dias_validade = 7 } = req.body as { email?: string; dias_validade?: number };

  try {
    const tenant = await pool.query(
      'SELECT id FROM management.tenants WHERE id = $1 AND ativo = true',
      [id]
    );
    if (tenant.rows.length === 0) return res.status(404).json({ error: 'Tenant nao encontrado' });

    const token = crypto.randomBytes(32).toString('hex');
    const expira_em = new Date();
    expira_em.setDate(expira_em.getDate() + dias_validade);

    const result = await pool.query(
      `INSERT INTO management.gestor_invites (tenant_id, token, email, expira_em)
       VALUES ($1, $2, $3, $4) RETURNING id, token, email, expira_em`,
      [id, token, email || null, expira_em]
    );

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const invite = result.rows[0];

    res.status(201).json({
      ...invite,
      link: `${appUrl}/convite/${invite.token}`,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, token, email, usado, expira_em, criado_em
       FROM management.gestor_invites
       WHERE tenant_id = $1
       ORDER BY criado_em DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
```

- [ ] **Step 4: Register in app.ts**

```typescript
import invitesRouter from './routes/invites';
// ...
app.use('/tenants/:id/invite', invitesRouter);   // POST (singular)
app.use('/tenants/:id/invites', invitesRouter);   // GET (plural)
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=invites
```

- [ ] **Step 6: Commit**

```bash
git add services/management-api/src/routes/invites.ts services/management-api/src/__tests__/routes/invites.test.ts services/management-api/src/app.ts
git commit -m "feat(management-api): add gestor invite generation"
```

---

## Chunk 3: Monitoring and Dashboard

### Task 8: Monitoring routes (metrics, devices, audit)

**Files:**
- Create: `services/management-api/src/routes/monitoring.ts`
- Create: `services/management-api/src/__tests__/routes/monitoring.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/routes/monitoring.test.ts
import request from 'supertest';
import { createApp } from '../../app';
import { pool } from '../../db/pool';
import { signManagementToken } from '../../lib/jwt';

const app = createApp();
const auth = `Bearer ${signManagementToken({ sub: 'uid', role: 'superadmin' })}`;
let tenantId: number;

beforeAll(async () => {
  const r = await pool.query(
    "INSERT INTO management.tenants (nome, cidade, estado) VALUES ('Test Monitor', 'SP', 'SP') RETURNING id"
  );
  tenantId = r.rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM management.tenants WHERE id = $1', [tenantId]);
  await pool.end();
});

describe('GET /tenants/:id/metrics', () => {
  it('returns an empty array when no metrics exist', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/metrics`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('GET /tenants/:id/audit', () => {
  it('returns paginated audit log', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/audit?page=1&limit=10`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toBeDefined();
    expect(res.body.total).toBeDefined();
  });
});

describe('GET /tenants/:id/devices', () => {
  it('returns unique device list from audit logs', async () => {
    const res = await request(app)
      .get(`/tenants/${tenantId}/devices`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=monitoring
```

- [ ] **Step 3: Implement**

```typescript
// src/routes/monitoring.ts
import { Router } from 'express';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router({ mergeParams: true });
router.use(requireSuperAdmin);

// GET /tenants/:id/metrics?from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/metrics', async (req, res) => {
  const { id } = req.params;
  const { from, to } = req.query as { from?: string; to?: string };

  try {
    const result = await pool.query(
      `SELECT * FROM management.tenant_metrics
       WHERE tenant_id = $1
         AND ($2::date IS NULL OR data >= $2::date)
         AND ($3::date IS NULL OR data <= $3::date)
       ORDER BY data ASC`,
      [id, from || null, to || null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /tenants/:id/audit?page=1&limit=50
router.get('/audit', async (req, res) => {
  const { id } = req.params;
  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(100, parseInt(req.query.limit as string) || 50);
  const offset = (page - 1) * limit;

  try {
    const [data, count] = await Promise.all([
      pool.query(
        `SELECT * FROM management.audit_logs
         WHERE tenant_id = $1
         ORDER BY criado_em DESC
         LIMIT $2 OFFSET $3`,
        [id, limit, offset]
      ),
      pool.query(
        'SELECT COUNT(*) FROM management.audit_logs WHERE tenant_id = $1',
        [id]
      ),
    ]);
    res.json({ data: data.rows, total: parseInt(count.rows[0].count), page, limit });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

// GET /tenants/:id/devices — unique device_ids seen
router.get('/devices', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT DISTINCT device_id, MAX(criado_em) as ultimo_acesso
       FROM management.audit_logs
       WHERE tenant_id = $1 AND device_id IS NOT NULL
       GROUP BY device_id
       ORDER BY ultimo_acesso DESC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
```

- [ ] **Step 4: Register in app.ts**

```typescript
import monitoringRouter from './routes/monitoring';
// ...
app.use('/tenants/:id', monitoringRouter);
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=monitoring
```

- [ ] **Step 6: Commit**

```bash
git add services/management-api/src/routes/monitoring.ts services/management-api/src/__tests__/routes/monitoring.test.ts services/management-api/src/app.ts
git commit -m "feat(management-api): add monitoring routes (metrics, audit, devices)"
```

---

### Task 9: Anomaly alerts routes + dashboard

**Files:**
- Create: `services/management-api/src/routes/anomalies.ts`
- Create: `services/management-api/src/routes/dashboard.ts`
- Create: `services/management-api/src/__tests__/routes/anomalies.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/routes/anomalies.test.ts
import request from 'supertest';
import { createApp } from '../../app';
import { pool } from '../../db/pool';
import { signManagementToken } from '../../lib/jwt';

const app = createApp();
const auth = `Bearer ${signManagementToken({ sub: 'uid', role: 'superadmin' })}`;
let tenantId: number;
let alertId: number;

beforeAll(async () => {
  const r = await pool.query(
    "INSERT INTO management.tenants (nome, cidade, estado) VALUES ('Test Anomaly', 'SP', 'SP') RETURNING id"
  );
  tenantId = r.rows[0].id;
  const a = await pool.query(
    `INSERT INTO management.anomaly_alerts (tenant_id, tipo, descricao, severidade)
     VALUES ($1, 'devices_over_limit', 'Test alert', 'critical') RETURNING id`,
    [tenantId]
  );
  alertId = a.rows[0].id;
});

afterAll(async () => {
  await pool.query('DELETE FROM management.tenants WHERE id = $1', [tenantId]);
  await pool.end();
});

describe('GET /anomalies', () => {
  it('returns open alerts', async () => {
    const res = await request(app).get('/anomalies').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((a: any) => a.id === alertId)).toBe(true);
  });

  it('filters by tenant_id', async () => {
    const res = await request(app)
      .get(`/anomalies?tenant_id=${tenantId}`)
      .set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.every((a: any) => a.tenant_id === tenantId)).toBe(true);
  });
});

describe('PATCH /anomalies/:id/resolve', () => {
  it('marks an alert as resolved with a note', async () => {
    const res = await request(app)
      .patch(`/anomalies/${alertId}/resolve`)
      .set('Authorization', auth)
      .send({ nota: 'Cliente notificado e upgrade contratado' });

    expect(res.status).toBe(200);
    expect(res.body.resolvido).toBe(true);
    expect(res.body.nota_resolucao).toBe('Cliente notificado e upgrade contratado');
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=anomalies
```

- [ ] **Step 3: Implement anomalies route**

```typescript
// src/routes/anomalies.ts
import { Router } from 'express';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router();
router.use(requireSuperAdmin);

router.get('/', async (req, res) => {
  const { tenant_id } = req.query as { tenant_id?: string };
  try {
    const result = await pool.query(
      `SELECT a.*, t.nome as tenant_nome
       FROM management.anomaly_alerts a
       JOIN management.tenants t ON t.id = a.tenant_id
       WHERE a.resolvido = false
         AND ($1::int IS NULL OR a.tenant_id = $1::int)
       ORDER BY
         CASE a.severidade WHEN 'critical' THEN 1 WHEN 'warning' THEN 2 ELSE 3 END,
         a.criado_em DESC`,
      [tenant_id ? parseInt(tenant_id) : null]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.patch('/:id/resolve', async (req, res) => {
  const { nota } = req.body as { nota?: string };
  try {
    const result = await pool.query(
      `UPDATE management.anomaly_alerts SET
         resolvido = true, resolvido_em = NOW(), nota_resolucao = $1
       WHERE id = $2 RETURNING *`,
      [nota || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alerta nao encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
```

- [ ] **Step 4: Implement dashboard route**

```typescript
// src/routes/dashboard.ts
import { Router } from 'express';
import { pool } from '../db/pool';
import { requireSuperAdmin } from '../middleware/auth';

const router = Router();
router.use(requireSuperAdmin);

router.get('/', async (_req, res) => {
  try {
    const [tenantsResult, alertsResult, topUsageResult] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE ativo = true) AS total_ativos,
          COUNT(*) AS total_geral
        FROM management.tenants
      `),
      pool.query(`
        SELECT severidade, COUNT(*) as total
        FROM management.anomaly_alerts
        WHERE resolvido = false
        GROUP BY severidade
      `),
      pool.query(`
        SELECT t.id, t.nome, t.cidade,
          COALESCE(m.total_requests, 0) as requests_hoje
        FROM management.tenants t
        LEFT JOIN management.tenant_metrics m
          ON m.tenant_id = t.id AND m.data = CURRENT_DATE
        WHERE t.ativo = true
        ORDER BY requests_hoje DESC
        LIMIT 10
      `),
    ]);

    res.json({
      tenants: tenantsResult.rows[0],
      alertas_abertos: alertsResult.rows,
      top_tenants_hoje: topUsageResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
```

- [ ] **Step 5: Register in app.ts**

```typescript
import anomaliesRouter from './routes/anomalies';
import dashboardRouter from './routes/dashboard';
// ...
app.use('/anomalies', anomaliesRouter);
app.use('/dashboard', dashboardRouter);
```

- [ ] **Step 6: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=anomalies
```

- [ ] **Step 7: Commit**

```bash
git add services/management-api/src/routes/anomalies.ts services/management-api/src/routes/dashboard.ts services/management-api/src/__tests__/routes/anomalies.test.ts services/management-api/src/app.ts
git commit -m "feat(management-api): add anomaly alerts and dashboard routes"
```

---

## Chunk 4: Redis Event Bus and Anomaly Detection Cron

### Task 10: Redis event publisher

**Files:**
- Create: `services/management-api/src/events/publisher.ts`
- Create: `services/management-api/src/__tests__/events/publisher.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/events/publisher.test.ts
import { publishEvent } from '../../events/publisher';

const mockRedis = { publish: jest.fn().mockResolvedValue(1) };
jest.mock('../../redis/client', () => ({
  getRedis: () => mockRedis,
}));

describe('publishEvent', () => {
  beforeEach(() => mockRedis.publish.mockClear());

  it('publishes a serialized event to the correct Redis channel', async () => {
    await publishEvent('tenant:created', { tenant_id: 42 });

    expect(mockRedis.publish).toHaveBeenCalledTimes(1);
    const [channel, message] = mockRedis.publish.mock.calls[0];
    expect(channel).toBe('tenant:created');
    const payload = JSON.parse(message);
    expect(payload.tenant_id).toBe(42);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=events/publisher
```

- [ ] **Step 3: Implement**

```typescript
// src/events/publisher.ts
import { getRedis } from '../redis/client';
import type { CrossServiceEvent, EventPayload } from '@rotavans/shared';

export async function publishEvent<E extends CrossServiceEvent>(
  event: E,
  payload: EventPayload<E>
): Promise<void> {
  await getRedis().publish(event, JSON.stringify(payload));
}
```

- [ ] **Step 4: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=events/publisher
```

- [ ] **Step 5: Wire publisher into tenant and module routes**

In `src/routes/tenants.ts`, after successful POST (tenant created):
```typescript
import { publishEvent } from '../events/publisher';
// After COMMIT in POST /:
await publishEvent('tenant:created', { tenant_id: tenant.id });
```

In `src/routes/tenants.ts`, in DELETE (soft delete):
```typescript
// After UPDATE in DELETE /:id:
await publishEvent('tenant:deactivated', { tenant_id: Number(req.params.id) });
```

In `src/routes/licenses.ts`, after update:
```typescript
import { publishEvent } from '../events/publisher';
// After UPDATE:
const lic = result.rows[0];
await publishEvent('license:updated', {
  tenant_id: Number(id),
  max_veiculos: lic.max_veiculos,
  max_motoristas: lic.max_motoristas,
  max_gestores: lic.max_gestores,
});
```

In `src/routes/modules.ts`, after update:
```typescript
await publishEvent(habilitado ? 'module:enabled' : 'module:disabled', {
  tenant_id: Number(id), module_slug: slug,
});
```

- [ ] **Step 6: Commit**

```bash
git add services/management-api/src/events/ services/management-api/src/__tests__/events/ services/management-api/src/routes/
git commit -m "feat(management-api): add Redis event publisher and wire into routes"
```

---

### Task 11: Redis event subscriber (from app-api)

**Files:**
- Modify: `packages/shared/src/events.ts` (add `firebase_uid?` to `auth:login` payload)
- Create: `services/management-api/src/events/subscriber.ts`
- Create: `services/management-api/src/__tests__/events/subscriber.test.ts`

- [ ] **Step 1: Update shared events.ts — add firebase_uid to auth:login payload**

In `packages/shared/src/events.ts`, update the `auth:login` entry:
```typescript
'auth:login': {
  tenant_id: number;
  user_id: number;
  role: 'gestor' | 'motorista';
  firebase_uid?: string;   // ADD: needed by management-api audit_logs
  ip: string;
  device_id?: string;
  user_agent?: string;
};
```
Rebuild: `cd packages/shared && pnpm build`

- [ ] **Step 2: Write the failing test**

```typescript
// src/__tests__/events/subscriber.test.ts
import { handleAuthLogin, handleAuthDeviceSeen } from '../../events/subscriber';
import { pool } from '../../db/pool';

// jest.mock calls must be at module scope — they are hoisted before any imports
jest.mock('../../db/pool', () => ({
  pool: { query: jest.fn().mockResolvedValue({ rows: [] }) },
}));

const mockRedis = {
  sadd: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
};
jest.mock('../../redis/client', () => ({
  getRedis: () => mockRedis,
}));

const mockPool = pool as { query: jest.Mock };

describe('handleAuthLogin', () => {
  beforeEach(() => mockPool.query.mockClear());

  it('inserts audit log with user_firebase_uid and upserts daily metrics', async () => {
    await handleAuthLogin({
      tenant_id: 1,
      user_id: 5,
      role: 'gestor',
      firebase_uid: 'firebase-uid-abc',
      ip: '192.168.1.1',
    });
    expect(mockPool.query).toHaveBeenCalledTimes(2);
    // Verify the INSERT uses user_firebase_uid column, not user_id
    const firstCall = mockPool.query.mock.calls[0][0] as string;
    expect(firstCall).toContain('user_firebase_uid');
    expect(firstCall).not.toContain('user_id');
  });
});

describe('handleAuthDeviceSeen', () => {
  beforeEach(() => {
    mockRedis.sadd.mockClear();
    mockRedis.expire.mockClear();
  });

  it('adds device_id to Redis set with correct key format and 48h TTL', async () => {
    await handleAuthDeviceSeen({ tenant_id: 1, device_id: 'device-abc', motorista_id: 3 });
    expect(mockRedis.sadd).toHaveBeenCalledTimes(1);
    expect(mockRedis.expire).toHaveBeenCalledTimes(1);
    const [key, value] = mockRedis.sadd.mock.calls[0];
    expect(key).toMatch(/^devices:1:\d{4}-\d{2}-\d{2}$/);
    expect(value).toBe('device-abc');
    const [, ttl] = mockRedis.expire.mock.calls[0];
    expect(ttl).toBe(48 * 60 * 60);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=subscriber
```

- [ ] **Step 3: Implement**

```typescript
// src/events/subscriber.ts
import { getRedis } from '../redis/client';
import { pool } from '../db/pool';
import type { EventPayloads } from '@rotavans/shared';

// Called by the subscription loop — exported for unit testing
export async function handleAuthLogin(payload: EventPayloads['auth:login']): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await Promise.all([
    pool.query(
      `INSERT INTO management.audit_logs
         (tenant_id, user_firebase_uid, user_role, action, ip, device_id, user_agent)
       VALUES ($1, $2, $3, 'login', $4, $5, $6)`,
      [payload.tenant_id, payload.firebase_uid || null, payload.role, payload.ip,
       payload.device_id || null, payload.user_agent || null]
    ),
    pool.query(
      `INSERT INTO management.tenant_metrics (tenant_id, data, total_logins)
       VALUES ($1, $2, 1)
       ON CONFLICT (tenant_id, data) DO UPDATE
         SET total_logins = tenant_metrics.total_logins + 1`,
      [payload.tenant_id, today]
    ),
  ]);
}

export async function handleAuthDeviceSeen(payload: EventPayloads['auth:device_seen']): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const redis = getRedis();
  const setKey = `devices:${payload.tenant_id}:${today}`;

  await redis.sadd(setKey, payload.device_id);
  await redis.expire(setKey, 48 * 60 * 60); // 48 hours TTL

  // Anomaly check is handled by the cron job — subscriber only maintains the set
}

export async function handleLocationUpdated(payload: EventPayloads['location:updated']): Promise<void> {
  if (!payload.veiculo_id) return;
  const today = new Date().toISOString().split('T')[0];
  const redis = getRedis();
  const setKey = `active_veiculos:${payload.tenant_id}:${today}`;
  await redis.sadd(setKey, String(payload.veiculo_id));
  await redis.expire(setKey, 48 * 60 * 60);
}

export async function handleExecucaoStarted(payload: EventPayloads['execucao:started']): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO management.tenant_metrics (tenant_id, data, execucoes_iniciadas)
     VALUES ($1, $2, 1)
     ON CONFLICT (tenant_id, data) DO UPDATE
       SET execucoes_iniciadas = tenant_metrics.execucoes_iniciadas + 1`,
    [payload.tenant_id, today]
  );
}

export async function handleExecucaoCompleted(payload: EventPayloads['execucao:completed']): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  await pool.query(
    `INSERT INTO management.tenant_metrics (tenant_id, data, execucoes_concluidas)
     VALUES ($1, $2, 1)
     ON CONFLICT (tenant_id, data) DO UPDATE
       SET execucoes_concluidas = tenant_metrics.execucoes_concluidas + 1`,
    [payload.tenant_id, today]
  );
}

// Starts the Redis subscriber loop — called once at service startup
export function startSubscriber(): void {
  const sub = getRedis().duplicate();

  sub.subscribe(
    'auth:login', 'auth:device_seen',
    'location:updated', 'execucao:started', 'execucao:completed',
    (err) => {
      if (err) console.error('[subscriber] subscribe error:', err);
      else console.log('[subscriber] subscribed to app-api events');
    }
  );

  sub.on('message', async (channel, message) => {
    try {
      const payload = JSON.parse(message);
      switch (channel) {
        case 'auth:login':        await handleAuthLogin(payload); break;
        case 'auth:device_seen':  await handleAuthDeviceSeen(payload); break;
        case 'location:updated':  await handleLocationUpdated(payload); break;
        case 'execucao:started':  await handleExecucaoStarted(payload); break;
        case 'execucao:completed':await handleExecucaoCompleted(payload); break;
      }
    } catch (err) {
      console.error(`[subscriber] error handling ${channel}:`, err);
    }
  });
}
```

- [ ] **Step 4: Start subscriber in index.ts**

```typescript
// In src/index.ts, after app.listen:
import { startSubscriber } from './events/subscriber';
startSubscriber();
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=subscriber
```

- [ ] **Step 6: Commit**

```bash
git add services/management-api/src/events/subscriber.ts services/management-api/src/__tests__/events/subscriber.test.ts services/management-api/src/index.ts
git commit -m "feat(management-api): add Redis subscriber for app-api events"
```

---

### Task 12: Anomaly detection cron

**Files:**
- Create: `services/management-api/src/cron/anomalyDetection.ts`
- Create: `services/management-api/src/__tests__/cron/anomalyDetection.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/__tests__/cron/anomalyDetection.test.ts
import { runAnomalyChecks } from '../../cron/anomalyDetection';
import { pool } from '../../db/pool';

jest.mock('../../db/pool', () => ({
  pool: { query: jest.fn() },
}));
jest.mock('../../redis/client', () => ({
  getRedis: () => ({
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    scard: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
  }),
}));

const mockPool = pool as jest.Mocked<typeof pool>;

describe('runAnomalyChecks', () => {
  beforeEach(() => (mockPool.query as jest.Mock).mockReset());

  it('acquires the Redis distributed lock before running', async () => {
    const { getRedis } = require('../../redis/client');
    const redis = getRedis();

    // Lock is already held by another instance
    redis.set.mockResolvedValueOnce(null);

    await runAnomalyChecks();

    // Should NOT query the database when lock is not acquired
    expect(mockPool.query).not.toHaveBeenCalled();
  });

  it('runs checks when the lock is acquired', async () => {
    const { getRedis } = require('../../redis/client');
    const redis = getRedis();

    redis.set.mockResolvedValueOnce('OK'); // lock acquired
    // Return empty tenant list
    (mockPool.query as jest.Mock).mockResolvedValue({ rows: [] });

    await runAnomalyChecks();

    expect(mockPool.query).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
pnpm test -- --testPathPattern=cron
```

- [ ] **Step 3: Implement**

```typescript
// src/cron/anomalyDetection.ts
import cron from 'node-cron';
import { pool } from '../db/pool';
import { getRedis } from '../redis/client';

const LOCK_KEY = 'cron:anomaly:lock';
const LOCK_TTL = 900; // 15 minutes in seconds

async function insertAlert(
  tenantId: number,
  tipo: string,
  descricao: string,
  severidade: 'info' | 'warning' | 'critical',
  dados: Record<string, unknown>
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO management.anomaly_alerts (tenant_id, tipo, descricao, severidade, dados)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, tipo, descricao, severidade, JSON.stringify(dados)]
    );
  } catch (err: any) {
    // Unique constraint violation = open alert already exists for this rule, skip
    if (err.code !== '23505') throw err;
  }
}

async function checkDevicesOverLimit(tenantId: number, maxVeiculos: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const redis = getRedis();
  const count = await redis.scard(`devices:${tenantId}:${today}`);
  if (count > maxVeiculos) {
    await insertAlert(
      tenantId,
      'devices_over_limit',
      `Tenant usando ${count} dispositivos, limite e ${maxVeiculos}`,
      'critical',
      { devices_today: count, max_veiculos: maxVeiculos }
    );
  }
}

async function checkMotoristasOverLimit(tenantId: number, maxMotoristas: number): Promise<void> {
  const result = await pool.query(
    'SELECT COUNT(*) as total FROM app.motoristas WHERE tenant_id = $1 AND ativo = true',
    [tenantId]
  );
  const count = parseInt(result.rows[0].total);
  if (count > maxMotoristas) {
    await insertAlert(
      tenantId,
      'motoristas_over_limit',
      `Tenant tem ${count} motoristas ativos, limite e ${maxMotoristas}`,
      'critical',
      { motoristas_ativos: count, max_motoristas: maxMotoristas }
    );
  }
}

async function checkLoginSpike(tenantId: number): Promise<void> {
  const result = await pool.query(
    `WITH last_hour AS (
       SELECT COUNT(*) as logins_1h FROM management.audit_logs
       WHERE tenant_id = $1 AND action = 'login'
         AND criado_em >= NOW() - INTERVAL '1 hour'
     ),
     avg_7days AS (
       SELECT COALESCE(AVG(total_logins), 0) as avg_hourly
       FROM (
         SELECT date_trunc('hour', criado_em) as h, COUNT(*) as total_logins
         FROM management.audit_logs
         WHERE tenant_id = $1 AND action = 'login'
           AND criado_em >= NOW() - INTERVAL '7 days'
           AND criado_em < NOW() - INTERVAL '1 hour'
         GROUP BY h
       ) hourly
     )
     SELECT last_hour.logins_1h, avg_7days.avg_hourly FROM last_hour, avg_7days`,
    [tenantId]
  );

  const { logins_1h, avg_hourly } = result.rows[0];
  if (avg_hourly > 0 && logins_1h > avg_hourly * 3) {
    await insertAlert(
      tenantId,
      'concurrent_logins_spike',
      `${logins_1h} logins na ultima hora vs media de ${Math.round(avg_hourly)}/h`,
      'warning',
      { logins_1h, avg_hourly }
    );
  }
}

async function checkRequestsSpike(tenantId: number): Promise<void> {
  const result = await pool.query(
    `WITH last_hour AS (
       SELECT COUNT(*) as requests_1h FROM management.audit_logs
       WHERE tenant_id = $1 AND action = 'api_request'
         AND criado_em >= NOW() - INTERVAL '1 hour'
     ),
     avg_7days AS (
       SELECT COALESCE(AVG(total), 0) as avg_hourly
       FROM (
         SELECT date_trunc('hour', criado_em) as h, COUNT(*) as total
         FROM management.audit_logs
         WHERE tenant_id = $1 AND action = 'api_request'
           AND criado_em >= NOW() - INTERVAL '7 days'
           AND criado_em < NOW() - INTERVAL '1 hour'
         GROUP BY h
       ) hourly
     )
     SELECT last_hour.requests_1h, avg_7days.avg_hourly FROM last_hour, avg_7days`,
    [tenantId]
  );
  const { requests_1h, avg_hourly } = result.rows[0];
  if (avg_hourly > 0 && requests_1h > avg_hourly * 5) {
    await insertAlert(
      tenantId,
      'requests_spike',
      `${requests_1h} requests na ultima hora vs media de ${Math.round(avg_hourly)}/h`,
      'warning',
      { requests_1h, avg_hourly }
    );
  }
}

async function checkInactiveThenBurst(tenantId: number): Promise<void> {
  const result = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM management.audit_logs
        WHERE tenant_id = $1
          AND criado_em >= NOW() - INTERVAL '7 days'
          AND criado_em < CURRENT_DATE) as activity_7days,
       (SELECT COUNT(*) FROM management.audit_logs
        WHERE tenant_id = $1
          AND criado_em >= CURRENT_DATE) as activity_today`,
    [tenantId]
  );
  const { activity_7days, activity_today } = result.rows[0];
  if (parseInt(activity_7days) === 0 && parseInt(activity_today) > 0) {
    await insertAlert(
      tenantId,
      'inactive_then_burst',
      `Tenant sem atividade nos ultimos 7 dias, com ${activity_today} requests hoje`,
      'info',
      { activity_7days: 0, activity_today: parseInt(activity_today) }
    );
  }
}

async function updateVeiculosAtivos(tenantId: number): Promise<void> {
  const today = new Date().toISOString().split('T')[0];
  const count = await getRedis().scard(`active_veiculos:${tenantId}:${today}`);
  await pool.query(
    `INSERT INTO management.tenant_metrics (tenant_id, data, veiculos_ativos)
     VALUES ($1, $2, $3)
     ON CONFLICT (tenant_id, data) DO UPDATE SET veiculos_ativos = $3`,
    [tenantId, today, count]
  );
}

export async function runAnomalyChecks(): Promise<void> {
  const redis = getRedis();

  // Acquire distributed lock — only one instance runs at a time
  const acquired = await redis.set(LOCK_KEY, '1', 'EX', LOCK_TTL, 'NX');
  if (!acquired) {
    console.log('[cron] anomaly check skipped — lock held by another instance');
    return;
  }

  console.log('[cron] running anomaly checks...');
  try {
    const { rows: tenants } = await pool.query(`
      SELECT t.id, l.max_veiculos, l.max_motoristas
      FROM management.tenants t
      JOIN management.licenses l ON l.tenant_id = t.id AND l.ativo = true
      WHERE t.ativo = true
    `);

    for (const tenant of tenants) {
      await Promise.allSettled([
        checkDevicesOverLimit(tenant.id, tenant.max_veiculos),
        checkMotoristasOverLimit(tenant.id, tenant.max_motoristas),
        checkLoginSpike(tenant.id),
        checkRequestsSpike(tenant.id),
        checkInactiveThenBurst(tenant.id),
        updateVeiculosAtivos(tenant.id),
      ]);
    }

    console.log(`[cron] anomaly checks complete for ${tenants.length} tenants`);
  } catch (err) {
    console.error('[cron] anomaly check error:', err);
  }
}

// Start the cron schedule — called once at service startup
export function startAnomalyCron(): void {
  cron.schedule('*/15 * * * *', runAnomalyChecks);
  console.log('[cron] anomaly detection scheduled every 15 minutes');
}
```

- [ ] **Step 4: Start cron in index.ts**

```typescript
import { startAnomalyCron } from './cron/anomalyDetection';
// After startSubscriber():
startAnomalyCron();
```

- [ ] **Step 5: Run test — expect PASS**

```bash
pnpm test -- --testPathPattern=cron
```

- [ ] **Step 6: Run full test suite**

```bash
pnpm test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add services/management-api/src/cron/ services/management-api/src/__tests__/cron/ services/management-api/src/index.ts
git commit -m "feat(management-api): add anomaly detection cron with Redis distributed lock"
```

---

## Final Verification

- [ ] **Boot the service**

```bash
cd services/management-api && pnpm dev
```

- [ ] **Verify all endpoints respond**

```bash
# Health
curl http://localhost:3000/health

# Login (requires real Firebase token)
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"firebase_id_token": "YOUR_TOKEN"}'

# Dashboard (requires management JWT from login)
curl http://localhost:3000/dashboard \
  -H "Authorization: Bearer YOUR_MANAGEMENT_JWT"
```

- [ ] **Final commit**

```bash
git add services/management-api/
git commit -m "feat(management-api): complete service implementation"
```

---

## What's Next

- **Plan 3:** `app-api` — auth, all business routes, Socket.io with Redis Adapter, module guard, tablet binding
- **Plan 4:** Apps — web/mobile/desktop URL and endpoint updates
