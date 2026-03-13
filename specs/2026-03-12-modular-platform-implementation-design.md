# Rotavans — Design: Plataforma Modular com Heranca de Dominio

**Data:** 2026-03-12
**Status:** Aprovado
**Escopo:** Rewrite integrado com modularizacao nativa, dashboard adaptativo, e evolucao para plataforma comercial multi-vertical.

> **Supersede:** Este documento e a referencia autoritativa para o schema `app` e para a tabela `management.module_dependencies`. Ele substitui as definicoes correspondentes em `2026-03-12-relational-schema-spec.md` e `2026-03-12-domain-model-spec.md` onde houver conflito. As specs de arquitetura (`architecture-rewrite-design.md`), eventos (`ownership-matrix-and-event-catalog.md`), e routing (`mapbox-navigation-and-routing-strategy.md`) permanecem validas e complementares.

---

## 1. Visao Geral

Reescrever o monolito em dois servicos (`management-api` e `app-api`) incorporando desde o inicio:

- Modelo de dominio com heranca (entidade base + profiles de extensao)
- Sistema de modulos com grafo de dependencias
- Dashboard adaptativo por modulos habilitados
- Preparacao para multi-vertical e plataforma comercial

O design visual do dashboard (cores, tipografia, layout, componentes) e preservado integralmente. Apenas o conteudo se adapta aos modulos ativos do tenant.

---

## 2. Modelo de Dominio

### 2.1 Principio: Entidade Base + Profile de Extensao

Cada dominio segue o padrao:
- Tabela base com campos comuns
- Tabela de profile (1:1) com campos especificos do modulo
- Consultas do modulo fazem JOIN base + profile

Vantagens:
- Sem duplicidade de dados
- Uma pessoa pode ter multiplos profiles (motorista E responsavel). O campo `tipo` representa o papel primario; profiles adicionais sao detectados pela existencia de rows nas tabelas de extensao.
- Ativacao de modulos = habilitar a extensao, a base ja existe
- Buscas cross-modulo ("todas as pessoas do tenant") sao triviais

### 2.2 Schema `app` — Entidades Base

#### `pessoas`

```sql
CREATE TABLE IF NOT EXISTS app.pessoas (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL,
  firebase_uid   TEXT UNIQUE,
  tipo           TEXT NOT NULL CHECK(tipo IN ('aluno','motorista','responsavel','operador','gestor')),
  nome           TEXT NOT NULL,
  email          TEXT,
  telefone       TEXT,
  documento      TEXT,
  endereco       TEXT,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  foto_url       TEXT,
  ativo          BOOLEAN DEFAULT true,
  criado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ DEFAULT NOW()
);
-- Nota: `tipo` representa o papel primario. Uma pessoa pode ter profiles adicionais
-- (ex: motorista que tambem e responsavel de aluno). Profiles sao detectados por JOIN.
-- Restricoes de tipo (ex: rotas.motorista_id deve ser pessoa tipo 'motorista')
-- sao enforced na camada de aplicacao, nao por FK composta.

CREATE INDEX IF NOT EXISTS idx_pessoas_tenant ON app.pessoas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pessoas_tipo ON app.pessoas(tenant_id, tipo);
CREATE INDEX IF NOT EXISTS idx_pessoas_firebase ON app.pessoas(firebase_uid);
```

#### `pontos_servico`

```sql
CREATE TABLE IF NOT EXISTS app.pontos_servico (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL,
  tipo           TEXT NOT NULL CHECK(tipo IN ('escola','deposito','cliente','ponto_coleta')),
  nome           TEXT NOT NULL,
  endereco       TEXT NOT NULL,
  lat            DOUBLE PRECISION,
  lng            DOUBLE PRECISION,
  criado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pontos_servico_tenant ON app.pontos_servico(tenant_id);
CREATE INDEX IF NOT EXISTS idx_pontos_servico_tipo ON app.pontos_servico(tenant_id, tipo);
```

### 2.3 Tabelas de Profile (Extensao por Modulo)

