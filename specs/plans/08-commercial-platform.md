# Commercial Platform (Phase 8) Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add commercial layer (organizations, contracts, invoices) to management-api with contract as source of truth for tenant licenses and modules.

**Architecture:** New tables in `management` schema. Three new route files in management-api. Three new admin pages in web app. Contracts sync to existing licenses and tenant_modules via transactions + outbox events.

**Tech Stack:** PostgreSQL, Express, TypeScript, React, Zustand, Tailwind CSS

**Spec:** `specs/2026-03-13-commercial-platform-design.md`

---

## File Structure

### Backend (management-api)

| File | Action | Responsibility |
|------|--------|----------------|
| `services/management-api/src/db/migrations/002_commercial_schema.sql` | Create | Organizations, contracts, invoices tables |
| `services/management-api/src/routes/organizations.ts` | Create | CRUD organizations |
| `services/management-api/src/routes/contracts.ts` | Create | CRUD contracts + license/module sync |
| `services/management-api/src/routes/invoices.ts` | Create | CRUD invoices + batch generation |
| `services/management-api/src/routes/licenses.ts` | Modify | Add guard when contract active |
| `services/management-api/src/routes/dashboard.ts` | Modify | Add comercial section |
| `services/management-api/src/app.ts` | Modify | Mount new routers |
| `packages/shared/src/types.ts` | Modify | Add Organization, Contract, Invoice, ComercialDashboard types |

### Frontend (web)

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/pages/Admin/Organizations.tsx` | Create | List + create/edit organizations |
| `apps/web/src/pages/Admin/OrganizationDetail.tsx` | Create | Org detail with contracts + invoices |
| `apps/web/src/pages/Admin/Invoices.tsx` | Create | Invoice list with filters + batch actions |
| `apps/web/src/pages/Admin/index.tsx` | Modify | Add nav links for new pages |
| `apps/web/src/pages/Admin/Dashboard.tsx` | Modify | Add comercial stats section |
| `apps/web/src/App.tsx` | Modify | Add routes for new pages |

---

## Chunk 1: Database Migration + Shared Types

### Task 1: Create migration file

**Files:**
- Create: `services/management-api/src/db/migrations/002_commercial_schema.sql`

- [ ] **Step 1: Create migration SQL**

```sql
-- 002_commercial_schema.sql

