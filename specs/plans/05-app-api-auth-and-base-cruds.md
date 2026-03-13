# Plano 05 - App API: Auth and Base CRUDs

## Objetivo

Abrir a camada operacional com autenticacao correta, guards por tenant/modulo e CRUDs no modelo base + profile.

## Fonte de verdade

- `../2026-03-12-modular-platform-implementation-design.md`
- `../2026-03-11-architecture-rewrite-design.md`

## Escopo

- auth gestor e motorista
- convites e onboarding
- `/auth/profile`
- guards `requireTenantActive` e `requireModule`
- CRUD de alunos
- CRUD de motoristas
- CRUD de escolas
- CRUD de veiculos

## Padrao de implementacao

- criar entidade base e profile na mesma transacao
- listar por join base + profile
- manter `gestor` em `pessoas` sem profile
- usar `pontos_servico` + `escola_profiles` para escolas

## Tarefas

1. Implementar Firebase auth + JWT do app.
2. Implementar aceite de convite para gestor e motorista.
3. Implementar `/auth/profile` retornando usuario atual e modulos habilitados.
4. Implementar `requireTenantActive`.
5. Implementar `requireModule(slug)`.
6. Implementar rotas de `motoristas`.
7. Implementar rotas de `alunos`.
8. Implementar rotas de `escolas`.
9. Implementar rotas de `veiculos`.

## Regras importantes

- endpoint sem modulo habilitado deve responder `403`
- consultas sempre filtram por `tenant_id`
- `rotas.motorista_id` so aceita pessoa de tipo motorista na camada de aplicacao

## Critero de conclusao

- gestor autenticado consegue ver seu profile e modulos
- tenant desativado e bloqueado
- CRUDs funcionam no modelo `pessoas` + `profiles`
- frontend ja consegue consumir os cadastros base

## Dependencias para proxima fase

- base operacional pronta
- entities fundamentais persistidas corretamente
