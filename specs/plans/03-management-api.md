# Plano 03 - Management API

## Objetivo

Implementar o control plane com auth superadmin, governanca de tenant, licenca, modulos, convites e monitoramento.

## Fonte de verdade

- `../2026-03-11-architecture-rewrite-design.md`
- `../2026-03-12-modular-platform-implementation-design.md`
- `../2026-03-12-ownership-matrix-and-event-catalog.md`

## Escopo

- login superadmin via Firebase
- JWT de management
- CRUD de tenants
- CRUD de licencas
- habilitacao e desabilitacao de modulos com validacao do grafo
- convites de gestor
- dashboard admin
- auditoria
- anomalias

## Regras que nao podem ser quebradas

- `management-api` e owner de tenants, licencas, modules e tenant_modules
- `app-api` nunca escreve nessas tabelas
- habilitar modulo exige validacao de `required` e `one_of_group`
- desabilitar modulo deve bloquear dependentes ativos

## Tarefas

1. Inicializar Firebase Admin e JWT utilities.
2. Implementar middleware `requireSuperAdmin`.
3. Criar rotas de auth.
4. Criar CRUD de tenants com licenca default e habilitacao inicial de modulos.
5. Implementar `PUT /tenants/:id/modules` com validacao do grafo.
6. Criar rotas de licenca.
7. Criar convites de gestor.
8. Criar endpoints de dashboard admin, metrics, audit e anomalies.
9. Preparar cron de anomalias.

## Respostas minimas esperadas

- `GET /tenants/:id` retorna tenant, license, modules e metricas
- `GET /modules` retorna catalogo e dependencias
- `PUT /tenants/:id/modules` retorna erro legivel com prerequisitos faltantes

## Critero de conclusao

- tenant pode ser criado e desativado
- licenca pode ser atualizada
- modulo nao habilita fora das regras
- invite de gestor pode ser emitido
- dashboard admin entrega visao minima por tenant

## Dependencias para proxima fase

- eventos de governanca definidos
- runtime do tenant pronto para ser projetado no `app-api`
