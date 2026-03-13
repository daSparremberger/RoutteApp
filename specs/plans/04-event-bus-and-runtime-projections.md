# Plano 04 - Event Bus and Runtime Projections

## Objetivo

Implementar a comunicacao assíncrona entre services de forma segura, com projecoes de runtime e idempotencia.

## Fonte de verdade

- `../2026-03-12-ownership-matrix-and-event-catalog.md`
- `../2026-03-11-architecture-rewrite-design.md`

## Escopo

- outbox publisher
- inbox consumer
- envelope de evento
- projecoes em Redis para tenant, modulos e licenca
- subscriber do management para eventos operacionais
- guardas de idempotencia

## Projecoes runtime obrigatorias

- `tenant:{tenant_id}:active`
- `module:{tenant_id}:{slug}`
- `modules:{tenant_id}`
- `license:{tenant_id}`

## Tarefas

1. Implementar gravacao de outbox no mesmo commit das mutacoes relevantes.
2. Implementar dispatcher que publica eventos pendentes no Redis.
3. Implementar inbox por consumer para evitar processamento duplicado.
4. Projetar eventos de `tenant`, `module` e `license` no Redis consumidos pelo `app-api`.
5. Projetar eventos operacionais consumidos pelo `management-api` para auditoria e metricas.
6. Instrumentar logs de `event_id`, `correlation_id` e `causation_id`.

## Eventos minimos da fase

- `tenant.created`
- `tenant.deactivated`
- `tenant.module.enabled`
- `tenant.module.disabled`
- `license.updated`
- `user.logged_in`
- `device.bound`
- `device.unbound`
- `execution.started`
- `execution.completed`

## Critero de conclusao

- nenhuma mudanca de tenant/modulo/licenca depende de HTTP entre services
- `app-api` bloqueia tenant desativado via Redis projection
- `management-api` registra login e uso via consumo de evento

## Dependencias para proxima fase

- cache e governanca de runtime prontos
- base para guards do `app-api`
