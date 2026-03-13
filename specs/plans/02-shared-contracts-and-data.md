# Plano 02 - Shared Contracts and Data

## Objetivo

Travar os contratos compartilhados e o banco inicial antes de abrir a implementacao completa das APIs.

## Fonte de verdade

- `../2026-03-12-modular-platform-implementation-design.md`
- `../2026-03-12-ownership-matrix-and-event-catalog.md`
- `../2026-03-12-mapbox-navigation-and-routing-strategy.md`

## Escopo

- tipos compartilhados de dominio
- eventos cross-service com envelope
- JWT payloads
- schema `management`
- schema `app`
- seed de modulos e dependencias
- outbox e inbox por service

## Entidades obrigatorias

- `management.modules`
- `management.module_dependencies`
- `management.tenant_modules`
- `app.pessoas`
- `app.aluno_profiles`
- `app.motorista_profiles`
- `app.pontos_servico`
- `app.escola_profiles`
- tabelas operacionais adaptadas para `pessoa_id`

## Tarefas

1. Escrever tipos `Pessoa`, `PontoServico`, `AlunoProfile`, `MotoristaProfile`, `EscolaProfile`.
2. Definir `TenantModule`, `ModuleDependency`, `DashboardStats`, `DashboardChartData`.
3. Definir eventos com envelope padrao e payloads versionados.
4. Criar migrations de `management` com seeds de modulos.
5. Criar migrations de `app` com entidades base e operacionais.
6. Criar `outbox_events` e `inbox_events` em ambos os schemas.

## Validacoes essenciais

- `rotas` depende de `motoristas`, `veiculos` e `one_of_group: passageiro`
- `alunos` depende de `escolas`
- `execucao` depende de `rotas`
- `rastreamento` depende de `motoristas` e `veiculos`
- `historico` depende de `execucao`

## Critero de conclusao

- migrations aplicam do zero
- seed cria todos os modulos esperados
- grafo de dependencias fica consultavel no banco
- `packages/shared` exporta os tipos usados por backend e frontend

## Dependencias para proxima fase

- shared estabilizado
- banco pronto para leitura e escrita
