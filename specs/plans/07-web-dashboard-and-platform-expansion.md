# Plano 07 - Web Dashboard and Platform Expansion

## Objetivo

Conectar a UI existente ao backend novo e preparar a extensao para plataforma comercial e multi-vertical.

## Fonte de verdade

- `../2026-03-12-modular-platform-implementation-design.md`
- `../2026-03-12-mapbox-navigation-and-routing-strategy.md`
- `../prototypes/web-dashboard/`

## Escopo da parte web

- adaptar login para `management-api` e `app-api`
- adicionar store `useTenantModules`
- dashboard adaptativo
- sidebar adaptativa
- route guards por modulo
- tipos alinhados com `@rotavans/shared`

## Escopo da parte plataforma

- contratos, planos, faturamento
- onboarding e implantacao
- novos modulos por vertical
- routing engine V1

## Tarefas web

1. Separar cliente API de admin e app.
2. Ajustar auth store para modules via `/auth/profile`.
3. Implementar `useTenantModules`.
4. Filtrar menu da sidebar por modulo.
5. Adaptar `Dashboard.tsx` para widgets condicionais.
6. Ajustar CRUDs da web para payloads base + profile.
7. Redirecionar paginas sem modulo para dashboard.

## Tarefas plataforma

1. Adicionar `organizations`, `plans`, `contracts`, `contract_items`.
2. Adicionar `billing_accounts`, `invoices`, `payments`.
3. Adicionar `implementation_projects` e `implementation_tasks`.
4. Introduzir novos modulos de passageiro e ponto de servico por vertical.
5. Implementar `RoutingProvider` e `NavigationDecisionEngine`.
6. Persistir `optimization_requests` e `optimization_results`.

## Prototipo web: o que reaproveitar

- layout
- componentes UI
- dashboard visual
- tema e design tokens
- paginas de admin e operacao como referencia de IA/UX

## Prototipo web: o que nao seguir cegamente

- chamadas diretas para uma unica API base
- menu fixo de modulos
- tipos antigos acoplados ao modelo escolar
- artefatos gerados em `dist/` e `node_modules/`

## Critero de conclusao

- tenant com todos os modulos ve dashboard completo
- tenant parcial ve dashboard reduzido sem quebrar layout
- control plane passa a suportar contrato e faturamento
- app fica pronto para novos modulos de vertical
