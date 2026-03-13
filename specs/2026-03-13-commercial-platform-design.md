# Rotavans — Design: Plataforma Comercial (Fase 8)

**Data:** 2026-03-13
**Status:** Aprovado
**Escopo:** Camada comercial com organizacoes, contratos customizados e faturamento para controle interno.

> **Depende de:** Fases 1-7 completas (foundation, shared contracts, management-api, event bus, app-api, operational flows, web dashboard).

---

## 1. Visao Geral

Adicionar camada comercial ao `management-api` para gerenciar organizacoes, contratos customizados e faturas. O contrato e a fonte de verdade para licencas e modulos do tenant — ao criar ou atualizar um contrato, o sistema sincroniza automaticamente `licenses` e `tenant_modules`.

### Decisoes de design

- **Modelo de negocio:** Contratos customizados por organizacao (sem planos pre-definidos)
- **Relacao organization-tenant:** 1:1 (organizacao e camada comercial do tenant existente)
- **Faturamento:** Registro e controle interno apenas (cobranca real acontece fora da plataforma)
- **Contrato controla licenca:** Limites e modulos do contrato atualizam automaticamente a licenca e tenant_modules
- **Itens contratuais:** Limites operacionais (max_veiculos, max_motoristas, max_gestores) + modulos incluidos + valor mensal unico

### Simplificacao em relacao ao plano mestre

O plano mestre (Fase 8) listava `organizations`, `plans`, `contracts`, `contract_items`, `billing_accounts`, `invoices`, `payments`. Esta spec simplifica para:

- **Removidos:** `plans` (sem planos pre-definidos), `contract_items` (limites sao campos diretos no contrato), `billing_accounts` (sem necessidade de conta separada), `payments` (pagamento e registrado como status da fatura)
- **Motivo:** O modelo de negocio nao requer planos padronizados nem integracao com gateway de pagamento. Contratos customizados com valor mensal unico e controle manual de faturas atendem a necessidade atual sem complexidade desnecessaria.
- **O plano mestre deve ser atualizado** para refletir esta simplificacao.

---

## 2. Modelo de Dados

Todas as tabelas no schema `management`, ao lado das existentes.

### 2.1 `organizations`

Camada comercial 1:1 com tenant.

```sql
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

-- Nota: UNIQUE em tenant_id ja cria indice implicito, nao precisa de indice adicional.
```

### 2.2 `contracts`

Contrato ativo da organizacao. Uma org pode ter historico de contratos (renovacoes), mas so um ativo por vez.

```sql
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

-- Garante no maximo um contrato ativo por organizacao
CREATE UNIQUE INDEX IF NOT EXISTS contracts_active_unique
  ON management.contracts (organization_id)
  WHERE status = 'ativo';
```

### 2.3 `invoices`

Faturas para controle interno. Criacao manual ou em lote.

