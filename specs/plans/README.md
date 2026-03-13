# Planos de Implementacao

Os planos desta pasta sao a sequencia recomendada para executar o rewrite com modularizacao nativa.

## Ordem

0. `00-master-implementation-plan.md`
1. `01-foundation.md`
2. `02-shared-contracts-and-data.md`
3. `03-management-api.md`
4. `04-event-bus-and-runtime-projections.md`
5. `05-app-api-auth-and-base-cruds.md`
6. `06-operational-flows-and-realtime.md`
7. `07-web-dashboard-and-platform-expansion.md`

## Regra

Cada plano assume que os anteriores ja entregaram:

- schema coerente;
- contratos compartilhados estaveis;
- guards de tenant/modulo;
- ownership entre services respeitado.
