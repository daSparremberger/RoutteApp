# Plano Mestre de Implementacao

## Objetivo

Executar o rewrite da plataforma com modularizacao nativa, preservando o design atual do dashboard e preparando a evolucao para plataforma comercial multi-vertical.

## Fonte de verdade

- `../2026-03-12-modular-platform-implementation-design.md`
- `../2026-03-11-architecture-rewrite-design.md`
- `../2026-03-12-ownership-matrix-and-event-catalog.md`
- `../2026-03-12-mapbox-navigation-and-routing-strategy.md`

## Principios de execucao

- Implementar direto no modelo `pessoas` + `profiles`.
- Tratar `management-api` como control plane e `app-api` como operacao.
- Nao usar `archive/` como referencia final sem reconciliar com as specs ativas.
- Preservar o visual do dashboard; mudar comportamento e contratos, nao a identidade visual.
- Fazer cada fase entregar algo verificavel.

## Ordem recomendada

1. Foundation
2. Shared contracts e database baseline
3. Management API
4. Event bus e runtime projections
5. App API auth e CRUDs base
6. Fluxos operacionais e realtime
7. Web e adaptacao modular
8. Expansao comercial
9. Multi-vertical
10. Routing engine

## Estrategia por terminal

### Terminal 1

Responsavel por infra e foundation.

- workspace
- docker-compose
- envs
- services skeleton
- migrations runner

### Terminal 2

Responsavel por contratos compartilhados e banco.

- `packages/shared`
- migrations `management`
- migrations `app`
- seeds de modulos

### Terminal 3

Responsavel por `management-api`.

- auth superadmin
- tenants
- licencas
- modulos
- invites
- dashboard admin

### Terminal 4

Responsavel por eventos e projecoes.

- outbox
- inbox
- publisher
- subscriber
- Redis projections

### Terminal 5

Responsavel por `app-api`.

- auth gestor e motorista
- guards
- CRUDs base
- operacao
- realtime

### Terminal 6

Responsavel por web.

- auth stores
- modulo store
- sidebar adaptativa
- dashboard adaptativo
- integracao admin e app

## Fase 1 - Foundation

### Objetivo

Subir a espinha dorsal do projeto.

### Entregaveis

- monorepo organizado
- `management-api` e `app-api` compilando
- `packages/shared` compilando
- Postgres e Redis locais
- health endpoints

### Tarefas

1. Ajustar `pnpm-workspace.yaml`.
2. Ajustar `package.json` raiz com scripts por service.
3. Criar `services/management-api`.
4. Criar `services/app-api`.
5. Criar configs TS/Jest/minimo de cada service.
6. Criar `docker-compose.yml`.
7. Criar `.env.example`.
8. Criar `GET /health` nos dois services.

### Validacao

- `pnpm build`
- `pnpm test`
- `docker compose up -d`
- `GET /health` em ambas as portas

### Risco principal

Comecar com estrutura de pastas errada e depois refatorar tudo. Essa fase precisa fechar isso de vez.

## Fase 2 - Shared Contracts and Database Baseline

### Objetivo

Fixar tipos e banco antes da regra de negocio.

### Entregaveis

- tipos compartilhados versionados
- eventos versionados
- migrations finais dos schemas
- seed de modulos e dependencias
- tabelas de outbox/inbox

### Tarefas

1. Criar tipos base: `Pessoa`, `PontoServico`, `AlunoProfile`, `MotoristaProfile`, `EscolaProfile`.
2. Criar tipos compostos: `Aluno`, `Motorista`, `Escola`.
3. Criar tipos de dashboard e tokens JWT.
4. Criar contrato de eventos com envelope.
5. Criar migration `management` com `modules`, `module_dependencies`, `tenant_modules`, `licenses`, `audit_logs`, `tenant_metrics`, `anomaly_alerts`, `gestor_invites`.
6. Criar migration `app` com `pessoas`, `profiles`, `pontos_servico`, `veiculos`, `rotas`, `rota_paradas`, `execucoes`, `historico`, `mensagens`, `cobrancas`, vinculos.
7. Criar `outbox_events` e `inbox_events`.
8. Criar seed do grafo inicial de modulos.