```sql
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

---

## 3. Comportamento Chave

### 3.1 Contrato controla licenca

Ao criar ou atualizar um contrato com status `ativo`:

1. Buscar o `tenant_id` via `organizations.tenant_id`
2. Atualizar `licenses` do tenant:
   - `max_veiculos = contract.max_veiculos`
   - `max_motoristas = contract.max_motoristas`
   - `max_gestores = contract.max_gestores`
3. Publicar evento `license.updated` no outbox
4. Sincronizar `tenant_modules`:
   - Para cada slug em `modulos_incluidos`: habilitar se nao estiver habilitado
   - Para cada modulo habilitado que NAO esta em `modulos_incluidos`: desabilitar (respeitando dependencias)
5. Publicar eventos `tenant.module.enabled` / `tenant.module.disabled` conforme necessario

### 3.2 Validacao de modulos no contrato

Ao definir `modulos_incluidos`, validar o grafo de dependencias:
- Todos os modulos `required` de cada modulo incluido devem tambem estar incluidos
- Para dependencias `one_of_group`, pelo menos um do grupo deve estar incluido
- Retornar erro com lista de dependencias faltantes se invalido

### 3.3 Transicoes de estado do contrato

```
ativo -> suspenso    (tenant desativado, licenca/modulos preservados)
ativo -> encerrado   (tenant desativado, contrato vira historico)
suspenso -> ativo    (tenant reativado, licenca/modulos resincronizados)
suspenso -> encerrado (contrato vira historico)
```

- **`ativo -> suspenso`**: Desativa o tenant (`tenants.ativo = false`), publica `tenant.deactivated`. Licenca e modulos permanecem intactos para reativacao.
- **`suspenso -> ativo`**: Reativa o tenant (`tenants.ativo = true`), resincroniza licenca e modulos do contrato, publica `license.updated` e eventos de modulo conforme necessario.
- **`ativo -> encerrado`** ou **`suspenso -> encerrado`**: Desativa o tenant (se ainda ativo). Contrato fica como historico. Novo contrato pode ser criado para a organizacao.
- Transicoes invalidas (ex: `encerrado -> ativo`) retornam `400 Bad Request`.

### 3.4 Guard na edicao manual de licenca

A rota existente `PUT /tenants/:id/license` deve verificar se o tenant possui organizacao com contrato ativo. Se sim, retornar `409 Conflict`:

```json
{ "error": "Licenca controlada por contrato ativo. Atualize o contrato para alterar limites." }
```

### 3.5 Guard na desativacao de organizacao

`DELETE /organizations/:id` (soft delete) deve verificar se existe contrato ativo. Se sim, retornar `409 Conflict`:

```json
{ "error": "Organizacao possui contrato ativo. Encerre o contrato antes de desativar." }
```

### 3.6 Faturas

- Criacao manual: admin gera fatura para um contrato especifico
- Criacao em lote: admin gera faturas do mes para todos os contratos ativos. Cada fatura e criada em transacao individual (best-effort). A resposta retorna lista de faturas criadas e lista de erros (se houver).
- Duplicata evitada pelo unique index `(contract_id, mes_referencia)` — contratos que ja possuem fatura do mes sao ignorados silenciosamente no batch
- Marcar como pago/cancelado e manual
- Valor da fatura e copiado do `valor_mensal` do contrato no momento da criacao

---

## 4. Rotas no management-api

### 4.1 Organizations

```
GET    /organizations                     — listar com tenant info e contrato ativo
POST   /organizations                     — criar (vincula a tenant existente)
GET    /organizations/:id                 — detalhe com contratos e faturas
PUT    /organizations/:id                 — atualizar dados comerciais
DELETE /organizations/:id                 — soft delete (ativo = false)
```

### 4.2 Contracts

```
GET    /organizations/:id/contracts       — historico de contratos da org
POST   /organizations/:id/contracts       — criar contrato (atualiza licenca + modulos)
PUT    /contracts/:id                     — atualizar contrato ativo
PATCH  /contracts/:id/status              — encerrar/suspender contrato
```

### 4.3 Invoices

```
GET    /invoices                          — listar com filtros (status, mes, org)
POST   /invoices                          — gerar fatura para um contrato
POST   /invoices/batch                    — gerar faturas do mes para todos contratos ativos
PATCH  /invoices/:id/status               — marcar pago/cancelado
```

---

## 5. Dashboard Admin — Secao Comercial

Adiciona ao endpoint `GET /dashboard` existente:

```json
{
  "comercial": {
    "contratos_ativos": 12,
    "receita_mensal_total": 45600.00,
    "faturas_pendentes": 3,
    "valor_faturas_pendentes": 11400.00,
    "contratos_vencendo_30d": 2
  }
}
```

---

## 6. Paginas Admin Web

### 6.1 Organizacoes

- Lista com razao_social, cnpj, tenant vinculado, status do contrato
- Criacao vinculando a tenant existente (que ainda nao tem organizacao)
- Edicao de dados comerciais
- Visualizacao com contrato ativo, historico de contratos, faturas

### 6.2 Contratos

- Gerenciados dentro do contexto da organizacao
- Formulario com valor_mensal, modulos (checkboxes), limites, datas
- Validacao de dependencias de modulos no frontend
- Acoes de suspender/encerrar com confirmacao

### 6.3 Faturas

- Lista geral com filtros por status, mes_referencia, organizacao
- Acao "Gerar faturas do mes" em lote
- Acao individual de marcar como pago/cancelado

---

## 7. Tipos Compartilhados

Adicionar ao `packages/shared`:

```typescript
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
  status: 'ativo' | 'encerrado' | 'suspenso';
  observacoes?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface Invoice {
  id: number;
  contract_id: number;
  mes_referencia: string;
  valor: number;
  status: 'pendente' | 'pago' | 'cancelado';
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

---

## 8. Eventos

Nenhum evento cross-service novo necessario. As acoes comerciais reutilizam eventos existentes:

- Contrato atualiza licenca → `license.updated`
- Contrato habilita/desabilita modulos → `tenant.module.enabled` / `tenant.module.disabled`
- Contrato suspenso/encerrado → `tenant.deactivated`

**Importante:** O evento `license.updated` deve usar o payload existente definido em `packages/shared/src/events.ts`:

```typescript
{
  tenant_id: number;
  effective_license: {
    max_vehicles?: number;   // mapeado de max_veiculos do contrato
    max_drivers?: number;    // mapeado de max_motoristas do contrato
    max_devices?: number;    // mapeado de max_gestores do contrato
  }
}
```

A sincronizacao de contrato para licenca deve publicar o evento neste formato (campos em ingles no payload) para manter compatibilidade com o subscriber do app-api.

### `modulos_incluidos` como snapshot

O campo `contracts.modulos_incluidos` (TEXT[]) e um snapshot dos slugs no momento do contrato. Se o catalogo de modulos mudar (slug renomeado ou removido), contratos historicos nao sao afetados — eles refletem o que foi contratado na epoca. A validacao de dependencias ocorre apenas na criacao/edicao do contrato.

### `data_fim` nullable

`contracts.data_fim = NULL` significa contrato por tempo indeterminado. A query de `contratos_vencendo_30d` no dashboard considera apenas contratos com `data_fim IS NOT NULL AND data_fim BETWEEN NOW() AND NOW() + INTERVAL '30 days'`.

---

## 9. O que NAO fazer

- Nao criar gateway de pagamento ou integracao externa
- Nao duplicar limites — contrato e fonte unica, licenca e projecao
- Nao permitir edicao manual de licenca quando existe contrato ativo (rota `PUT /tenants/:id/license` deve verificar)
- Nao criar planos pre-definidos — cada contrato e customizado
- Nao gerar faturas automaticamente por cron
