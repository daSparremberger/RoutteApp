# Export & Reports Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CSV export endpoints for financial and operational data, with download buttons in frontend pages.

**Architecture:** A small CSV helper in app-api converts query results to CSV strings. New `/export` sub-routes on existing routers return `text/csv` responses. Frontend gets a `downloadCsv()` helper that triggers file download via fetch + blob.

**Tech Stack:** Express, PostgreSQL, native JS (no external CSV library needed)

---

## File Structure

### Backend (app-api)

| File | Action | Responsibility |
|------|--------|----------------|
| `services/app-api/src/lib/csv.ts` | Create | Convert rows array to CSV string |
| `services/app-api/src/routes/financeiro.ts` | Modify | Add GET /financeiro/export |
| `services/app-api/src/routes/historico.ts` | Modify | Add GET /historico/export |
| `services/app-api/src/routes/alunos.ts` | Modify | Add GET /alunos/export |
| `services/app-api/src/routes/motoristas.ts` | Modify | Add GET /motoristas/export |

### Frontend (web)

| File | Action | Responsibility |
|------|--------|----------------|
| `apps/web/src/lib/api.ts` | Modify | Add downloadCsv() helper |
| `apps/web/src/pages/Financeiro.tsx` | Modify | Add export button |
| `apps/web/src/pages/Historico.tsx` | Modify | Add export button |
| `apps/web/src/pages/Alunos.tsx` | Modify | Add export button |
| `apps/web/src/pages/Motoristas.tsx` | Modify | Add export button |

---

## Chunk 1: Backend CSV Infrastructure + Endpoints

### Task 1: Create CSV helper

**Files:**
- Create: `services/app-api/src/lib/csv.ts`

- [ ] **Step 1: Create helper**

```typescript
// services/app-api/src/lib/csv.ts

function escapeCsv(value: unknown): string {
  if (value == null) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map((c) => escapeCsv(c.label)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(row[c.key])).join(",")
  );
  return [header, ...lines].join("\n");
}

export function setCsvHeaders(res: any, filename: string) {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
}
```

- [ ] **Step 2: Commit**

```bash
git add services/app-api/src/lib/csv.ts
git commit -m "feat: add CSV helper utility"
```

### Task 2: Add export endpoints

**Files:**
- Modify: `services/app-api/src/routes/financeiro.ts`
- Modify: `services/app-api/src/routes/historico.ts`
- Modify: `services/app-api/src/routes/alunos.ts`
- Modify: `services/app-api/src/routes/motoristas.ts`

- [ ] **Step 1: Add financeiro export**

Add to `services/app-api/src/routes/financeiro.ts`, before `export default router`:

```typescript
import { toCsv, setCsvHeaders } from "../lib/csv";

router.get("/export", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  try {
    const result = await pool.query(
      `SELECT t.criado_em AS data, t.tipo, t.categoria, t.descricao,
              p.nome AS pessoa, t.valor, t.status
       FROM app.transacoes t
       LEFT JOIN app.pessoas p ON p.id = t.pessoa_id
       WHERE t.tenant_id = $1
       ORDER BY t.criado_em DESC`,
      [appReq.tenantId]
    );
    const csv = toCsv(result.rows, [
      { key: "data", label: "Data" },
      { key: "tipo", label: "Tipo" },
      { key: "categoria", label: "Categoria" },
      { key: "descricao", label: "Descricao" },
      { key: "pessoa", label: "Pessoa" },
      { key: "valor", label: "Valor" },
      { key: "status", label: "Status" },
    ]);
    setCsvHeaders(res, "financeiro.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});
```

- [ ] **Step 2: Add historico export**

Add to `services/app-api/src/routes/historico.ts`, before `export default router`:

```typescript
import { toCsv, setCsvHeaders } from "../lib/csv";

router.get("/export", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  try {
    const result = await pool.query(
      `SELECT data_execucao, rota_nome, motorista_nome,
              alunos_embarcados, alunos_pulados, km_total,
              iniciada_em, concluida_em
       FROM app.historico
       WHERE tenant_id = $1
       ORDER BY data_execucao DESC`,
      [appReq.tenantId]
    );
    const csv = toCsv(result.rows, [
      { key: "data_execucao", label: "Data" },
      { key: "rota_nome", label: "Rota" },
      { key: "motorista_nome", label: "Motorista" },
      { key: "alunos_embarcados", label: "Embarcados" },
      { key: "alunos_pulados", label: "Pulados" },
      { key: "km_total", label: "KM" },
      { key: "iniciada_em", label: "Inicio" },
      { key: "concluida_em", label: "Fim" },
    ]);
    setCsvHeaders(res, "historico.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});
```

- [ ] **Step 3: Add alunos export**