#### Modulo `alunos` — `aluno_profiles`

```sql
CREATE TABLE IF NOT EXISTS app.aluno_profiles (
  id                    SERIAL PRIMARY KEY,
  pessoa_id             INTEGER UNIQUE NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  escola_id             INTEGER REFERENCES app.pontos_servico(id) ON DELETE SET NULL,
  turno                 TEXT CHECK(turno IN ('manha','tarde','noite')),
  cpf_responsavel       TEXT,
  telefone_responsavel  TEXT,
  responsavel_id        INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  serie                 TEXT,
  necessidades_especiais TEXT,
  criado_em             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_aluno_profiles_pessoa ON app.aluno_profiles(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_aluno_profiles_escola ON app.aluno_profiles(escola_id);
```

#### Modulo `motoristas` — `motorista_profiles`

```sql
CREATE TABLE IF NOT EXISTS app.motorista_profiles (
  id                 SERIAL PRIMARY KEY,
  pessoa_id          INTEGER UNIQUE NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  cnh                TEXT,
  categoria_cnh      TEXT,
  validade_cnh       DATE,
  pin_hash           TEXT,
  documento_url      TEXT,
  convite_token      TEXT UNIQUE,
  convite_expira_em  TIMESTAMPTZ,
  cadastro_completo  BOOLEAN DEFAULT false,
  criado_em          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_motorista_profiles_pessoa ON app.motorista_profiles(pessoa_id);
CREATE INDEX IF NOT EXISTS idx_motorista_profiles_convite ON app.motorista_profiles(convite_token);
```

#### Modulo `escolas` — `escola_profiles`

```sql
CREATE TABLE IF NOT EXISTS app.escola_profiles (
  id                    SERIAL PRIMARY KEY,
  ponto_servico_id      INTEGER UNIQUE NOT NULL REFERENCES app.pontos_servico(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_escola_profiles_ponto ON app.escola_profiles(ponto_servico_id);
```

### 2.4 Tabelas Operacionais (sem mudanca estrutural)

As tabelas operacionais referenciam `pessoas` ao inves de tabelas separadas:

