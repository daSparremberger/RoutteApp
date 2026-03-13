# Plano 06 - Operational Flows and Realtime

## Objetivo

Fechar o fluxo operacional principal: rotas, execucao, historico, rastreamento, mensagens e vinculacao de tablet.

## Fonte de verdade

- `../2026-03-11-architecture-rewrite-design.md`
- `../2026-03-12-modular-platform-implementation-design.md`
- `../2026-03-12-mapbox-navigation-and-routing-strategy.md`

## Escopo

- rotas e paradas
- execucao e execucao_paradas
- historico imutavel
- mensagens
- financeiro basico
- Socket.io com Redis adapter
- location cache em Redis
- `tablet_vinculos`
- `veiculo_motorista`
- login por PIN em tablet vinculado

## Tarefas

1. Implementar CRUD de rotas e `rota_paradas`.
2. Implementar inicio, parada, finalizacao e cancelamento de execucao.
3. Persistir snapshot em `historico` na finalizacao.
4. Implementar dashboard stats/charts filtrados por modulos ativos.
5. Implementar chat e marcacao de leitura.
6. Implementar cobrancas basicas.
7. Conectar Socket.io ao Redis adapter.
8. Persistir localizacao ativa em Redis com TTL.
9. Implementar vinculacao e desvinculacao de tablet.
10. Implementar login por PIN com `X-Device-ID`.

## Regras importantes

- `historico` e escrito apenas pelo `app-api`
- localizacao nao fica em memoria do processo
- `motorista_offline` nasce do `disconnect`, nao de keyspace notifications
- eventos operacionais relevantes alimentam o `management-api`

## Critero de conclusao

- rota pode ser criada, executada e finalizada
- historico preserva snapshot denormalizado
- gestor recebe localizacao em tempo real
- motorista consegue operar tablet vinculado

## Dependencias para proxima fase

- backend operacional completo para a web
- base pronta para adaptacao do dashboard
