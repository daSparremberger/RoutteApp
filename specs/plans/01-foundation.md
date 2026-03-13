# Plano 01 - Foundation

## Objetivo

Criar a base tecnica do rewrite com dois services, schema modular nativo e estrutura pronta para trabalho paralelo.

## Fonte de verdade

- `../2026-03-12-modular-platform-implementation-design.md`
- `../2026-03-11-architecture-rewrite-design.md`

## Escopo

- monorepo com `services/management-api` e `services/app-api`
- `packages/shared`
- docker-compose para Postgres e Redis
- migrations runner em ambos os services
- health endpoints
- `.env.example`

## Decisoes obrigatorias

- schema `app` ja nasce com `pessoas`, `pontos_servico` e tabelas de `profiles`
- schema `management` ja nasce com `module_dependencies`
- nada novo deve usar as tabelas antigas `alunos`, `motoristas`, `escolas` do plano antigo

## Entregaveis

- root workspace funcionando
- dois services compilando
- migrations executando
- Postgres com schemas `management` e `app`
- Redis acessivel para cache e eventos

## Tarefas

1. Ajustar `pnpm-workspace` e `package.json` raiz.
2. Criar skeleton dos dois services com TypeScript, Express e testes minimos.
3. Criar `packages/shared` com build separado.
4. Adicionar `docker-compose.yml` com Postgres 15 e Redis 7.
5. Criar migrations runner idempotente por schema.
6. Subir `/health` em ambos os services.

## Critero de conclusao

- `pnpm test` passa nos dois services
- `pnpm build` passa no shared e nos dois services
- `pnpm migrate` cria schemas sem erro
- `GET /health` responde em `management-api` e `app-api`

## Dependencias para proxima fase

- base de monorepo estabilizada
- ambiente local reproduzivel
- migrations funcionando
