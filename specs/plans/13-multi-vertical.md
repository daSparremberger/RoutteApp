# Multi-Vertical Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the platform to support delivery and corporate passenger verticals through new modules, profiles, and route types.

**Architecture:** Two new modules (`entregas` and `passageiros_corporativos`) are added to the module catalog with `one_of_group: passageiro` dependencies, so routes can work with any passenger type. New profile extension tables follow the existing base+profile pattern (pessoas + extension table). New API routes follow the exact pattern of alunos.ts. Frontend pages follow the Alunos.tsx pattern.

**Tech Stack:** PostgreSQL, Express, TypeScript, React

---

## File Structure

### Backend

| File | Action | Responsibility |
|------|--------|----------------|
| `services/app-api/src/db/migrations/004_multi_vertical.sql` | Create | New modules, deps, profiles |
| `services/app-api/src/routes/entregas.ts` | Create | CRUD delivery clients |
| `services/app-api/src/routes/passageiros-corporativos.ts` | Create | CRUD corporate passengers |
| `services/app-api/src/app.ts` | Modify | Mount new routes |
| `packages/shared/src/types.ts` | Modify | Add new types |

### Frontend

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/pages/Entregas.tsx` | Create | Delivery clients page |
| `apps/web/src/pages/PassageirosCorporativos.tsx` | Create | Corporate passengers page |
| `apps/web/src/App.tsx` | Modify | Add routes |
| `apps/web/src/components/layout/Sidebar.tsx` | Modify | Add nav items |

---

## Chunk 1: Database + Modules

### Task 1: Create migration

**Files:**
- Create: `services/app-api/src/db/migrations/004_multi_vertical.sql`

- [ ] **Step 1: Create migration**

```sql
-- 004_multi_vertical.sql

-- 1. Expand pessoa tipo to include new roles
ALTER TABLE app.pessoas DROP CONSTRAINT IF EXISTS pessoas_tipo_check;
ALTER TABLE app.pessoas ADD CONSTRAINT pessoas_tipo_check
  CHECK(tipo IN ('aluno','motorista','responsavel','operador','gestor','cliente_entrega','passageiro_corp'));

-- 2. Add new modules
INSERT INTO management.modules (slug, nome, descricao, tipo, ativo) VALUES
  ('entregas', 'Entregas', 'Gerenciamento de clientes e entregas', 'cadastro', true),
  ('passageiros_corporativos', 'Passageiros Corporativos', 'Gerenciamento de passageiros corporativos', 'cadastro', true)
ON CONFLICT (slug) DO NOTHING;

-- 3. Add one_of_group dependencies (both satisfy 'passageiro' group like alunos)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo, grupo)
SELECT m.id, m.id, 'one_of_group', 'passageiro'
FROM management.modules m
WHERE m.slug IN ('entregas', 'passageiros_corporativos')
ON CONFLICT DO NOTHING;

-- Note: The one_of_group dependency means rotas can use entregas OR passageiros_corporativos
-- as an alternative to alunos. At least one from the 'passageiro' group must be enabled.