```sql
-- veiculos: sem mudanca, nao e pessoa
CREATE TABLE IF NOT EXISTS app.veiculos (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL,
  placa       TEXT NOT NULL,
  modelo      TEXT,
  fabricante  TEXT,
  ano         INTEGER,
  capacidade  INTEGER,
  ativo          BOOLEAN DEFAULT true,
  criado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, placa)
);

-- rotas: motorista_id e veiculo_id referenciam pessoas e veiculos
CREATE TABLE IF NOT EXISTS app.rotas (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  motorista_id INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  veiculo_id   INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  nome         TEXT NOT NULL,
  turno        TEXT CHECK(turno IN ('manha','tarde','noite')),
  rota_geojson   JSONB,
  ativo          BOOLEAN DEFAULT true,
  criado_em      TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em  TIMESTAMPTZ DEFAULT NOW()
);

-- rota_paradas: pessoa_id referencia o sujeito da parada (aluno, entrega, passageiro corp, etc.)
-- Tipos validos de pessoa para paradas sao enforced na camada de aplicacao
-- baseado nos modulos do grupo 'passageiro' habilitados para o tenant.
CREATE TABLE IF NOT EXISTS app.rota_paradas (
  id       SERIAL PRIMARY KEY,
  rota_id  INTEGER NOT NULL REFERENCES app.rotas(id) ON DELETE CASCADE,
  pessoa_id INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  ordem    INTEGER NOT NULL,
  lat      DOUBLE PRECISION,
  lng      DOUBLE PRECISION,
  UNIQUE(rota_id, ordem)
);

-- tablet_vinculos: motorista_id referencia pessoas
CREATE TABLE IF NOT EXISTS app.tablet_vinculos (
  id              SERIAL PRIMARY KEY,
  veiculo_id      INTEGER NOT NULL REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id    INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  device_id       TEXT NOT NULL,
  vinculado_em    TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

-- veiculo_motorista: motorista_id referencia pessoas
CREATE TABLE IF NOT EXISTS app.veiculo_motorista (
  id              SERIAL PRIMARY KEY,
  veiculo_id      INTEGER NOT NULL REFERENCES app.veiculos(id) ON DELETE CASCADE,
  motorista_id    INTEGER NOT NULL REFERENCES app.pessoas(id) ON DELETE CASCADE,
  vinculado_em    TIMESTAMPTZ DEFAULT NOW(),
  desvinculado_em TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS veiculo_motorista_active_unique
  ON app.veiculo_motorista (veiculo_id, motorista_id)
  WHERE desvinculado_em IS NULL;

-- execucoes: motorista_id referencia pessoas
CREATE TABLE IF NOT EXISTS app.execucoes (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  rota_id      INTEGER REFERENCES app.rotas(id) ON DELETE SET NULL,
  motorista_id INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  veiculo_id   INTEGER REFERENCES app.veiculos(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'em_andamento'
                 CHECK(status IN ('em_andamento','concluida','cancelada')),
  iniciada_em  TIMESTAMPTZ DEFAULT NOW(),
  concluida_em TIMESTAMPTZ
);

-- execucao_paradas: aluno_id referencia pessoas
CREATE TABLE IF NOT EXISTS app.execucao_paradas (
  id          SERIAL PRIMARY KEY,
  execucao_id INTEGER NOT NULL REFERENCES app.execucoes(id) ON DELETE CASCADE,
  pessoa_id   INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  status      TEXT CHECK(status IN ('embarcou','pulou')),
  horario     TIMESTAMPTZ DEFAULT NOW()
);

-- historico: sem mudanca estrutural (snapshot desnormalizado)
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

-- mensagens: remetente/destinatario referenciam pessoas
CREATE TABLE IF NOT EXISTS app.mensagens (
  id               SERIAL PRIMARY KEY,
  tenant_id        INTEGER NOT NULL,
  remetente_id     INTEGER NOT NULL REFERENCES app.pessoas(id),
  remetente_tipo   TEXT NOT NULL CHECK(remetente_tipo IN ('gestor','motorista')),
  destinatario_id  INTEGER NOT NULL REFERENCES app.pessoas(id),
  destinatario_tipo TEXT NOT NULL CHECK(destinatario_tipo IN ('gestor','motorista')),
  conteudo         TEXT NOT NULL,
  lido             BOOLEAN DEFAULT false,
  criado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- cobrancas: aluno_id referencia pessoas
CREATE TABLE IF NOT EXISTS app.cobrancas (
  id             SERIAL PRIMARY KEY,
  tenant_id      INTEGER NOT NULL,
  pessoa_id      INTEGER REFERENCES app.pessoas(id) ON DELETE SET NULL,
  mes_referencia DATE NOT NULL,
  valor          NUMERIC(10,2) NOT NULL,
  status         TEXT DEFAULT 'pendente' CHECK(status IN ('pendente','pago','cancelado')),
  criado_em      TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.5 Gestores

Gestores permanecem na tabela `pessoas` com `tipo = 'gestor'`. Nao possuem profile de extensao — os campos base (nome, email, firebase_uid) sao suficientes.

```sql
-- Consulta de gestores:
-- SELECT * FROM app.pessoas WHERE tenant_id = $1 AND tipo = 'gestor' AND ativo = true
```

---

## 3. Sistema de Modulos

### 3.1 Tabelas no Schema `management`

```sql
-- modules: catalogo global de modulos (sem mudanca)
CREATE TABLE IF NOT EXISTS management.modules (
  id        SERIAL PRIMARY KEY,
  slug      TEXT UNIQUE NOT NULL,
  nome      TEXT NOT NULL,
  descricao TEXT,
  tipo      TEXT NOT NULL DEFAULT 'cadastro',  -- 'cadastro', 'operacional', 'suporte'
  ativo     BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- module_dependencies: grafo de pre-requisitos
CREATE TABLE IF NOT EXISTS management.module_dependencies (
  id                    SERIAL PRIMARY KEY,
  module_id             INTEGER NOT NULL REFERENCES management.modules(id) ON DELETE CASCADE,
  depends_on_module_id  INTEGER NOT NULL REFERENCES management.modules(id) ON DELETE CASCADE,
  tipo                  TEXT NOT NULL DEFAULT 'required',  -- 'required' | 'one_of_group'
  grupo                 TEXT,                               -- ex: 'passageiro' para deps one_of_group
  UNIQUE(module_id, depends_on_module_id)
);

-- tenant_modules: sem mudanca estrutural
CREATE TABLE IF NOT EXISTS management.tenant_modules (
  id              SERIAL PRIMARY KEY,
  tenant_id       INTEGER NOT NULL REFERENCES management.tenants(id) ON DELETE CASCADE,
  module_id       INTEGER NOT NULL REFERENCES management.modules(id) ON DELETE CASCADE,
  habilitado      BOOLEAN DEFAULT true,
  habilitado_em   TIMESTAMPTZ DEFAULT NOW(),
  desabilitado_em TIMESTAMPTZ,
  UNIQUE(tenant_id, module_id)
);
```

### 3.2 Seed de Modulos e Dependencias

```sql
INSERT INTO management.modules (slug, nome, descricao, tipo) VALUES
  ('motoristas',   'Motoristas',   'Cadastro e gestao de motoristas',                 'cadastro'),
  ('alunos',       'Alunos',       'Cadastro e gestao de alunos',                     'cadastro'),
  ('escolas',      'Escolas',      'Cadastro e gestao de escolas',                     'cadastro'),
  ('veiculos',     'Veiculos',     'Cadastro e gestao de frota',                       'cadastro'),
  ('rotas',        'Rotas',        'Criacao e gestao de rotas',                        'operacional'),
  ('execucao',     'Execucao',     'Iniciar, finalizar e registrar execucoes de rota', 'operacional'),
  ('rastreamento', 'Rastreamento', 'Tracking em tempo real de motoristas',             'operacional'),
  ('mensagens',    'Mensagens',    'Chat entre gestor e motorista',                    'suporte'),
  ('financeiro',   'Financeiro',   'Cobrancas e controle financeiro',                  'suporte'),
  ('historico',    'Historico',    'Relatorios e snapshots de execucao',               'suporte')
ON CONFLICT (slug) DO NOTHING;

-- Dependencias
-- rotas depende de motoristas (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'rotas' AND m2.slug = 'motoristas';

-- rotas depende de veiculos (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'rotas' AND m2.slug = 'veiculos';

-- rotas depende de pelo menos 1 modulo de passageiro (one_of_group)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo, grupo)
  SELECT m1.id, m2.id, 'one_of_group', 'passageiro'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'rotas' AND m2.slug = 'alunos';

-- alunos depende de escolas (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'alunos' AND m2.slug = 'escolas';

-- execucao depende de rotas (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'execucao' AND m2.slug = 'rotas';

-- rastreamento depende de motoristas (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'rastreamento' AND m2.slug = 'motoristas';

-- rastreamento depende de veiculos (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'rastreamento' AND m2.slug = 'veiculos';

-- mensagens depende de motoristas (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'mensagens' AND m2.slug = 'motoristas';

-- historico depende de execucao (required)
INSERT INTO management.module_dependencies (module_id, depends_on_module_id, tipo)
  SELECT m1.id, m2.id, 'required'
  FROM management.modules m1, management.modules m2
  WHERE m1.slug = 'historico' AND m2.slug = 'execucao';
```

### 3.3 Logica de Validacao (management-api)

**Habilitar modulo:**
1. Buscar todas as dependencias `required` do modulo
2. Verificar que todas estao habilitadas para o tenant
3. Buscar dependencias `one_of_group`, agrupadas por `grupo`
4. Para cada grupo, verificar que pelo menos 1 esta habilitada
5. Se todas as condicoes passam, habilitar. Senao, retornar erro com lista de deps faltantes.

**Desabilitar modulo:**
1. Buscar todos os modulos que dependem deste (reverse lookup)
2. Filtrar os que estao habilitados para o tenant
3. Se algum depende deste como `required`, retornar erro com lista de dependentes
4. Se algum depende deste como `one_of_group`, verificar se existe outro do mesmo grupo habilitado
5. Se tudo limpo, desabilitar.

### 3.4 Cache em Redis

```
Chave: module:{tenant_id}:{slug}
Valor: "true" | "false"
TTL: 300s

Chave: modules:{tenant_id}
Valor: JSON array de slugs habilitados (ex: ["motoristas","veiculos","rotas"])
TTL: 300s
```

Invalidado por eventos `module:enabled` e `module:disabled`.

---

## 4. Dashboard Adaptativo

### 4.1 Principio

O dashboard preserva integralmente o design visual existente:
- Layout: grid 2 colunas (main + aside 340px)
- Cards: `StatCard` com icon, value, trend, subtitle
- Graficos: Recharts com estilo tooltip customizado
- Cores: CSS variables (success, danger, surface, border, etc.)
- Animacoes: Framer Motion stagger
- Tipografia: Satoshi + Plus Jakarta Sans

O conteudo se adapta: widgets de modulos nao habilitados nao sao renderizados.

### 4.2 Hook `useTenantModules`

```typescript
// Zustand store alimentado por GET /auth/profile (retorna modules do tenant)
interface TenantModulesStore {
  modules: string[];
  setModules: (modules: string[]) => void;
  hasModule: (slug: string) => boolean;
}
```

Populado no login. O endpoint `GET /auth/profile` do app-api retorna os modulos habilitados do tenant (leitura do Redis cache ou fallback para DB).

### 4.3 Mapeamento Widget -> Modulo

| Widget | Modulo requerido | Sem modulo |
|--------|-----------------|------------|
| StatCard "Alunos" | `alunos` | Nao renderiza |
| StatCard "Saldo" | `financeiro` | Nao renderiza |
| "Motoristas em acao" | `motoristas` + `rastreamento` | Nao renderiza |
| Desempenho de rotas | `rotas` | Nao renderiza |
| Resumo financeiro | `financeiro` | Nao renderiza |
| Atividade por turno | `execucao` | Nao renderiza |
| Escolas em destaque | `escolas` | Nao renderiza |
| Comentarios/atividade | `rotas` | Atividade generica |
| StatCard "Veiculos ativos" | `veiculos` | Nao renderiza |
| StatCard "Rotas hoje" | `rotas` | Nao renderiza |

### 4.4 OverviewSection (sempre visivel)

- Nome do tenant
- Total de pessoas cadastradas
- Badges dos modulos ativos
- Ultimas atividades genericas (criacao de registros, logins)

### 4.5 Sidebar Adaptativa

O menu lateral tambem se adapta: items de navegacao so aparecem se o modulo correspondente esta habilitado.

```typescript
const menuItems = [
  { label: 'Dashboard', path: '/dashboard', icon: Home },              // sempre
  { label: 'Escolas', path: '/escolas', icon: School, module: 'escolas' },
  { label: 'Alunos', path: '/alunos', icon: Users, module: 'alunos' },
  { label: 'Motoristas', path: '/motoristas', icon: User, module: 'motoristas' },
  { label: 'Rotas', path: '/rotas', icon: Map, module: 'rotas' },
  { label: 'Veiculos', path: '/veiculos', icon: Truck, module: 'veiculos' },
  { label: 'Rastreamento', path: '/rastreamento', icon: Navigation, module: 'rastreamento' },
  { label: 'Historico', path: '/historico', icon: Clock, module: 'historico' },
  { label: 'Financeiro', path: '/financeiro', icon: DollarSign, module: 'financeiro' },
  { label: 'Mensagens', path: '/mensagens', icon: MessageSquare, module: 'mensagens' },
].filter(item => !item.module || hasModule(item.module));
```

### 4.6 API Backend

```
GET /dashboard/stats   → retorna stats filtradas pelos modulos ativos do tenant
GET /dashboard/charts  → retorna charts filtradas pelos modulos ativos do tenant
```

Exemplo de resposta para tenant com `motoristas` + `veiculos` + `rastreamento`:

```json
{
  "pessoas_total": 42,
  "motoristas_em_acao": 5,
  "veiculos_ativos": 8,
  "veiculos_total": 12
}
```

Campos de modulos nao habilitados (`alunos_total`, `rotas_hoje`) nao sao incluidos na resposta.

---

## 5. Plano de Fases

### Fase 1 — Foundation

**Objetivo:** Monorepo, schemas, shared package, service skeletons.

Baseado no Plan 1 original com alteracoes:
- Migration do schema `app` usa `pessoas` + profiles + `pontos_servico`
- Migration do schema `management` inclui `module_dependencies`
- Seed de modulos inclui grafo de dependencias
- `packages/shared` inclui types: `Pessoa`, `PontoServico`, `AlunProfile`, `MotoristaProfile`, `EscolaProfile`, `TenantModule`, `ModuleDependency`
- Mantido: monorepo pnpm, docker-compose, health endpoints, migrations runner

### Fase 2 — Management API

**Objetivo:** Auth superadmin, tenant CRUD, modulos com dependencias, licencas, convites, monitoring.

Baseado no Plan 2 original com alteracoes:
- `PUT /tenants/:id/modules` valida grafo de dependencias antes de habilitar/desabilitar
- Eventos `module:enabled`/`module:disabled` emitidos apos validacao
- Dashboard admin mostra dependencias entre modulos
- Mantido: Firebase auth, tenant CRUD, licencas, convites, anomaly detection, audit logs, cron

### Fase 3 — App API

**Objetivo:** Auth gestor/motorista, CRUDs sobre pessoa+profile, execucao, real-time.

Baseado no Plan 3 original com alteracoes:
- Todos os CRUDs operam sobre `pessoas` JOIN profile correspondente
- `POST /alunos` = cria pessoa(tipo='aluno') + aluno_profile em transacao
- `GET /motoristas` = `SELECT p.*, mp.* FROM pessoas p JOIN motorista_profiles mp ON ...`
- Module guard `requireModule(slug)` protege cada grupo de rotas
- `GET /dashboard/stats` e `/charts` filtram por modulos ativos
- `GET /auth/profile` retorna lista de modulos habilitados do tenant
- Socket.io e rastreamento operam sobre `pessoas` WHERE tipo='motorista'
- Mantido: auth Firebase, JWT, execucao, historico, mensagens, financeiro, tablet binding

### Fase 4 — Frontend Web

**Objetivo:** Conectar frontend ao novo backend, dashboard adaptativo, sidebar adaptativa.

Baseado no Plan 4 original com alteracoes:
- Hook `useTenantModules()` em Zustand, populado no login
- Dashboard adaptativo: widgets condicionais por `hasModule()`
- Sidebar adaptativa: menu items filtrados por modulo
- Pages de CRUD adaptadas para modelo pessoa + profile
- Tipos em `@rotavans/shared` refletem novo modelo
- Route guards: pagina de modulo nao habilitado redireciona para dashboard
- Mantido: todo design visual, Tailwind config, componentes UI, animacoes, Mapbox

### Fase 5 — Plataforma Comercial

**Objetivo:** Contratos, billing, organizacoes no management schema.

Novas entidades no schema `management`:
- `organizations` — Rotavans, parceiros, prefeituras
- `plans` — planos de assinatura
- `contracts` — contrato entre organizacao e tenant
- `contract_items` — itens do contrato (modulos, limites)
- `billing_accounts` — conta de cobranca
- `invoices` — faturas
- `payments` — pagamentos

Novas rotas no management-api:
- CRUD de organizations, plans, contracts
- Geracao de faturas
- Dashboard admin com visao comercial

### Fase 6 — Multi-vertical

**Objetivo:** Novos modulos de cadastro para verticais alem de escolar.

Novos modulos e profiles:
- `entregas` — `entrega_profiles` (extends pessoa: peso, volume, janela_entrega)
- `pontos_coleta` — `ponto_coleta_profiles` (extends ponto_servico: horario_funcionamento, tipo_carga)
- `passageiros_corporativos` — `passageiro_corp_profiles` (extends pessoa: empresa, cracha, rota_fixa)

Novas dependencias:
- `rotas` one_of_group 'passageiro': adicionar `entregas`, `passageiros_corporativos`

Templates de modulos pre-configurados:
- "Pacote Escolar": escolas + alunos + motoristas + veiculos + rotas + execucao
- "Pacote Delivery": pontos_coleta + entregas + motoristas + veiculos + rotas + execucao
- "Pacote Corporativo": passageiros_corporativos + motoristas + veiculos + rotas + execucao

### Fase 7 — Routing Engine

**Objetivo:** Motor de otimizacao como modulo interno do app-api.

Camadas:
1. **Ingestao** — recebe pontos, janelas, capacidades, restricoes, tipo de operacao
2. **Normalizacao** — transforma vertical para formato canonico (stops, vehicles, drivers, constraints)
3. **Optimization** — heuristicas, reordenacao, clustering, balanceamento
4. **Navigation Output** — sequencia otimizada, geometria, ETA, distancia

Integracao Mapbox com abstracao `RoutingProvider`:
- `MapboxDirectionsProvider` — rota ponto-a-ponto
- `MapboxOptimizationProvider` — sequencia otimizada (TSP)
- `MapboxMatrixProvider` — matriz de distancia/tempo

Politicas por vertical:
- Escolar: priorizar proximidade, respeitar turnos, capacidade do veiculo
- Delivery: janelas de entrega, minimizar tempo total, peso/volume
- Corporativo: horarios fixos, conforto, rota mais curta

Inicialmente modulo interno do app-api. Quando a complexidade crescer, extrai para servico proprio.

---

## 6. Tipos Compartilhados (`packages/shared`)

```typescript
// Entidades base
export interface Pessoa {
  id: number;
  tenant_id: number;
  firebase_uid?: string;
  tipo: 'aluno' | 'motorista' | 'responsavel' | 'operador' | 'gestor';
  nome: string;
  email?: string;
  telefone?: string;
  documento?: string;
  endereco?: string;
  lat?: number;
  lng?: number;
  foto_url?: string;
  ativo: boolean;
  criado_em: string;
}

export interface PontoServico {
  id: number;
  tenant_id: number;
  tipo: 'escola' | 'deposito' | 'cliente' | 'ponto_coleta';
  nome: string;
  endereco: string;
  lat?: number;
  lng?: number;
  criado_em: string;
}

// Profiles
export interface AlunoProfile {
  id: number;
  pessoa_id: number;
  escola_id?: number;
  turno?: 'manha' | 'tarde' | 'noite';
  cpf_responsavel?: string;
  telefone_responsavel?: string;
  responsavel_id?: number;
  serie?: string;
  necessidades_especiais?: string;
}

export interface MotoristaProfile {
  id: number;
  pessoa_id: number;
  cnh?: string;
  categoria_cnh?: string;
  validade_cnh?: string;
  pin_hash?: string;
  documento_url?: string;
  convite_token?: string;
  convite_expira_em?: string;
  cadastro_completo: boolean;
}

export interface EscolaProfile {
  id: number;
  ponto_servico_id: number;
  turno_manha: boolean;
  turno_tarde: boolean;
  turno_noite: boolean;
  horario_entrada_manha?: string;
  horario_saida_manha?: string;
  horario_entrada_tarde?: string;
  horario_saida_tarde?: string;
  horario_entrada_noite?: string;
  horario_saida_noite?: string;
}

// Compostos (retornados pelas APIs)
export interface Aluno extends Pessoa {
  profile: AlunoProfile;
}

export interface Motorista extends Pessoa {
  profile: MotoristaProfile;
}

export interface Escola extends PontoServico {
  profile: EscolaProfile;
}

// Modulos
export interface TenantModule {
  slug: string;
  nome: string;
  tipo: 'cadastro' | 'operacional' | 'suporte';
  habilitado: boolean;
}

export interface ModuleDependency {
  module_slug: string;
  depends_on_slug: string;
  tipo: 'required' | 'one_of_group';
  grupo?: string;
}

// Dashboard
export interface DashboardStats {
  pessoas_total: number;
  veiculos_ativos?: number;
  veiculos_total?: number;
  motoristas_em_acao?: number;
  rotas_hoje?: number;
  alunos_total?: number;
}

export interface DashboardChartData {
  rotas_por_dia?: Array<{ data: string; total: number }>;
  alunos_por_escola?: Array<{ escola: string; total: number }>;
  financeiro_mensal?: Array<{ mes: string; receitas: number; despesas: number }>;
  atividade_por_turno?: Array<{ turno: string; rotas: number }>;
}

// JWT payloads
export interface AppTokenPayload {
  sub: number;
  tenant_id: number;
  role: 'gestor' | 'motorista';
  firebase_uid: string;
  nome: string;
  email?: string;
  iat?: number;
  exp?: number;
}
// Nota: modulos habilitados NAO sao incluidos no JWT para evitar token grande
// e problemas de staleness. O frontend obtem modulos via GET /auth/profile
// e armazena no Zustand store. O backend usa Redis cache para module guards.
```

---

## 7. Notas de Implementacao

### 7.1 Padrao de CRUD com Pessoa + Profile

Toda operacao de criacao/edicao de entidades baseadas em pessoa segue:

```typescript
// POST /alunos
async function createAluno(req, res) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pessoa = await client.query(
      `INSERT INTO app.pessoas (tenant_id, tipo, nome, email, telefone, documento, endereco, lat, lng)
       VALUES ($1, 'aluno', $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [req.tenantId, req.body.nome, req.body.email, ...]
    );

    const profile = await client.query(
      `INSERT INTO app.aluno_profiles (pessoa_id, escola_id, turno, cpf_responsavel, ...)
       VALUES ($1, $2, $3, $4, ...) RETURNING *`,
      [pessoa.rows[0].id, req.body.escola_id, ...]
    );

    await client.query('COMMIT');
    res.status(201).json({ ...pessoa.rows[0], profile: profile.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
```

### 7.2 Module Guard Middleware

```typescript
function requireModule(slug: string) {
  return async (req, res, next) => {
    const enabled = await checkModuleEnabled(req.tenantId, slug);
    if (!enabled) {
      return res.status(403).json({ error: `Modulo '${slug}' nao habilitado para este tenant` });
    }
    next();
  };
}

// Uso:
router.get('/alunos', requireModule('alunos'), listAlunos);
router.post('/alunos', requireModule('alunos'), createAluno);
```

### 7.3 Compatibilidade com Specs Existentes

Este design substitui e estende os Plans 1-4 originais. As specs de arquitetura (`architecture-rewrite-design.md`), eventos (`ownership-matrix-and-event-catalog.md`), e routing (`mapbox-navigation-and-routing-strategy.md`) permanecem validas. As mudancas sao:

- Schema `app`: `pessoas` + profiles substituem tabelas separadas `alunos`/`motoristas`/`gestores`
- Schema `app`: `pontos_servico` + profiles substituem tabela `escolas`
- Schema `management`: adiciona `module_dependencies`
- Seed de modulos: inclui grafo de dependencias
- Eventos: sem mudanca (payloads usam `pessoa_id` onde antes usavam `aluno_id`/`motorista_id`)
- Frontend: adiciona hook `useTenantModules()`, dashboard e sidebar adaptativos