Add to `services/app-api/src/routes/alunos.ts`, before `export default router`:

```typescript
import { toCsv, setCsvHeaders } from "../lib/csv";

router.get("/export", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  try {
    const result = await pool.query(
      `SELECT p.nome, p.telefone, p.endereco, p.email,
              ap.turno, ap.serie, ap.cpf_responsavel, ap.telefone_responsavel,
              ps.nome AS escola_nome
       FROM app.pessoas p
       JOIN app.aluno_profiles ap ON ap.pessoa_id = p.id
       LEFT JOIN app.pontos_servico ps ON ps.id = ap.escola_id
       WHERE p.tenant_id = $1 AND p.tipo = 'aluno'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );
    const csv = toCsv(result.rows, [
      { key: "nome", label: "Nome" },
      { key: "telefone", label: "Telefone" },
      { key: "endereco", label: "Endereco" },
      { key: "email", label: "Email" },
      { key: "escola_nome", label: "Escola" },
      { key: "turno", label: "Turno" },
      { key: "serie", label: "Serie" },
      { key: "cpf_responsavel", label: "CPF Responsavel" },
      { key: "telefone_responsavel", label: "Tel Responsavel" },
    ]);
    setCsvHeaders(res, "alunos.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});
```

- [ ] **Step 4: Add motoristas export**

Add to `services/app-api/src/routes/motoristas.ts`, before `export default router`:

```typescript
import { toCsv, setCsvHeaders } from "../lib/csv";

router.get("/export", async (req, res) => {
  const appReq = req as unknown as AppRequest;
  try {
    const result = await pool.query(
      `SELECT p.nome, p.telefone, p.email, p.documento,
              mp.cnh, mp.categoria_cnh, mp.validade_cnh, mp.cadastro_completo
       FROM app.pessoas p
       JOIN app.motorista_profiles mp ON mp.pessoa_id = p.id
       WHERE p.tenant_id = $1 AND p.tipo = 'motorista'
       ORDER BY p.nome`,
      [appReq.tenantId]
    );
    const csv = toCsv(result.rows, [
      { key: "nome", label: "Nome" },
      { key: "telefone", label: "Telefone" },
      { key: "email", label: "Email" },
      { key: "documento", label: "Documento" },
      { key: "cnh", label: "CNH" },
      { key: "categoria_cnh", label: "Categoria" },
      { key: "validade_cnh", label: "Validade CNH" },
      { key: "cadastro_completo", label: "Cadastro Completo" },
    ]);
    setCsvHeaders(res, "motoristas.csv");
    res.send(csv);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro interno" });
  }
});
```

- [ ] **Step 5: Build to verify**

```bash
cd services/app-api && pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add services/app-api/src/routes/financeiro.ts services/app-api/src/routes/historico.ts services/app-api/src/routes/alunos.ts services/app-api/src/routes/motoristas.ts
git commit -m "feat: add CSV export endpoints for financeiro, historico, alunos, motoristas"
```

---

## Chunk 2: Frontend Download Buttons

### Task 3: Add downloadCsv helper to api client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add helper**

Add at the bottom of `apps/web/src/lib/api.ts`:

```typescript
export async function downloadCsv(path: string, filename: string) {
  const token = await getToken();
  const res = await fetch(`${APP_BASE}${path}`, {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('Erro no download');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat: add downloadCsv helper to api client"
```

### Task 4: Add export buttons to pages

**Files:**
- Modify: `apps/web/src/pages/Financeiro.tsx`
- Modify: `apps/web/src/pages/Historico.tsx`
- Modify: `apps/web/src/pages/Alunos.tsx`
- Modify: `apps/web/src/pages/Motoristas.tsx`

- [ ] **Step 1: Add to each page**

In each page, add import:
```typescript
import { downloadCsv } from '../lib/api';
```

Add an export button near the page header (next to existing action buttons):
```typescript
<button
  onClick={() => downloadCsv('/financeiro/export', 'financeiro.csv')}
  className="flex items-center gap-2 border border-border text-text-muted hover:text-text px-3 py-2 rounded-xl text-sm"
>
  <Download size={16} /> Exportar CSV
</button>
```

Repeat for each page with the corresponding path:
- Financeiro: `/financeiro/export` → `financeiro.csv`
- Historico: `/historico/export` → `historico.csv`
- Alunos: `/alunos/export` → `alunos.csv`
- Motoristas: `/motoristas/export` → `motoristas.csv`

Add `Download` to the lucide-react import in each file.

- [ ] **Step 2: Build to verify**

```bash
cd apps/web && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/Financeiro.tsx apps/web/src/pages/Historico.tsx apps/web/src/pages/Alunos.tsx apps/web/src/pages/Motoristas.tsx
git commit -m "feat: add CSV export buttons to admin pages"
```