-- 4. Create entrega_profiles extension table
CREATE TABLE IF NOT EXISTS app.entrega_profiles (
  id              SERIAL PRIMARY KEY,
  pessoa_id       INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  empresa         TEXT,
  tipo_carga      TEXT,
  peso_max_kg     NUMERIC(10,2),
  instrucoes      TEXT,
  contato_recebedor TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entrega_profiles_pessoa
  ON app.entrega_profiles (pessoa_id);

-- 5. Create passageiro_corp_profiles extension table
CREATE TABLE IF NOT EXISTS app.passageiro_corp_profiles (
  id              SERIAL PRIMARY KEY,
  pessoa_id       INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  empresa         TEXT,
  cargo           TEXT,
  centro_custo    TEXT,
  horario_entrada TEXT,
  horario_saida   TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_passageiro_corp_profiles_pessoa
  ON app.passageiro_corp_profiles (pessoa_id);
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/db/migrations/004_multi_vertical.sql
git commit -m "feat: add multi-vertical modules, deps, and profile tables"
```

### Task 2: Add shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add types**

Append to `packages/shared/src/types.ts`:

```typescript
// --- Multi-Vertical ---

export interface EntregaProfile {
  id: number;
  pessoa_id: number;
  empresa?: string;
  tipo_carga?: string;
  peso_max_kg?: number;
  instrucoes?: string;
  contato_recebedor?: string;
  criado_em: string;
}

export interface ClienteEntrega extends Pessoa {
  profile: EntregaProfile;
}

export interface PassageiroCorporativoProfile {
  id: number;
  pessoa_id: number;
  empresa?: string;
  cargo?: string;
  centro_custo?: string;
  horario_entrada?: string;
  horario_saida?: string;
  criado_em: string;
}

export interface PassageiroCorporativo extends Pessoa {
  profile: PassageiroCorporativoProfile;
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add multi-vertical shared types"
```

---

## Chunk 2: Backend Routes

### Task 3: Create entregas route

**Files:**
- Create: `services/app-api/src/routes/entregas.ts`

- [ ] **Step 1: Create route**

Follow the exact pattern of `alunos.ts` — GET list, POST create, PUT update, DELETE. Use `requireModule("entregas")`. Pessoa tipo = `'cliente_entrega'`. JOIN with `app.entrega_profiles`.

```typescript
// services/app-api/src/routes/entregas.ts
import { Router } from "express";
import { pool } from "../db/pool";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();
router.use(requireAppAuth, requireTenantActive, requireModule("entregas"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  try {
    const result = await pool.query(
      `SELECT p.*, ep.id AS profile_id, ep.empresa, ep.tipo_carga,
              ep.peso_max_kg, ep.instrucoes, ep.contato_recebedor,
              ep.criado_em AS profile_criado_em
       FROM app.pessoas p
       JOIN app.entrega_profiles ep ON ep.pessoa_id = p.id
       WHERE p.tenant_id = $1 AND p.tipo = 'cliente_entrega'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );
    res.json(result.rows.map((r) => ({
      ...r, profile: {
        id: r.profile_id, pessoa_id: r.id, empresa: r.empresa,
        tipo_carga: r.tipo_carga, peso_max_kg: r.peso_max_kg,
        instrucoes: r.instrucoes, contato_recebedor: r.contato_recebedor,
        criado_em: r.profile_criado_em,
      }
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { nome, telefone, endereco, lat, lng, empresa, tipo_carga, peso_max_kg, instrucoes, contato_recebedor } = req.body as Record<string, unknown>;
  if (!nome) return res.status(400).json({ error: "nome e obrigatorio" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pessoa = await client.query(
      `INSERT INTO app.pessoas (tenant_id, tipo, nome, telefone, endereco, lat, lng)
       VALUES ($1, 'cliente_entrega', $2, $3, $4, $5, $6) RETURNING *`,
      [appReq.tenantId, nome, telefone ?? null, endereco ?? null, lat ?? null, lng ?? null]
    );
    const profile = await client.query(
      `INSERT INTO app.entrega_profiles (pessoa_id, empresa, tipo_carga, peso_max_kg, instrucoes, contato_recebedor)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [pessoa.rows[0].id, empresa ?? null, tipo_carga ?? null, peso_max_kg ?? null, instrucoes ?? null, contato_recebedor ?? null]
    );
    await client.query("COMMIT");
    res.status(201).json({ ...pessoa.rows[0], profile: profile.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const id = Number(req.params.id);
  const { nome, telefone, endereco, lat, lng, ativo, empresa, tipo_carga, peso_max_kg, instrucoes, contato_recebedor } = req.body as Record<string, unknown>;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pessoa = await client.query(
      `UPDATE app.pessoas SET nome=COALESCE($1,nome), telefone=COALESCE($2,telefone),
       endereco=COALESCE($3,endereco), lat=COALESCE($4,lat), lng=COALESCE($5,lng),
       ativo=COALESCE($6,ativo), atualizado_em=NOW()
       WHERE id=$7 AND tenant_id=$8 AND tipo='cliente_entrega' RETURNING *`,
      [nome??null, telefone??null, endereco??null, lat??null, lng??null, ativo??null, id, appReq.tenantId]
    );
    if (!pessoa.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Nao encontrado" }); }
    const profile = await client.query(
      `UPDATE app.entrega_profiles SET empresa=COALESCE($1,empresa), tipo_carga=COALESCE($2,tipo_carga),
       peso_max_kg=COALESCE($3,peso_max_kg), instrucoes=COALESCE($4,instrucoes),
       contato_recebedor=COALESCE($5,contato_recebedor) WHERE pessoa_id=$6 RETURNING *`,
      [empresa??null, tipo_carga??null, peso_max_kg??null, instrucoes??null, contato_recebedor??null, id]
    );
    await client.query("COMMIT");
    res.json({ ...pessoa.rows[0], profile: profile.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const id = Number(req.params.id);
  try {
    const result = await pool.query(
      `DELETE FROM app.pessoas WHERE id=$1 AND tenant_id=$2 AND tipo='cliente_entrega' RETURNING id`,
      [id, appReq.tenantId]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Nao encontrado" });
    res.json({ message: "Removido" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/routes/entregas.ts
git commit -m "feat: add entregas CRUD route"
```

### Task 4: Create passageiros-corporativos route

**Files:**
- Create: `services/app-api/src/routes/passageiros-corporativos.ts`

- [ ] **Step 1: Create route**

Same pattern as entregas.ts but with `passageiro_corp` tipo and `passageiro_corp_profiles` table. Fields: empresa, cargo, centro_custo, horario_entrada, horario_saida.

```typescript
// services/app-api/src/routes/passageiros-corporativos.ts
import { Router } from "express";
import { pool } from "../db/pool";
import { requireAppAuth, requireModule, requireTenantActive } from "../middleware/auth";
import type { AppRequest } from "../types/auth";

const router = Router();
router.use(requireAppAuth, requireTenantActive, requireModule("passageiros_corporativos"));

router.get("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  try {
    const result = await pool.query(
      `SELECT p.*, pc.id AS profile_id, pc.empresa, pc.cargo,
              pc.centro_custo, pc.horario_entrada, pc.horario_saida,
              pc.criado_em AS profile_criado_em
       FROM app.pessoas p
       JOIN app.passageiro_corp_profiles pc ON pc.pessoa_id = p.id
       WHERE p.tenant_id = $1 AND p.tipo = 'passageiro_corp'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );
    res.json(result.rows.map((r) => ({
      ...r, profile: {
        id: r.profile_id, pessoa_id: r.id, empresa: r.empresa,
        cargo: r.cargo, centro_custo: r.centro_custo,
        horario_entrada: r.horario_entrada, horario_saida: r.horario_saida,
        criado_em: r.profile_criado_em,
      }
    })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

router.post("/", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const { nome, telefone, email, endereco, lat, lng, empresa, cargo, centro_custo, horario_entrada, horario_saida } = req.body as Record<string, unknown>;
  if (!nome) return res.status(400).json({ error: "nome e obrigatorio" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pessoa = await client.query(
      `INSERT INTO app.pessoas (tenant_id, tipo, nome, telefone, email, endereco, lat, lng)
       VALUES ($1, 'passageiro_corp', $2, $3, $4, $5, $6, $7) RETURNING *`,
      [appReq.tenantId, nome, telefone??null, email??null, endereco??null, lat??null, lng??null]
    );
    const profile = await client.query(
      `INSERT INTO app.passageiro_corp_profiles (pessoa_id, empresa, cargo, centro_custo, horario_entrada, horario_saida)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [pessoa.rows[0].id, empresa??null, cargo??null, centro_custo??null, horario_entrada??null, horario_saida??null]
    );
    await client.query("COMMIT");
    res.status(201).json({ ...pessoa.rows[0], profile: profile.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.put("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const id = Number(req.params.id);
  const { nome, telefone, email, endereco, lat, lng, ativo, empresa, cargo, centro_custo, horario_entrada, horario_saida } = req.body as Record<string, unknown>;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const pessoa = await client.query(
      `UPDATE app.pessoas SET nome=COALESCE($1,nome), telefone=COALESCE($2,telefone),
       email=COALESCE($3,email), endereco=COALESCE($4,endereco), lat=COALESCE($5,lat),
       lng=COALESCE($6,lng), ativo=COALESCE($7,ativo), atualizado_em=NOW()
       WHERE id=$8 AND tenant_id=$9 AND tipo='passageiro_corp' RETURNING *`,
      [nome??null, telefone??null, email??null, endereco??null, lat??null, lng??null, ativo??null, id, appReq.tenantId]
    );
    if (!pessoa.rowCount) { await client.query("ROLLBACK"); return res.status(404).json({ error: "Nao encontrado" }); }
    const profile = await client.query(
      `UPDATE app.passageiro_corp_profiles SET empresa=COALESCE($1,empresa), cargo=COALESCE($2,cargo),
       centro_custo=COALESCE($3,centro_custo), horario_entrada=COALESCE($4,horario_entrada),
       horario_saida=COALESCE($5,horario_saida) WHERE pessoa_id=$6 RETURNING *`,
      [empresa??null, cargo??null, centro_custo??null, horario_entrada??null, horario_saida??null, id]
    );
    await client.query("COMMIT");
    res.json({ ...pessoa.rows[0], profile: profile.rows[0] });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  const id = Number(req.params.id);
  try {
    const result = await pool.query(
      `DELETE FROM app.pessoas WHERE id=$1 AND tenant_id=$2 AND tipo='passageiro_corp' RETURNING id`,
      [id, appReq.tenantId]
    );
    if (!result.rowCount) return res.status(404).json({ error: "Nao encontrado" });
    res.json({ message: "Removido" });
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
import entregasRouter from "./routes/entregas";
import passageirosCorporativosRouter from "./routes/passageiros-corporativos";
// ...
app.use("/entregas", entregasRouter);
app.use("/passageiros-corporativos", passageirosCorporativosRouter);
```

- [ ] **Step 3: Build to verify**

```bash
cd services/app-api && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add services/app-api/src/routes/passageiros-corporativos.ts services/app-api/src/app.ts
git commit -m "feat: add passageiros-corporativos route and mount new verticals"
```

---

## Chunk 3: Frontend Pages + Wiring

### Task 5: Create Entregas page

**Files:**
- Create: `apps/web/src/pages/Entregas.tsx`

- [ ] **Step 1: Create page**

Follow the Alunos.tsx pattern: list with modal for create/edit. Fields: nome, telefone, endereco (with AddressAutocompleteInput), empresa, tipo_carga, peso_max_kg, instrucoes, contato_recebedor.

The page should use `api.get<ClienteEntrega[]>('/entregas')`, with a table showing nome, empresa, tipo_carga, telefone, and action buttons.

- [ ] **Step 2: Commit**

### Task 6: Create PassageirosCorporativos page

**Files:**
- Create: `apps/web/src/pages/PassageirosCorporativos.tsx`

- [ ] **Step 1: Create page**

Same pattern. Fields: nome, telefone, email, endereco, empresa, cargo, centro_custo, horario_entrada, horario_saida.

- [ ] **Step 2: Commit**

### Task 7: Wire routes and navigation

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add routes to App.tsx**

```typescript
import { Entregas } from './pages/Entregas';
import { PassageirosCorporativos } from './pages/PassageirosCorporativos';
// Inside gestor routes:
<Route path="entregas" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="entregas"><Entregas /></ProtectedRoute>} />
<Route path="passageiros-corporativos" element={<ProtectedRoute allowedRoles={['gestor']} requiredModule="passageiros_corporativos"><PassageirosCorporativos /></ProtectedRoute>} />
```

- [ ] **Step 2: Add sidebar items**

Add to sidebar navigation items array:
```typescript
{ path: '/entregas', label: 'Entregas', icon: Package, module: 'entregas' },
{ path: '/passageiros-corporativos', label: 'Passageiros Corp.', icon: Briefcase, module: 'passageiros_corporativos' },
```

- [ ] **Step 3: Build to verify**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/pages/Entregas.tsx apps/web/src/pages/PassageirosCorporativos.tsx apps/web/src/App.tsx apps/web/src/components/layout/Sidebar.tsx
git commit -m "feat: add Entregas and PassageirosCorporativos pages with routing"
```