### Validacao

- rodar migrations em banco limpo
- validar seed por consulta SQL
- compilar `packages/shared`

### Risco principal

Voltar a modelagem antiga de `alunos` e `motoristas` como tabelas principais. Nao fazer isso.

## Fase 3 - Management API

### Objetivo

Colocar o control plane em operacao.

### Entregaveis

- login superadmin
- CRUD de tenants
- licencas
- modulos com grafo de dependencias
- convites de gestor
- dashboard admin
- anomalies cron

### Tarefas

1. Inicializar Firebase Admin.
2. Implementar JWT de management.
3. Criar middleware `requireSuperAdmin`.
4. Implementar `POST /auth/login`.
5. Implementar `GET/POST/PUT/DELETE /tenants`.
6. Implementar `PUT /tenants/:id/license`.
7. Implementar `GET /modules`.
8. Implementar `PUT /tenants/:id/modules`.
9. Implementar `POST /tenants/:id/invite`.
10. Implementar `GET /dashboard`.
11. Implementar `GET /tenants/:id/metrics`.
12. Implementar `GET /tenants/:id/audit`.
13. Implementar `GET /anomalies` e `PATCH /anomalies/:id/resolve`.
14. Implementar cron de anomalias com lock Redis.

### Validacao

- tenant criado com license default
- modulo bloqueado sem prerequisito
- desabilitacao bloqueada quando ha dependente
- invite de gestor emitido
- dashboard admin retorna visao minima

### Risco principal

Implementar modulos como booleanos soltos sem consultar `module_dependencies`.

## Fase 4 - Event Bus and Runtime Projections

### Objetivo

Fazer a integracao entre services funcionar sem acoplamento HTTP.

### Entregaveis

- outbox transacional
- dispatcher
- subscribers
- inbox idempotente
- cache Redis para tenant, modules e license

### Tarefas

1. Criar gravacao em outbox no mesmo commit das mutacoes do `management-api`.
2. Criar worker de publish.
3. Criar subscriber do `app-api` para eventos de governanca.
4. Criar subscriber do `management-api` para eventos operacionais.
5. Projetar `tenant:{id}:active`.
6. Projetar `module:{tenant_id}:{slug}`.
7. Projetar `modules:{tenant_id}`.
8. Projetar `license:{tenant_id}`.
9. Implementar inbox e checagem por `event_id`.

### Validacao

- desativar tenant no `management-api` bloqueia auth no `app-api`
- habilitar modulo reflete no runtime sem restart
- login operacional gera auditoria no `management-api`

### Risco principal

Publicar no Redis sem persistencia de outbox e perder evento em falha intermediaria.

## Fase 5 - App API Auth and Base CRUDs

### Objetivo

Abrir o produto operacional usando o modelo modular certo.

### Entregaveis

- auth gestor e motorista
- guards de tenant e modulo
- `/auth/profile`
- CRUD de motoristas
- CRUD de alunos
- CRUD de escolas
- CRUD de veiculos

### Tarefas

1. Inicializar Firebase Admin no `app-api`.
2. Implementar JWT do app.
3. Implementar `POST /auth/login`.
4. Implementar `GET /auth/profile`.
5. Implementar convites e aceite.
6. Implementar `requireTenantActive`.
7. Implementar `requireModule`.
8. Implementar CRUD de `motoristas` via `pessoas` + `motorista_profiles`.
9. Implementar CRUD de `alunos` via `pessoas` + `aluno_profiles`.
10. Implementar CRUD de `escolas` via `pontos_servico` + `escola_profiles`.
11. Implementar CRUD de `veiculos`.

### Validacao

- login retorna usuario e tenant corretos
- `/auth/profile` retorna modulos ativos
- endpoint sem modulo responde `403`
- entidades base criadas via transacao

### Risco principal

Misturar `gestores` fora de `pessoas` por conveniencia e criar inconsistencia de dominio.

## Fase 6 - Operational Flows and Realtime

### Objetivo

Fechar o ciclo operacional principal do produto.

### Entregaveis

- rotas
- execucao
- historico
- mensagens
- financeiro basico
- tracking realtime
- tablet binding
- PIN login

### Tarefas