CREATE TABLE IF NOT EXISTS management.organizations (
  id                  SERIAL PRIMARY KEY,
  tenant_id           INTEGER UNIQUE NOT NULL REFERENCES management.tenants(id) ON DELETE RESTRICT,
  razao_social        TEXT NOT NULL,
  cnpj                TEXT,
  email_financeiro    TEXT,
  telefone_financeiro TEXT,
  endereco_cobranca   TEXT,
  ativo               BOOLEAN DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS management.contracts (
  id                SERIAL PRIMARY KEY,
  organization_id   INTEGER NOT NULL REFERENCES management.organizations(id) ON DELETE RESTRICT,
  valor_mensal      NUMERIC(10,2) NOT NULL,
  modulos_incluidos TEXT[] NOT NULL,
  max_veiculos      INTEGER NOT NULL,
  max_motoristas    INTEGER NOT NULL,
  max_gestores      INTEGER NOT NULL,
  data_inicio       DATE NOT NULL,
  data_fim          DATE,
  status            TEXT NOT NULL DEFAULT 'ativo' CHECK(status IN ('ativo','encerrado','suspenso')),
  observacoes       TEXT,
  criado_em         TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_organization ON management.contracts(organization_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON management.contracts(status);

CREATE UNIQUE INDEX IF NOT EXISTS contracts_active_unique
  ON management.contracts (organization_id)
  WHERE status = 'ativo';

CREATE TABLE IF NOT EXISTS management.invoices (
  id              SERIAL PRIMARY KEY,
  contract_id     INTEGER NOT NULL REFERENCES management.contracts(id) ON DELETE RESTRICT,
  mes_referencia  DATE NOT NULL,
  valor           NUMERIC(10,2) NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pendente' CHECK(status IN ('pendente','pago','cancelado')),
  pago_em         TIMESTAMPTZ,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_contract ON management.invoices(contract_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON management.invoices(status);
CREATE UNIQUE INDEX IF NOT EXISTS invoices_contract_mes_unique
  ON management.invoices (contract_id, mes_referencia);
```

- [ ] **Step 2: Run migration**

Run: `cd services/management-api && pnpm migrate`
Expected: Migration applies without errors.

- [ ] **Step 3: Verify tables exist**

Run: `docker exec -i rotavans-postgres psql -U postgres -d rotavans -c "\dt management.*"`
Expected: `organizations`, `contracts`, `invoices` listed.

- [ ] **Step 4: Commit**

```bash
git add services/management-api/src/db/migrations/002_commercial_schema.sql
git commit -m "feat: add commercial schema migration (organizations, contracts, invoices)"
```

### Task 2: Add shared types

**Files:**
- Modify: `packages/shared/src/types.ts`

- [ ] **Step 1: Add types at end of file**

Append after the last `export` in `packages/shared/src/types.ts`:

```typescript
// --- Commercial Platform ---

export interface Organization {
  id: number;
  tenant_id: number;
  razao_social: string;
  cnpj?: string;
  email_financeiro?: string;
  telefone_financeiro?: string;
  endereco_cobranca?: string;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface Contract {
  id: number;
  organization_id: number;
  valor_mensal: number;
  modulos_incluidos: string[];
  max_veiculos: number;
  max_motoristas: number;
  max_gestores: number;
  data_inicio: string;
  data_fim?: string;
  status: "ativo" | "encerrado" | "suspenso";
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Invoice {
  id: number;
  contract_id: number;
  mes_referencia: string;
  valor: number;
  status: "pendente" | "pago" | "cancelado";
  pago_em?: string;
  observacoes?: string;
  criado_em: string;
}

export interface ComercialDashboard {
  contratos_ativos: number;
  receita_mensal_total: number;
  faturas_pendentes: number;
  valor_faturas_pendentes: number;
  contratos_vencendo_30d: number;
}
```

- [ ] **Step 2: Build shared package**

Run: `cd packages/shared && pnpm build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: add Organization, Contract, Invoice, ComercialDashboard types"
```

---

## Chunk 2: Organizations Route

### Task 3: Create organizations route

**Files:**
- Create: `services/management-api/src/routes/organizations.ts`

- [ ] **Step 1: Create route file**

```typescript
import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.use(requireSuperAdmin);

// GET /organizations — list with tenant info and active contract
router.get("/", async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT o.*,
        t.nome AS tenant_nome, t.cidade, t.estado, t.ativo AS tenant_ativo,
        c.id AS contrato_id, c.valor_mensal, c.status AS contrato_status,
        c.data_inicio AS contrato_inicio, c.data_fim AS contrato_fim
       FROM management.organizations o
       JOIN management.tenants t ON t.id = o.tenant_id
       LEFT JOIN management.contracts c ON c.organization_id = o.id AND c.status = 'ativo'
       ORDER BY o.razao_social`
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /organizations — create organization for existing tenant
router.post("/", async (req, res) => {
  const { tenant_id, razao_social, cnpj, email_financeiro, telefone_financeiro, endereco_cobranca } =
    req.body as Record<string, unknown>;

  if (!tenant_id || !razao_social) {
    return res.status(400).json({ error: "tenant_id e razao_social sao obrigatorios" });
  }

  try {
    // Check tenant exists
    const tenant = await pool.query(
      `SELECT id FROM management.tenants WHERE id = $1`,
      [tenant_id]
    );

    if (!tenant.rowCount) {
      return res.status(404).json({ error: "Tenant nao encontrado" });
    }

    const result = await pool.query(
      `INSERT INTO management.organizations
        (tenant_id, razao_social, cnpj, email_financeiro, telefone_financeiro, endereco_cobranca)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [tenant_id, razao_social, cnpj ?? null, email_financeiro ?? null, telefone_financeiro ?? null, endereco_cobranca ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Tenant ja possui organizacao vinculada" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// GET /organizations/:id — detail with contracts and invoices
router.get("/:id", async (req, res) => {
  const orgId = Number(req.params.id);

  try {
    const org = await pool.query(
      `SELECT o.*, t.nome AS tenant_nome, t.cidade, t.estado, t.ativo AS tenant_ativo
       FROM management.organizations o
       JOIN management.tenants t ON t.id = o.tenant_id
       WHERE o.id = $1`,
      [orgId]
    );

    if (!org.rowCount) {
      return res.status(404).json({ error: "Organizacao nao encontrada" });
    }

    const [contracts, invoices] = await Promise.all([
      pool.query(
        `SELECT * FROM management.contracts WHERE organization_id = $1 ORDER BY criado_em DESC`,
        [orgId]
      ),
      pool.query(
        `SELECT i.* FROM management.invoices i
         JOIN management.contracts c ON c.id = i.contract_id
         WHERE c.organization_id = $1
         ORDER BY i.mes_referencia DESC
         LIMIT 50`,
        [orgId]
      ),
    ]);

    res.json({
      ...org.rows[0],
      contracts: contracts.rows,
      invoices: invoices.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PUT /organizations/:id — update commercial data
router.put("/:id", async (req, res) => {
  const orgId = Number(req.params.id);
  const { razao_social, cnpj, email_financeiro, telefone_financeiro, endereco_cobranca } =
    req.body as Record<string, unknown>;

  try {
    const result = await pool.query(
      `UPDATE management.organizations
       SET razao_social = COALESCE($1, razao_social),
           cnpj = COALESCE($2, cnpj),
           email_financeiro = COALESCE($3, email_financeiro),
           telefone_financeiro = COALESCE($4, telefone_financeiro),
           endereco_cobranca = COALESCE($5, endereco_cobranca),
           atualizado_em = NOW()
       WHERE id = $6
       RETURNING *`,
      [razao_social ?? null, cnpj ?? null, email_financeiro ?? null, telefone_financeiro ?? null, endereco_cobranca ?? null, orgId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Organizacao nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// DELETE /organizations/:id — soft delete (guard: no active contract)
router.delete("/:id", async (req, res) => {
  const orgId = Number(req.params.id);

  try {
    const activeContract = await pool.query(
      `SELECT 1 FROM management.contracts WHERE organization_id = $1 AND status = 'ativo'`,
      [orgId]
    );

    if (activeContract.rowCount) {
      return res.status(409).json({ error: "Organizacao possui contrato ativo. Encerre o contrato antes de desativar." });
    }

    const result = await pool.query(
      `UPDATE management.organizations SET ativo = false, atualizado_em = NOW() WHERE id = $1 RETURNING *`,
      [orgId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Organizacao nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
```

- [ ] **Step 2: Mount in app.ts**

In `services/management-api/src/app.ts`, add import and mount:

```typescript
import organizationsRouter from "./routes/organizations";
// ...
app.use("/organizations", organizationsRouter);
```

- [ ] **Step 3: Build to verify**

Run: `cd services/management-api && pnpm build`
Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add services/management-api/src/routes/organizations.ts services/management-api/src/app.ts
git commit -m "feat: add organizations CRUD route"
```

---

## Chunk 3: Contracts Route (Core Business Logic)

### Task 4: Create contracts route

**Files:**
- Create: `services/management-api/src/routes/contracts.ts`

This is the most complex route — contracts sync licenses and modules.

- [ ] **Step 1: Create route file**

```typescript
import { Router } from "express";
import type { PoolClient } from "pg";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";
import { appendOutboxEvent } from "../lib/outbox";

const router = Router();

router.use(requireSuperAdmin);

/**
 * Validate that modulos_incluidos satisfies the module dependency graph.
 * Returns null if valid, or an error object if invalid.
 */
async function validateModuleDeps(
  client: PoolClient,
  slugs: string[]
): Promise<{ error: string; details: unknown } | null> {
  // Get all module IDs for the slugs
  const modulesResult = await client.query(
    `SELECT id, slug FROM management.modules WHERE slug = ANY($1::text[]) AND ativo = true`,
    [slugs]
  );

  const foundSlugs = modulesResult.rows.map((r: any) => r.slug);
  const unknown = slugs.filter((s) => !foundSlugs.includes(s));
  if (unknown.length) {
    return { error: "Modulos desconhecidos", details: { unknown } };
  }

  // For each module, check required deps are in the list
  for (const mod of modulesResult.rows) {
    const requiredDeps = await client.query(
      `SELECT dep.slug
       FROM management.module_dependencies md
       JOIN management.modules dep ON dep.id = md.depends_on_module_id
       WHERE md.module_id = $1 AND md.tipo = 'required'`,
      [mod.id]
    );

    const missingRequired = requiredDeps.rows
      .filter((d: any) => !slugs.includes(d.slug))
      .map((d: any) => d.slug);

    if (missingRequired.length) {
      return {
        error: `Modulo '${mod.slug}' requer: ${missingRequired.join(", ")}`,
        details: { module: mod.slug, missing_required: missingRequired },
      };
    }

    // Check one_of_group deps
    const groupDeps = await client.query(
      `SELECT md.grupo, array_agg(dep.slug ORDER BY dep.slug) AS options
       FROM management.module_dependencies md
       JOIN management.modules dep ON dep.id = md.depends_on_module_id
       WHERE md.module_id = $1 AND md.tipo = 'one_of_group'
       GROUP BY md.grupo`,
      [mod.id]
    );

    for (const group of groupDeps.rows) {
      const hasOne = group.options.some((opt: string) => slugs.includes(opt));
      if (!hasOne) {
        return {
          error: `Modulo '${mod.slug}' requer pelo menos um de grupo '${group.grupo}': ${group.options.join(", ")}`,
          details: { module: mod.slug, missing_group: group.grupo, options: group.options },
        };
      }
    }
  }

  return null;
}

/**
 * Sync tenant license and modules from a contract.
 * Must be called inside an open transaction.
 */
async function syncContractToTenant(
  client: PoolClient,
  tenantId: number,
  contract: { max_veiculos: number; max_motoristas: number; max_gestores: number; modulos_incluidos: string[] }
) {
  // 1. Update license
  await client.query(
    `UPDATE management.licenses
     SET max_veiculos = $1, max_motoristas = $2, max_gestores = $3
     WHERE tenant_id = $4 AND ativo = true`,
    [contract.max_veiculos, contract.max_motoristas, contract.max_gestores, tenantId]
  );

  await appendOutboxEvent(client, {
    eventType: "license.updated",
    aggregateType: "license",
    aggregateId: tenantId,
    tenantId,
    payload: {
      tenant_id: tenantId,
      effective_license: {
        max_vehicles: contract.max_veiculos,
        max_drivers: contract.max_motoristas,
        max_devices: contract.max_gestores,
      },
    },
  });

  // 2. Sync modules: enable included, disable excluded
  const allModules = await client.query(
    `SELECT m.id, m.slug, COALESCE(tm.habilitado, false) AS habilitado
     FROM management.modules m
     LEFT JOIN management.tenant_modules tm ON tm.module_id = m.id AND tm.tenant_id = $1
     WHERE m.ativo = true`,
    [tenantId]
  );

  for (const mod of allModules.rows) {
    const shouldBeEnabled = contract.modulos_incluidos.includes(mod.slug);
    const isEnabled = mod.habilitado;

    if (shouldBeEnabled === isEnabled) continue;

    // Upsert tenant_module
    await client.query(
      `INSERT INTO management.tenant_modules (tenant_id, module_id, habilitado, habilitado_em, desabilitado_em)
       VALUES ($1, $2, $3,
         CASE WHEN $3 = true THEN NOW() ELSE NULL END,
         CASE WHEN $3 = false THEN NOW() ELSE NULL END)
       ON CONFLICT (tenant_id, module_id)
       DO UPDATE SET habilitado = $3,
         habilitado_em = CASE WHEN $3 = true THEN NOW() ELSE management.tenant_modules.habilitado_em END,
         desabilitado_em = CASE WHEN $3 = false THEN NOW() ELSE NULL END`,
      [tenantId, mod.id, shouldBeEnabled]
    );

    await appendOutboxEvent(client, {
      eventType: shouldBeEnabled ? "tenant.module.enabled" : "tenant.module.disabled",
      aggregateType: "tenant_module",
      aggregateId: mod.id,
      tenantId,
      payload: { tenant_id: tenantId, module_slug: mod.slug },
    });
  }
}

// GET /organizations/:orgId/contracts — contract history
router.get("/organizations/:orgId/contracts", async (req, res) => {
  const orgId = Number(req.params.orgId);

  try {
    const result = await pool.query(
      `SELECT * FROM management.contracts WHERE organization_id = $1 ORDER BY criado_em DESC`,
      [orgId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /organizations/:orgId/contracts — create contract (syncs license + modules)
router.post("/organizations/:orgId/contracts", async (req, res) => {
  const orgId = Number(req.params.orgId);
  const { valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, observacoes } =
    req.body as Record<string, unknown>;

  if (valor_mensal == null || !modulos_incluidos || max_veiculos == null || max_motoristas == null || max_gestores == null || !data_inicio) {
    return res.status(400).json({ error: "valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio sao obrigatorios" });
  }

  const slugs = modulos_incluidos as string[];

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Check org exists and get tenant_id
    const org = await client.query(
      `SELECT tenant_id FROM management.organizations WHERE id = $1 AND ativo = true`,
      [orgId]
    );

    if (!org.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Organizacao nao encontrada ou inativa" });
    }

    const tenantId = org.rows[0].tenant_id;

    // Validate module dependencies
    const depError = await validateModuleDeps(client, slugs);
    if (depError) {
      await client.query("ROLLBACK");
      return res.status(400).json(depError);
    }

    // Insert contract (unique index prevents duplicate active contract)
    const result = await client.query(
      `INSERT INTO management.contracts
        (organization_id, valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, observacoes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [orgId, valor_mensal, slugs, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim ?? null, observacoes ?? null]
    );

    const contract = result.rows[0];

    // Sync license and modules
    await syncContractToTenant(client, tenantId, {
      max_veiculos: contract.max_veiculos,
      max_motoristas: contract.max_motoristas,
      max_gestores: contract.max_gestores,
      modulos_incluidos: contract.modulos_incluidos,
    });

    await client.query("COMMIT");
    res.status(201).json(contract);
  } catch (error: any) {
    await client.query("ROLLBACK");
    if (error.code === "23505" && error.constraint === "contracts_active_unique") {
      return res.status(409).json({ error: "Organizacao ja possui contrato ativo" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

// PUT /contracts/:id — update active contract (resyncs license + modules)
router.put("/contracts/:id", async (req, res) => {
  const contractId = Number(req.params.id);
  const { valor_mensal, modulos_incluidos, max_veiculos, max_motoristas, max_gestores, data_inicio, data_fim, observacoes } =
    req.body as Record<string, unknown>;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT c.*, o.tenant_id
       FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE c.id = $1 AND c.status = 'ativo'`,
      [contractId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Contrato ativo nao encontrado" });
    }

    const tenantId = existing.rows[0].tenant_id;
    const newSlugs = (modulos_incluidos as string[] | undefined) ?? existing.rows[0].modulos_incluidos;

    // Validate module dependencies if modules changed
    if (modulos_incluidos) {
      const depError = await validateModuleDeps(client, newSlugs);
      if (depError) {
        await client.query("ROLLBACK");
        return res.status(400).json(depError);
      }
    }

    // data_fim: use explicit value if key is present in body (even if null), otherwise keep existing
    const newDataFim = "data_fim" in req.body ? (data_fim ?? null) : existing.rows[0].data_fim;

    const result = await client.query(
      `UPDATE management.contracts
       SET valor_mensal = COALESCE($1, valor_mensal),
           modulos_incluidos = COALESCE($2, modulos_incluidos),
           max_veiculos = COALESCE($3, max_veiculos),
           max_motoristas = COALESCE($4, max_motoristas),
           max_gestores = COALESCE($5, max_gestores),
           data_inicio = COALESCE($6, data_inicio),
           data_fim = $7,
           observacoes = COALESCE($8, observacoes),
           atualizado_em = NOW()
       WHERE id = $9
       RETURNING *`,
      [
        valor_mensal ?? null,
        modulos_incluidos ? newSlugs : null,
        max_veiculos ?? null,
        max_motoristas ?? null,
        max_gestores ?? null,
        data_inicio ?? null,
        newDataFim,
        observacoes ?? null,
        contractId,
      ]
    );

    const contract = result.rows[0];

    // Resync license and modules
    await syncContractToTenant(client, tenantId, {
      max_veiculos: contract.max_veiculos,
      max_motoristas: contract.max_motoristas,
      max_gestores: contract.max_gestores,
      modulos_incluidos: contract.modulos_incluidos,
    });

    await client.query("COMMIT");
    res.json(contract);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

// PATCH /contracts/:id/status — suspend/terminate contract
router.patch("/contracts/:id/status", async (req, res) => {
  const contractId = Number(req.params.id);
  const { status } = req.body as { status?: string };

  if (!status || !["suspenso", "encerrado", "ativo"].includes(status)) {
    return res.status(400).json({ error: "status deve ser 'ativo', 'suspenso' ou 'encerrado'" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const existing = await client.query(
      `SELECT c.status, c.organization_id, o.tenant_id
       FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE c.id = $1`,
      [contractId]
    );

    if (!existing.rowCount) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Contrato nao encontrado" });
    }

    const current = existing.rows[0].status;
    const tenantId = existing.rows[0].tenant_id;

    // Validate transitions
    const validTransitions: Record<string, string[]> = {
      ativo: ["suspenso", "encerrado"],
      suspenso: ["ativo", "encerrado"],
    };

    if (!validTransitions[current]?.includes(status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: `Transicao invalida: ${current} -> ${status}` });
    }

    await client.query(
      `UPDATE management.contracts SET status = $1, atualizado_em = NOW() WHERE id = $2`,
      [status, contractId]
    );

    // Side effects
    if (status === "suspenso" || status === "encerrado") {
      // Deactivate tenant
      await client.query(
        `UPDATE management.tenants SET ativo = false, atualizado_em = NOW() WHERE id = $1`,
        [tenantId]
      );

      await appendOutboxEvent(client, {
        eventType: "tenant.deactivated",
        aggregateType: "tenant",
        aggregateId: tenantId,
        tenantId,
        payload: { tenant_id: tenantId, reason: `contrato ${status}` },
      });
    } else if (status === "ativo") {
      // Reactivate tenant
      await client.query(
        `UPDATE management.tenants SET ativo = true, atualizado_em = NOW() WHERE id = $1`,
        [tenantId]
      );

      // Get the contract to resync
      const contract = await client.query(
        `SELECT * FROM management.contracts WHERE id = $1`,
        [contractId]
      );

      await syncContractToTenant(client, tenantId, {
        max_veiculos: contract.rows[0].max_veiculos,
        max_motoristas: contract.rows[0].max_motoristas,
        max_gestores: contract.rows[0].max_gestores,
        modulos_incluidos: contract.rows[0].modulos_incluidos,
      });
    }

    await client.query("COMMIT");

    const updated = await pool.query(`SELECT * FROM management.contracts WHERE id = $1`, [contractId]);
    res.json(updated.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  } finally {
    client.release();
  }
});

export default router;
```

- [ ] **Step 2: Mount in app.ts**

In `services/management-api/src/app.ts`, add import and mount:

```typescript
import contractsRouter from "./routes/contracts";
// ...
app.use("/", contractsRouter);
```

Note: mounted at `/` because routes use `/organizations/:orgId/contracts` and `/contracts/:id` prefixes.

- [ ] **Step 3: Build to verify**

Run: `cd services/management-api && pnpm build`
Expected: Compiles without errors.

- [ ] **Step 4: Commit**

```bash
git add services/management-api/src/routes/contracts.ts services/management-api/src/app.ts
git commit -m "feat: add contracts route with license/module sync"
```

---

## Chunk 4: Invoices Route + License Guard + Dashboard

### Task 5: Create invoices route

**Files:**
- Create: `services/management-api/src/routes/invoices.ts`

- [ ] **Step 1: Create route file**

```typescript
import { Router } from "express";

import { pool } from "../db/pool";
import { requireSuperAdmin } from "../middleware/auth";

const router = Router();

router.use(requireSuperAdmin);

// GET /invoices — list with filters
router.get("/", async (req, res) => {
  const { status, mes, organization_id } = req.query as Record<string, string | undefined>;

  try {
    let where = "WHERE 1=1";
    const params: unknown[] = [];
    let idx = 1;

    if (status) {
      where += ` AND i.status = $${idx++}`;
      params.push(status);
    }
    if (mes) {
      where += ` AND i.mes_referencia = $${idx++}`;
      params.push(mes);
    }
    if (organization_id) {
      where += ` AND c.organization_id = $${idx++}`;
      params.push(Number(organization_id));
    }

    const result = await pool.query(
      `SELECT i.*, c.organization_id, c.valor_mensal AS contrato_valor,
        o.razao_social, o.tenant_id
       FROM management.invoices i
       JOIN management.contracts c ON c.id = i.contract_id
       JOIN management.organizations o ON o.id = c.organization_id
       ${where}
       ORDER BY i.mes_referencia DESC, o.razao_social`,
      params
    );

    res.json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /invoices — create invoice for a contract
router.post("/", async (req, res) => {
  const { contract_id, mes_referencia, observacoes } = req.body as Record<string, unknown>;

  if (!contract_id || !mes_referencia) {
    return res.status(400).json({ error: "contract_id e mes_referencia sao obrigatorios" });
  }

  try {
    const contract = await pool.query(
      `SELECT id, valor_mensal, status FROM management.contracts WHERE id = $1`,
      [contract_id]
    );

    if (!contract.rowCount) {
      return res.status(404).json({ error: "Contrato nao encontrado" });
    }

    if (contract.rows[0].status !== "ativo") {
      return res.status(400).json({ error: "Contrato nao esta ativo" });
    }

    const result = await pool.query(
      `INSERT INTO management.invoices (contract_id, mes_referencia, valor, observacoes)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [contract_id, mes_referencia, contract.rows[0].valor_mensal, observacoes ?? null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(409).json({ error: "Fatura ja existe para este contrato e mes" });
    }
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /invoices/batch — generate invoices for all active contracts
router.post("/batch", async (req, res) => {
  const { mes_referencia } = req.body as { mes_referencia?: string };

  if (!mes_referencia) {
    return res.status(400).json({ error: "mes_referencia e obrigatorio" });
  }

  try {
    const activeContracts = await pool.query(
      `SELECT c.id, c.valor_mensal, o.razao_social
       FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE c.status = 'ativo'`
    );

    const created: unknown[] = [];
    const skipped: unknown[] = [];
    const errors: unknown[] = [];

    for (const contract of activeContracts.rows) {
      try {
        const result = await pool.query(
          `INSERT INTO management.invoices (contract_id, mes_referencia, valor)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [contract.id, mes_referencia, contract.valor_mensal]
        );
        created.push({ ...result.rows[0], razao_social: contract.razao_social });
      } catch (error: any) {
        if (error.code === "23505") {
          skipped.push({ contract_id: contract.id, razao_social: contract.razao_social, reason: "ja existe" });
        } else {
          errors.push({ contract_id: contract.id, razao_social: contract.razao_social, error: error.message });
        }
      }
    }

    res.status(201).json({ created, skipped, errors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

// PATCH /invoices/:id/status — mark paid/canceled
router.patch("/:id/status", async (req, res) => {
  const invoiceId = Number(req.params.id);
  const { status, observacoes } = req.body as { status?: string; observacoes?: string };

  if (!status || !["pago", "cancelado", "pendente"].includes(status)) {
    return res.status(400).json({ error: "status deve ser 'pago', 'cancelado' ou 'pendente'" });
  }

  try {
    const result = await pool.query(
      `UPDATE management.invoices
       SET status = $1,
           pago_em = CASE WHEN $1 = 'pago' THEN NOW() ELSE NULL END,
           observacoes = COALESCE($2, observacoes)
       WHERE id = $3
       RETURNING *`,
      [status, observacoes ?? null, invoiceId]
    );

    if (!result.rowCount) {
      return res.status(404).json({ error: "Fatura nao encontrada" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
```

- [ ] **Step 2: Mount in app.ts**

In `services/management-api/src/app.ts`:

```typescript
import invoicesRouter from "./routes/invoices";
// ...
app.use("/invoices", invoicesRouter);
```

- [ ] **Step 3: Commit**

```bash
git add services/management-api/src/routes/invoices.ts services/management-api/src/app.ts
git commit -m "feat: add invoices route with batch generation"
```

### Task 6: Add license guard

**Files:**
- Modify: `services/management-api/src/routes/licenses.ts`

- [ ] **Step 1: Add guard check before license update**

At the start of the `router.put` handler in `licenses.ts`, after the `if (!tenantId)` validation block and **before** `const client = await pool.connect()`, add:

```typescript
  // Guard: block manual license edit when active contract exists
  try {
    const activeContract = await pool.query(
      `SELECT 1 FROM management.contracts c
       JOIN management.organizations o ON o.id = c.organization_id
       WHERE o.tenant_id = $1 AND c.status = 'ativo'`,
      [tenantId]
    );

    if (activeContract.rowCount) {
      return res.status(409).json({ error: "Licenca controlada por contrato ativo. Atualize o contrato para alterar limites." });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Erro interno" });
  }
```

- [ ] **Step 2: Build to verify**

Run: `cd services/management-api && pnpm build`
Expected: Compiles without errors.

- [ ] **Step 3: Commit**

```bash
git add services/management-api/src/routes/licenses.ts
git commit -m "feat: guard license edit when active contract exists"
```

### Task 7: Add comercial section to dashboard

**Files:**
- Modify: `services/management-api/src/routes/dashboard.ts`

- [ ] **Step 1: Add comercial query to the existing Promise.all**

In `services/management-api/src/routes/dashboard.ts`, add a fourth query to the `Promise.all`:

```typescript
    const comercial = await pool.query(
      `SELECT
        (SELECT COUNT(*) FROM management.contracts WHERE status = 'ativo') AS contratos_ativos,
        (SELECT COALESCE(SUM(valor_mensal), 0) FROM management.contracts WHERE status = 'ativo') AS receita_mensal_total,
        (SELECT COUNT(*) FROM management.invoices WHERE status = 'pendente') AS faturas_pendentes,
        (SELECT COALESCE(SUM(valor), 0) FROM management.invoices WHERE status = 'pendente') AS valor_faturas_pendentes,
        (SELECT COUNT(*) FROM management.contracts WHERE status = 'ativo' AND data_fim IS NOT NULL AND data_fim BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days') AS contratos_vencendo_30d`
    );
```

Add `comercial` key to the response:

```typescript
    res.json({
      ...tenants.rows[0],
      ...alerts.rows[0],
      ...activity.rows[0],
      comercial: {
        contratos_ativos: Number(comercial.rows[0].contratos_ativos),
        receita_mensal_total: Number(comercial.rows[0].receita_mensal_total),
        faturas_pendentes: Number(comercial.rows[0].faturas_pendentes),
        valor_faturas_pendentes: Number(comercial.rows[0].valor_faturas_pendentes),
        contratos_vencendo_30d: Number(comercial.rows[0].contratos_vencendo_30d),
      },
    });
```

- [ ] **Step 2: Build to verify**

Run: `cd services/management-api && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add services/management-api/src/routes/dashboard.ts
git commit -m "feat: add comercial section to admin dashboard"
```

---

## Chunk 5: Web Admin — Organizations Page

### Task 8: Create Organizations list page

**Files:**
- Create: `apps/web/src/pages/Admin/Organizations.tsx`

- [ ] **Step 1: Create page**

```typescript
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { managementApi } from '../../lib/api';

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<any[]>([]);

  useEffect(() => {
    managementApi.get<any[]>('/organizations').then(setOrgs).catch(() => {});
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-heading text-3xl font-bold text-text">Organizacoes</h2>
        <Link to="/admin/organizations/novo" className="ui-btn-primary">Nova Organizacao</Link>
      </div>

      <div className="ui-table-wrap">
        <table className="w-full">
          <thead className="ui-table-head">
            <tr>
              <th className="p-4 text-left">Razao Social</th>
              <th className="p-4 text-left">CNPJ</th>
              <th className="p-4 text-left">Tenant</th>
              <th className="p-4 text-left">Contrato</th>
              <th className="p-4 text-left">Valor Mensal</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map((o) => (
              <tr key={o.id} className="ui-table-row">
                <td className="p-4 text-text">{o.razao_social}</td>
                <td className="p-4 text-text-muted">{o.cnpj ?? '-'}</td>
                <td className="p-4 text-text-muted">{o.tenant_nome} ({o.cidade}/{o.estado})</td>
                <td className="p-4">
                  {o.contrato_id ? (
                    <span className={`rounded-full px-2 py-1 text-xs ${
                      o.contrato_status === 'ativo' ? 'bg-success-muted text-success' :
                      o.contrato_status === 'suspenso' ? 'bg-warning-muted text-warning' :
                      'bg-danger-muted text-danger'
                    }`}>
                      {o.contrato_status}
                    </span>
                  ) : (
                    <span className="text-sm text-text-muted">Sem contrato</span>
                  )}
                </td>
                <td className="p-4 text-text-muted">
                  {o.valor_mensal ? `R$ ${Number(o.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
                </td>
                <td className="p-4">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    o.ativo ? 'bg-success-muted text-success' : 'bg-danger-muted text-danger'
                  }`}>
                    {o.ativo ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="p-4">
                  <Link to={`/admin/organizations/${o.id}`} className="text-sm font-medium text-text hover:text-accent">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Admin/Organizations.tsx
git commit -m "feat: add Organizations list page"
```

### Task 9: Create OrganizationDetail page

**Files:**
- Create: `apps/web/src/pages/Admin/OrganizationDetail.tsx`

- [ ] **Step 1: Create page**

```typescript
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { managementApi } from '../../lib/api';
import { Modal } from '../../components/ui/Modal';

export function OrganizationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = id === 'novo';

  const [org, setOrg] = useState<any>(null);
  const [form, setForm] = useState({ razao_social: '', cnpj: '', email_financeiro: '', telefone_financeiro: '', endereco_cobranca: '', tenant_id: '' });
  const [tenants, setTenants] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Contract modal
  const [contractModal, setContractModal] = useState(false);
  const [modules, setModules] = useState<any[]>([]);
  const [contractForm, setContractForm] = useState({
    valor_mensal: '', modulos_incluidos: [] as string[],
    max_veiculos: '', max_motoristas: '', max_gestores: '',
    data_inicio: '', data_fim: '', observacoes: '',
  });

  // Invoice modal
  const [invoiceModal, setInvoiceModal] = useState(false);
  const [invoiceMes, setInvoiceMes] = useState('');

  useEffect(() => {
    if (!isNew && id) {
      managementApi.get<any>(`/organizations/${id}`).then((data) => {
        setOrg(data);
        setForm({
          razao_social: data.razao_social, cnpj: data.cnpj || '', email_financeiro: data.email_financeiro || '',
          telefone_financeiro: data.telefone_financeiro || '', endereco_cobranca: data.endereco_cobranca || '', tenant_id: String(data.tenant_id),
        });
      });
    }
    managementApi.get<any[]>('/tenants').then(setTenants).catch(() => {});
    managementApi.get<any[]>('/modules').then(setModules).catch(() => {});
  }, [id, isNew]);

  async function handleSaveOrg(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isNew) {
        const created = await managementApi.post<any>('/organizations', { ...form, tenant_id: Number(form.tenant_id) });
        navigate(`/admin/organizations/${created.id}`);
      } else {
        await managementApi.put<any>(`/organizations/${id}`, form);
        const updated = await managementApi.get<any>(`/organizations/${id}`);
        setOrg(updated);
      }
    } catch {
      // error handled by api client
    }
    setLoading(false);
  }

  async function handleCreateContract(e: React.FormEvent) {
    e.preventDefault();
    try {
      await managementApi.post<any>(`/organizations/${id}/contracts`, {
        ...contractForm,
        valor_mensal: Number(contractForm.valor_mensal),
        max_veiculos: Number(contractForm.max_veiculos),
        max_motoristas: Number(contractForm.max_motoristas),
        max_gestores: Number(contractForm.max_gestores),
      });
      setContractModal(false);
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  async function handleContractStatus(contractId: number, status: string) {
    if (!confirm(`Confirma alteracao de status para "${status}"?`)) return;
    try {
      await managementApi.patch<any>(`/contracts/${contractId}/status`, { status });
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  async function handleInvoiceStatus(invoiceId: number, status: string) {
    try {
      await managementApi.patch<any>(`/invoices/${invoiceId}/status`, { status });
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  async function handleCreateInvoice(e: React.FormEvent) {
    e.preventDefault();
    const activeContract = org?.contracts?.find((c: any) => c.status === 'ativo');
    if (!activeContract) return;
    try {
      await managementApi.post<any>('/invoices', { contract_id: activeContract.id, mes_referencia: invoiceMes });
      setInvoiceModal(false);
      const updated = await managementApi.get<any>(`/organizations/${id}`);
      setOrg(updated);
    } catch {
      // error handled by api client
    }
  }

  function toggleModule(slug: string) {
    setContractForm((prev) => ({
      ...prev,
      modulos_incluidos: prev.modulos_incluidos.includes(slug)
        ? prev.modulos_incluidos.filter((s) => s !== slug)
        : [...prev.modulos_incluidos, slug],
    }));
  }

  const activeContract = org?.contracts?.find((c: any) => c.status === 'ativo');

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-3xl font-bold text-text">
        {isNew ? 'Nova Organizacao' : org?.razao_social || '...'}
      </h2>

      {/* Org form */}
      <form onSubmit={handleSaveOrg} className="ui-panel space-y-4 p-6">
        <h3 className="text-lg font-semibold text-text">Dados Comerciais</h3>
        {isNew && (
          <div>
            <label className="mb-1 block text-sm text-text-muted">Tenant</label>
            <select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="ui-select" required>
              <option value="">Selecione...</option>
              {tenants.map((t) => <option key={t.id} value={t.id}>{t.nome} ({t.cidade}/{t.estado})</option>)}
            </select>
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Razao Social</label>
            <input type="text" value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} className="ui-input" required />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">CNPJ</label>
            <input type="text" value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} className="ui-input" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Email Financeiro</label>
            <input type="email" value={form.email_financeiro} onChange={(e) => setForm({ ...form, email_financeiro: e.target.value })} className="ui-input" />
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">Telefone Financeiro</label>
            <input type="text" value={form.telefone_financeiro} onChange={(e) => setForm({ ...form, telefone_financeiro: e.target.value })} className="ui-input" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-sm text-text-muted">Endereco de Cobranca</label>
          <input type="text" value={form.endereco_cobranca} onChange={(e) => setForm({ ...form, endereco_cobranca: e.target.value })} className="ui-input" />
        </div>
        <button type="submit" disabled={loading} className="ui-btn-primary px-6">
          {loading ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      {/* Contracts section (only when editing) */}
      {!isNew && org && (
        <div className="ui-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">Contratos</h3>
            {!activeContract && (
              <button onClick={() => setContractModal(true)} className="ui-btn-primary text-sm">
                Novo Contrato
              </button>
            )}
          </div>

          {org.contracts?.length ? (
            <div className="space-y-3">
              {org.contracts.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-1 text-xs ${
                        c.status === 'ativo' ? 'bg-success-muted text-success' :
                        c.status === 'suspenso' ? 'bg-warning-muted text-warning' :
                        'bg-danger-muted text-danger'
                      }`}>{c.status}</span>
                      <span className="font-semibold text-text">
                        R$ {Number(c.valor_mensal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}/mes
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-muted">
                      {c.data_inicio} — {c.data_fim || 'Indeterminado'} | {c.modulos_incluidos?.length} modulos |
                      {c.max_veiculos} veic / {c.max_motoristas} mot / {c.max_gestores} gest
                    </p>
                  </div>
                  {c.status === 'ativo' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleContractStatus(c.id, 'suspenso')} className="ui-btn-secondary text-xs">Suspender</button>
                      <button onClick={() => handleContractStatus(c.id, 'encerrado')} className="ui-btn-secondary text-xs">Encerrar</button>
                    </div>
                  )}
                  {c.status === 'suspenso' && (
                    <button onClick={() => handleContractStatus(c.id, 'ativo')} className="ui-btn-primary text-xs">Reativar</button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-text-muted">Nenhum contrato registrado.</p>
          )}
        </div>
      )}

      {/* Invoices section */}
      {!isNew && org && (
        <div className="ui-panel p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-text">Faturas</h3>
            {activeContract && (
              <button onClick={() => setInvoiceModal(true)} className="ui-btn-primary text-sm">
                Gerar Fatura
              </button>
            )}
          </div>

          {org.invoices?.length ? (
            <div className="ui-table-wrap">
              <table className="w-full">
                <thead className="ui-table-head">
                  <tr>
                    <th className="p-4 text-left">Mes</th>
                    <th className="p-4 text-left">Valor</th>
                    <th className="p-4 text-left">Status</th>
                    <th className="p-4 text-left">Pago em</th>
                    <th className="p-4 text-left">Acoes</th>
                  </tr>
                </thead>
                <tbody>
                  {org.invoices.map((inv: any) => (
                    <tr key={inv.id} className="ui-table-row">
                      <td className="p-4 text-text">{inv.mes_referencia}</td>
                      <td className="p-4 text-text-muted">R$ {Number(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="p-4">
                        <span className={`rounded-full px-2 py-1 text-xs ${
                          inv.status === 'pago' ? 'bg-success-muted text-success' :
                          inv.status === 'cancelado' ? 'bg-danger-muted text-danger' :
                          'bg-warning-muted text-warning'
                        }`}>{inv.status}</span>
                      </td>
                      <td className="p-4 text-text-muted">{inv.pago_em ? new Date(inv.pago_em).toLocaleDateString('pt-BR') : '-'}</td>
                      <td className="p-4 space-x-2">
                        {inv.status === 'pendente' && (
                          <>
                            <button onClick={() => handleInvoiceStatus(inv.id, 'pago')} className="text-sm font-medium text-success hover:underline">Pago</button>
                            <button onClick={() => handleInvoiceStatus(inv.id, 'cancelado')} className="text-sm font-medium text-danger hover:underline">Cancelar</button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-text-muted">Nenhuma fatura gerada.</p>
          )}
        </div>
      )}

      {/* Contract Modal */}
      <Modal open={contractModal} onClose={() => setContractModal(false)} title="Novo Contrato" size="lg">
        <form onSubmit={handleCreateContract} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-text-muted">Valor Mensal (R$)</label>
              <input type="number" step="0.01" value={contractForm.valor_mensal} onChange={(e) => setContractForm({ ...contractForm, valor_mensal: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Data Inicio</label>
              <input type="date" value={contractForm.data_inicio} onChange={(e) => setContractForm({ ...contractForm, data_inicio: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Data Fim (opcional)</label>
              <input type="date" value={contractForm.data_fim} onChange={(e) => setContractForm({ ...contractForm, data_fim: e.target.value })} className="ui-input" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-text-muted">Max Veiculos</label>
              <input type="number" value={contractForm.max_veiculos} onChange={(e) => setContractForm({ ...contractForm, max_veiculos: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Max Motoristas</label>
              <input type="number" value={contractForm.max_motoristas} onChange={(e) => setContractForm({ ...contractForm, max_motoristas: e.target.value })} className="ui-input" required />
            </div>
            <div>
              <label className="mb-1 block text-sm text-text-muted">Max Gestores</label>
              <input type="number" value={contractForm.max_gestores} onChange={(e) => setContractForm({ ...contractForm, max_gestores: e.target.value })} className="ui-input" required />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm text-text-muted">Modulos Incluidos</label>
            <div className="flex flex-wrap gap-2">
              {modules.map((m: any) => (
                <button
                  key={m.slug}
                  type="button"
                  onClick={() => toggleModule(m.slug)}
                  className={`rounded-full px-3 py-1 text-sm transition-colors ${
                    contractForm.modulos_incluidos.includes(m.slug)
                      ? 'bg-accent text-surface'
                      : 'border border-border bg-surface text-text-muted hover:bg-surface2'
                  }`}
                >
                  {m.nome}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-muted">Observacoes</label>
            <textarea value={contractForm.observacoes} onChange={(e) => setContractForm({ ...contractForm, observacoes: e.target.value })} className="ui-textarea" rows={2} />
          </div>
          <button type="submit" className="ui-btn-primary px-6">Criar Contrato</button>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal open={invoiceModal} onClose={() => setInvoiceModal(false)} title="Gerar Fatura">
        <form onSubmit={handleCreateInvoice} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Mes de Referencia</label>
            <input type="date" value={invoiceMes} onChange={(e) => setInvoiceMes(e.target.value)} className="ui-input" required />
          </div>
          <button type="submit" className="ui-btn-primary px-6">Gerar</button>
        </form>
      </Modal>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Admin/OrganizationDetail.tsx
git commit -m "feat: add OrganizationDetail page with contracts and invoices"
```

---

## Chunk 6: Web Admin — Invoices Page + Wiring

### Task 10: Create Invoices page

**Files:**
- Create: `apps/web/src/pages/Admin/Invoices.tsx`

- [ ] **Step 1: Create page**

```typescript
import { useEffect, useState } from 'react';
import { managementApi } from '../../lib/api';

export function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [mesFilter, setMesFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');
  const [orgs, setOrgs] = useState<any[]>([]);
  const [batchMes, setBatchMes] = useState('');
  const [batchResult, setBatchResult] = useState<any>(null);

  useEffect(() => {
    managementApi.get<any[]>('/organizations').then(setOrgs).catch(() => {});
  }, []);

  function load() {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (mesFilter) params.set('mes', mesFilter);
    if (orgFilter) params.set('organization_id', orgFilter);
    const qs = params.toString();
    managementApi.get<any[]>(`/invoices${qs ? `?${qs}` : ''}`).then(setInvoices).catch(() => {});
  }

  useEffect(() => { load(); }, [statusFilter, mesFilter, orgFilter]);

  async function handleBatch(e: React.FormEvent) {
    e.preventDefault();
    if (!batchMes) return;
    const result = await managementApi.post<any>('/invoices/batch', { mes_referencia: batchMes });
    setBatchResult(result);
    load();
  }

  async function handleStatus(invoiceId: number, status: string) {
    await managementApi.patch<any>(`/invoices/${invoiceId}/status`, { status });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-3xl font-bold text-text">Faturas</h2>
      </div>

      {/* Batch generation */}
      <div className="ui-panel flex items-end gap-4 p-4">
        <form onSubmit={handleBatch} className="flex items-end gap-4">
          <div>
            <label className="mb-1 block text-sm text-text-muted">Gerar faturas em lote</label>
            <input type="date" value={batchMes} onChange={(e) => setBatchMes(e.target.value)} className="ui-input" required />
          </div>
          <button type="submit" className="ui-btn-primary">Gerar</button>
        </form>
        {batchResult && (
          <p className="text-sm text-text-muted">
            {batchResult.created?.length} criadas, {batchResult.skipped?.length} ignoradas, {batchResult.errors?.length} erros
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {['', 'pendente', 'pago', 'cancelado'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                statusFilter === s ? 'bg-accent text-surface' : 'border border-border bg-surface text-text-muted'
              }`}
            >
              {s || 'Todas'}
            </button>
          ))}
        </div>
        <input
          type="month"
          value={mesFilter}
          onChange={(e) => setMesFilter(e.target.value ? `${e.target.value}-01` : '')}
          className="ui-input w-auto"
          placeholder="Mes"
        />
        <select value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} className="ui-select w-auto">
          <option value="">Todas organizacoes</option>
          {orgs.map((o: any) => <option key={o.id} value={o.id}>{o.razao_social}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="ui-table-wrap">
        <table className="w-full">
          <thead className="ui-table-head">
            <tr>
              <th className="p-4 text-left">Organizacao</th>
              <th className="p-4 text-left">Mes</th>
              <th className="p-4 text-left">Valor</th>
              <th className="p-4 text-left">Status</th>
              <th className="p-4 text-left">Pago em</th>
              <th className="p-4 text-left">Acoes</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} className="ui-table-row">
                <td className="p-4 text-text">{inv.razao_social}</td>
                <td className="p-4 text-text-muted">{inv.mes_referencia}</td>
                <td className="p-4 text-text-muted">R$ {Number(inv.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2 py-1 text-xs ${
                    inv.status === 'pago' ? 'bg-success-muted text-success' :
                    inv.status === 'cancelado' ? 'bg-danger-muted text-danger' :
                    'bg-warning-muted text-warning'
                  }`}>{inv.status}</span>
                </td>
                <td className="p-4 text-text-muted">{inv.pago_em ? new Date(inv.pago_em).toLocaleDateString('pt-BR') : '-'}</td>
                <td className="p-4 space-x-2">
                  {inv.status === 'pendente' && (
                    <>
                      <button onClick={() => handleStatus(inv.id, 'pago')} className="text-sm font-medium text-success hover:underline">Pago</button>
                      <button onClick={() => handleStatus(inv.id, 'cancelado')} className="text-sm font-medium text-danger hover:underline">Cancelar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/Admin/Invoices.tsx
git commit -m "feat: add Invoices admin page with batch and filters"
```

### Task 11: Wire up routes and navigation

**Files:**
- Modify: `apps/web/src/pages/Admin/index.tsx`
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/pages/Admin/Dashboard.tsx`

- [ ] **Step 1: Add nav links to Admin sidebar**

In `apps/web/src/pages/Admin/index.tsx`, add three NavLink entries after the "Regioes" NavLink (before `</nav>`):

```typescript
          <NavLink
            to="/admin/organizations"
            className={({ isActive }) =>
              `block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface hover:text-text'
              }`
            }
          >
            Organizacoes
          </NavLink>
          <NavLink
            to="/admin/invoices"
            className={({ isActive }) =>
              `block rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-surface text-text' : 'text-text-muted hover:bg-surface hover:text-text'
              }`
            }
          >
            Faturas
          </NavLink>
```

- [ ] **Step 2: Add routes to App.tsx**

In `apps/web/src/App.tsx`, add imports:

```typescript
import { OrganizationsPage } from './pages/Admin/Organizations';
import { OrganizationDetailPage } from './pages/Admin/OrganizationDetail';
import { InvoicesPage } from './pages/Admin/Invoices';
```

Add routes inside the `<Route path="/admin" ...>` block, after the tenants routes:

```typescript
          <Route path="organizations" element={<OrganizationsPage />} />
          <Route path="organizations/:id" element={<OrganizationDetailPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
```

- [ ] **Step 3: Add comercial stats to Admin Dashboard**

In `apps/web/src/pages/Admin/Dashboard.tsx`, add a comercial section after existing cards:

```typescript
      {stats?.comercial && (
        <div className="mt-6">
          <h3 className="mb-4 text-lg font-semibold text-text">Comercial</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Contratos Ativos</p>
              <p className="mt-1 text-3xl font-bold text-text">{stats.comercial.contratos_ativos}</p>
            </div>
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Receita Mensal</p>
              <p className="mt-1 text-3xl font-bold text-success">
                R$ {Number(stats.comercial.receita_mensal_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Faturas Pendentes</p>
              <p className="mt-1 text-3xl font-bold text-warning">{stats.comercial.faturas_pendentes}</p>
            </div>
            <div className="ui-panel p-6">
              <p className="text-sm text-text-muted">Vencendo em 30 dias</p>
              <p className="mt-1 text-3xl font-bold text-danger">{stats.comercial.contratos_vencendo_30d}</p>
            </div>
          </div>
        </div>
      )}
```

- [ ] **Step 4: Build web to verify**

Run: `cd apps/web && pnpm build`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/Admin/index.tsx apps/web/src/App.tsx apps/web/src/pages/Admin/Dashboard.tsx
git commit -m "feat: wire commercial pages into admin navigation and routes"
```

---

## Chunk 7: Update Master Plan

### Task 12: Update master plan Phase 8

**Files:**
- Modify: `specs/plans/00-master-implementation-plan.md`

- [ ] **Step 1: Update Phase 8 section**

Replace the Phase 8 deliverables and tasks to match the simplified spec:

```markdown
## Fase 8 - Plataforma Comercial

### Objetivo

Adicionar a camada comercial sem contaminar a operacao.

### Entregaveis

- `organizations` (1:1 com tenant)
- `contracts` (customizados, fonte de verdade para licenca e modulos)
- `invoices` (controle interno)
- Dashboard admin com secao comercial
- Paginas admin dedicadas (organizacoes, contratos, faturas)

### Tarefas

1. Criar schema e migrations comerciais no `management`.
2. Criar CRUD de organizations.
3. Criar contratos com validacao de modulos e sync de licenca.
4. Criar faturas com geracao em lote.
5. Adicionar guard em `PUT /tenants/:id/license` quando contrato ativo.
6. Expor dashboard comercial.
7. Criar paginas admin no web.

### Validacao

- tenant pode ter organizacao com contrato ativo
- contrato atualiza licenca e modulos automaticamente
- suspensao de contrato desativa tenant
- reativacao de contrato reativa tenant e resincroniza
- fatura gerada com valor do contrato
- edicao manual de licenca bloqueada quando contrato ativo
```

- [ ] **Step 2: Commit**

```bash
git add specs/plans/00-master-implementation-plan.md
git commit -m "docs: update master plan Phase 8 to match simplified commercial design"
```

---

## Final Verification

After all tasks are complete:

- [ ] `cd services/management-api && pnpm build` passes
- [ ] `cd packages/shared && pnpm build` passes
- [ ] `cd apps/web && pnpm build` passes
- [ ] `cd services/management-api && pnpm migrate` runs without errors
- [ ] All new routes respond correctly via manual test or API client
