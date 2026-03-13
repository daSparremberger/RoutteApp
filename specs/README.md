# Rotavans - Indice de Especificacoes

## Estrutura

- `specs/*.md`
  Documentos ativos e autoritativos para o rewrite atual.
- `specs/plans/`
  Planos de implementacao por fase, derivados das specs ativas.
- `specs/archive/`
  Documentos antigos, superseded ou mantidos apenas como historico.
- `specs/prototypes/`
  Material de referencia de interface e UX. Nao e source of truth de backend.

## Specs Ativas

| Arquivo | Papel |
|---|---|
| `2026-03-12-modular-platform-implementation-design.md` | Documento principal. Autoritativo para schema `app`, heranca de dominio, `management.module_dependencies`, dashboard adaptativo e fases macro. |
| `2026-03-11-architecture-rewrite-design.md` | Arquitetura base do rewrite: dois services, Postgres, Redis, auth, realtime, rotas principais e fluxo operacional. |
| `2026-03-12-ownership-matrix-and-event-catalog.md` | Ownership entre services, envelope de eventos, outbox/inbox e projecoes runtime. |
| `2026-03-12-mapbox-navigation-and-routing-strategy.md` | Estrategia de routing, abstracoes internas e regras de decisao para Mapbox. |

## Arquivo Principal a Seguir

Se houver conflito:

1. `2026-03-12-modular-platform-implementation-design.md`
2. `2026-03-11-architecture-rewrite-design.md`
3. `2026-03-12-ownership-matrix-and-event-catalog.md`
4. `2026-03-12-mapbox-navigation-and-routing-strategy.md`

## Archive

Arquivos em `archive/` nao devem guiar implementacao nova sem reconciliar com as specs ativas.

- `2026-03-12-domain-model-spec.md`
  Historico. Parcialmente substituido pela modelagem `pessoas` + `profiles`.
- `2026-03-12-relational-schema-spec.md`
  Historico. Substituido onde conflita com o schema modular atual.
- `2026-03-12-foundation.md`
  Plano antigo util como referencia de sequencia, mas precisa ser reinterpretado com a modelagem nova.
- `2026-03-12-management-api.md`
  Plano antigo util como referencia de escopo, mas nao autoritativo em schema.
- `2026-03-12-platform-modular-architecture-plan.md`
  Contexto estrategico. Foi consolidado no design modular atual.

## Prototypes

`specs/prototypes/web-dashboard/` contem um frontend de referencia.

- Util: `src/`, `package.json`, `tailwind.config.ts`, `vite.config.ts`
- Nao autoritativo: `dist/`, `node_modules/`, `.env`

Esses artefatos podem ser ignorados ao planejar backend e contratos.