1. Implementar CRUD de rotas.
2. Implementar `PUT /rotas/:id/paradas`.
3. Implementar `POST /execucao/iniciar`.
4. Implementar `POST /execucao/:id/parada`.
5. Implementar `POST /execucao/:id/finalizar`.
6. Implementar `POST /execucao/:id/cancelar`.
7. Implementar `GET /historico`.
8. Implementar mensagens REST e Socket.io.
9. Implementar cobrancas basicas.
10. Implementar Socket.io com Redis adapter.
11. Implementar cache de localizacao em Redis.
12. Implementar `tablet_vinculos`.
13. Implementar `veiculo_motorista`.
14. Implementar PIN set, verify e login.

### Validacao

- rota criada com paradas ordenadas
- execucao finalizada grava snapshot em `historico`
- gestor recebe localizacao em tempo real
- motorista consegue login por PIN em tablet vinculado

### Risco principal

Guardar estado realtime em memoria do processo e inviabilizar escala horizontal.

## Fase 7 - Web and Adaptive Dashboard

### Objetivo

Conectar o frontend existente ao backend novo mantendo o design.

### Entregaveis

- auth de admin separado de gestor
- store de modulos
- menu lateral adaptativo
- dashboard adaptativo
- paginas CRUD compativeis com base + profile

### Tarefas

1. Separar cliente de `management-api` e `app-api`.
2. Ajustar auth store.
3. Implementar `useTenantModules`.
4. Adaptar `Sidebar`.
5. Adaptar `Dashboard`.
6. Ajustar pages de `Alunos`, `Motoristas`, `Escolas`, `Veiculos`.
7. Ajustar admin pages para control plane.
8. Implementar guards de rota por modulo.

### Validacao

- tenant com todos os modulos ve dashboard completo
- tenant parcial ve widgets e menus corretos
- design visual permanece consistente com o prototipo

### Risco principal

Acoplar a web ao modelo antigo e quebrar a adaptacao futura por modulo.

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

## Fase 9 - Multi-vertical

### Objetivo

Generalizar o produto para novos tipos de operacao.

### Entregaveis

- modulos novos de passageiro ou carga
- novos profiles
- templates por segmento

### Tarefas

1. Criar novos modulos como `entregas` e `passageiros_corporativos`.
2. Criar `profiles` correspondentes.
3. Expandir grupo `one_of_group: passageiro`.
4. Criar templates de pacote por segmento.

### Validacao

- `rotas` continua exigindo pelo menos um modulo do grupo passageiro
- dominio escolar segue funcionando sem regressao

## Fase 10 - Routing Engine

### Objetivo

Criar o nucleo inteligente de roteirizacao atras de uma abstracao interna.

### Entregaveis

- `RoutingProvider`
- `NavigationDecisionEngine`
- `optimization_requests`
- `optimization_results`
- adaptadores Mapbox

### Tarefas

1. Criar contrato interno de routing.
2. Implementar heuristica de decisao.
3. Implementar `Directions`, `Matrix`, `Optimization`, `Map Matching`.
4. Persistir requests e resultados.
5. Integrar otimização ao fluxo de rotas.

### Validacao

- caso simples usa `Directions`
- caso sem ordem definida usa `Optimization` ou `Matrix + heuristic`
- historico pode consumir geometria corrigida por `Map Matching`

## Marcos de entrega

### Marco A

Ao final da Fase 3:

- control plane funcional

### Marco B

Ao final da Fase 6:

- produto operacional funcional

### Marco C

Ao final da Fase 7:

- dashboard conectado e adaptativo

### Marco D

Ao final da Fase 10:

- plataforma pronta para expansao comercial e multi-vertical

## O que nao fazer

- nao usar `archive` como blueprint final
- nao criar dependencia HTTP sincrona entre `management-api` e `app-api`
- nao voltar para tabelas separadas como raiz do dominio
- nao embutir modulos no JWT
- nao deixar localizacao ou sessoes criticas apenas em memoria

## Proximo passo recomendado

Executar `01-foundation.md` e `02-shared-contracts-and-data.md` em paralelo, mas fechando primeiro as migrations e contratos antes de abrir CRUDs das APIs.
