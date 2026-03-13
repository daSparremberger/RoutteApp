# Rotavans - Plano Mestre de Arquitetura Modular e Escalavel
**Data:** 2026-03-12  
**Status:** Proposta consolidada a partir do estado atual do repositorio

---

## 1. Objetivo do plano

Definir uma base de produto e arquitetura que permita:

- atender prefeituras e empresas privadas na mesma plataforma;
- vender por modulos e por tipo de licenciamento;
- operar com multi-tenant real;
- manter banco relacional com baixa duplicidade;
- escalar com arquitetura orientada a eventos;
- separar claramente a camada de gestao comercial/implantacao da camada operacional do produto;
- suportar app mobile em Flutter, desktop em Electron e um pacote futuro que combine operacao + gestao.

Este plano parte do que ja existe no projeto e organiza a evolucao para uma arquitetura mais robusta, sem ficar preso ao desenho atual de transporte escolar apenas.

---

## 2. Leitura do estado atual

### O que ja existe e deve ser reaproveitado

- `api/` atual ja possui CRUD operacional para tenants, gestores, motoristas, alunos, escolas, rotas, execucao, mensagens, financeiro e dashboard.
- O painel admin atual ja cobre a base de:
  - estatisticas gerais;
  - listagem de tenants;
  - criacao/edicao de tenant;
  - geracao de convite para gestor.
- O frontend web atual ja possui telas administrativas e operacionais.
- Ja existe direcao documentada para reescrever em:
  - `management-api`;
  - `app-api`;
  - eventos via Redis;
  - Postgres com schemas separados.

### O que esta fraco no modelo atual

- o dominio ainda esta muito acoplado a transporte escolar;
- licenciamento ainda nao esta modelado como produto vendavel por modulo e por consumo;
- nao existe separacao suficiente entre:
  - controle comercial e implantacao;
  - operacao diaria do cliente;
  - motor de roteirizacao/otimizacao;
- o banco atual mistura entidades de controle da plataforma com entidades operacionais;
- o conceito de empresa privada ainda nao esta tratado como caso de uso de primeira classe;
- a estrategia de apps ainda esta duplicada entre React Native e Flutter.

---

## 3. Direcao recomendada

### Decisao principal

Adotar uma arquitetura em 3 dominios lógicos, com 2 APIs principais separadas em Git, e um motor de otimização tratado como componente especializado.

### Dominio 1: Control Plane

Responsavel por:

- CRM de vendas;
- onboarding e implantacao;
- tenants;
- contratos;
- licencas;
- modulos habilitados;
- billing;
- auditoria da plataforma;
- usuarios internos da Rotavans;
- catalogo de produto.

### Dominio 2: Operational Platform

Responsavel por:

- operacao do cliente;
- gestores do tenant;
- motoristas;
- veiculos;
- dispositivos;
- passageiros/alunos/entregas;
- rotas, paradas, execucoes;
- telemetria;
- mensagens;
- relatorios operacionais.

### Dominio 3: Routing Engine

Responsavel por:

- geocoding;
- matriz de distancia/tempo;
- sequenciamento de paradas;
- recalculo;
- heuristicas de otimizacao;
- regras por tipo de operacao.

Pragmaticamente, o Routing Engine pode iniciar dentro do `app-api` como modulo interno. Quando a complexidade e carga crescerem, ele vira servico proprio.

---

## 4. Repositorios recomendados

## Estrutura minima obrigatoria

### Repo 1: `rotavans-control-plane`

Conteudo:

- `management-api`
- web admin/comercial/implantacao
- desktop admin em Electron
- SDKs/OpenAPI client do control plane

### Repo 2: `rotavans-operations`

Conteudo:

- `app-api`
- web operacional do cliente
- app Flutter do motorista
- app desktop operacional
- futuro apk hibrido operacional + dashboard leve

## Estrutura adicional recomendada

### Repo opcional 3: `rotavans-contracts`

Conteudo:

- contratos OpenAPI;
- schemas Avro/JSON Schema de eventos;
- versionamento de eventos;
- tipos compartilhados.

Se voce quiser ficar estritamente com apenas 2 repositorios Git, esse terceiro repositorio nao e obrigatorio, mas os contratos precisam ser publicados em pacote versionado. Sem isso, os dois backends vao acoplar rapido.

---

## 5. Fronteira entre as duas APIs

## `management-api` nao deve conhecer detalhes operacionais profundos

Ela pode saber:

- quantos motoristas ativos um tenant possui;
- quantos veiculos em uso;
- quais modulos foram contratados;
- quanto deve ser cobrado;
- status da implantacao;
- alertas de uso e compliance.

Ela nao deve ser dona de:

- cadastro detalhado de rotas;
- logica de execucao;
- mapa em tempo real;
- calculo de otimizacao;
- workflow do motorista.

## `app-api` nao deve ser dona do produto comercial

Ela pode saber:

- tenant ativo/inativo;
- modulos habilitados;
- limites de licenca;
- politicas liberadas.

Ela nao deve ser dona de:

- proposta comercial;
- contrato;
- funil de venda;
- faturamento mestre;
- status de implantacao macro;
- catalogo de modulos.

---

## 6. Modelo de produto modular

O produto precisa ser vendido como combinacao de:

- plano base;
- modulos;
- metrica de uso;
- canais/dispositivos.

## Modulos iniciais recomendados

- `routing-core`: cadastro, roteirizacao e execucao;
- `tracking`: rastreamento em tempo real;
- `messaging`: comunicacao interna;
- `finance`: cobranca e repasse;
- `school`: regras e telas escolares;
- `delivery`: regras e telas de entregas;
- `field-service`: regras de equipes tecnicas;
- `analytics`: BI e indicadores;
- `devices`: totens, tablets, vinculacoes e MDM leve;
- `compliance`: trilha, incidentes e auditoria.

## Tipos de licenciamento

### Licenciamento por frota/dispositivo

Para casos de:

- totem;
- tablet embarcado;
- quantidade de veiculos;
- dispositivo fixo por unidade.

Metricas base:

- `max_veiculos`;
- `max_dispositivos_embarcados`;
- `max_totens`;
- `max_operadores_concorrentes`.

### Licenciamento por usuario motorista

Para casos de:

- celular pessoal do motorista;
- operacao BYOD;
- baixa dependencia de hardware embarcado.

Metricas base:

- `max_motoristas_ativos`;
- `max_motoristas_mensais`;
- `max_logins_concorrentes`;
- `max_dispositivos_unicos_30d`.

### Licenciamento hibrido

Para clientes mistos:

- parte da frota com totem/tablet;
- parte usando celular proprio.

O sistema precisa suportar mais de um contrato/licenca por tenant.

---

## 7. Modelagem de dados recomendada

## Principios

- normalizar mestre de produto e comercial no `management`;
- normalizar operacao no `app`;
- usar snapshots apenas onde historico imutavel for necessario;
- evitar colunas genericas quando a semantica ja estiver estavel;
- usar tabelas de vinculo para relacionamentos ativos com historico;
- separar `master data`, `transactional data` e `event/audit data`.

## Schema `management`

Entidades centrais:

- `organizations`
  - Rotavans, parceiros, clientes corporate, prefeituras
- `tenants`
  - unidade logica isolada de operacao
- `tenant_profiles`
  - classificacao: prefeitura, empresa, operador logistica, escolar
- `products`
- `modules`
- `plans`
- `contracts`
- `contract_items`
- `licenses`
- `tenant_modules`
- `tenant_environments`
- `implementation_projects`
- `implementation_tasks`
- `billing_accounts`
- `invoices`
- `payments`
- `commercial_pipeline`
- `commercial_activities`
- `internal_users`
- `audit_logs`
- `tenant_usage_daily`
- `anomaly_alerts`

## Schema `app`

Entidades centrais:

- `gestores`
- `motoristas`
- `vehicles`
- `devices`
- `vehicle_device_bindings`
- `vehicle_driver_bindings`
- `operation_profiles`
- `routes`
- `stops`
- `route_stops`
- `executions`
- `execution_stops`
- `passengers`
- `shipments`
- `schools`
- `service_zones`
- `messages`
- `attachments`
- `incidents`
- `telemetry_positions`
- `operational_snapshots`

## Generalizacao de dominio operacional

O maior ajuste estrutural e parar de modelar tudo como `aluno` e `escola`.

Recomendacao:

- manter `schools` como modulo especifico;
- introduzir uma camada generica:
  - `service_subjects` ou `passengers`;
  - `service_points`;
  - `jobs` ou `demand_items`.

Exemplo:

- escolar:
  - passageiro = aluno;
  - ponto = casa/escola;
  - restricao = turno.
- entrega:
  - item = pedido;
  - ponto = coleta/entrega;
  - restricao = janela de horario.

Nao recomendo forcar uma abstração excessiva logo no inicio. O melhor caminho e:

1. manter o modulo escolar como primeiro vertical;
2. extrair um `routing-core` generico;
3. criar adaptadores por vertical.

---

## 8. Arquitetura orientada a eventos

## Tipos de eventos

### Eventos de controle

Origem: `management-api`

- `tenant.created`
- `tenant.activated`
- `tenant.deactivated`
- `tenant.module.enabled`
- `tenant.module.disabled`
- `license.created`
- `license.updated`
- `contract.activated`
- `implementation.started`
- `implementation.completed`

### Eventos operacionais

Origem: `app-api`

- `user.logged_in`
- `device.bound`
- `device.unbound`
- `route.created`
- `route.optimized`
- `execution.started`
- `execution.completed`
- `location.updated`
- `incident.created`
- `usage.measured`

### Eventos do motor de otimização

- `optimization.requested`
- `optimization.completed`
- `optimization.failed`
- `eta.recalculated`

## Regras de arquitetura

- sem chamada HTTP sincrona entre `management-api` e `app-api` para regras de negocio;
- compartilhamento apenas via:
  - banco com ownership claro por schema;
  - eventos;
  - caches materializados;
- comandos criticos com `outbox pattern`;
- eventos versionados;
- consumidores idempotentes;
- chaves de deduplicacao por `event_id`.

## Tecnologia recomendada

Curto prazo:

- Postgres + Redis Streams ou Pub/Sub + outbox em Postgres.

Medio prazo:

- Kafka ou Redpanda se o volume justificar.

Para o momento, Redis sozinho sem outbox e fraco para processos financeiros e de implantacao. O certo e usar `transactional outbox`.

---

## 9. Arquitetura do banco sem duplicidade indevida

## O que pode duplicar

- snapshots historicos de execucao;
- dados de analytics agregados;
- caches de tela;
- projeções de leitura.

## O que nao deve duplicar

- tenant mestre;
- catalogo de modulos;
- contrato ativo;
- veiculo atual;
- motorista atual;
- vinculo ativo;
- permissao ativa;
- configuracao ativa do tenant.

## Padroes recomendados

- dado mestre em uma tabela canonica;
- historico em tabela separada;
- relacao many-to-many sempre em tabela de vinculo;
- soft delete apenas onde ha valor de auditoria;
- unicidade parcial para “apenas um ativo por vez”;
- materialized views ou tabelas resumo para dashboards pesados.

---

## 10. Casos de uso prioritarios extraidos do sistema atual

## Ja refletidos no dashboard/admin atual

- cadastrar tenant;
- editar tenant;
- ativar/desativar tenant;
- gerar convite de gestor;
- visualizar estatisticas globais de tenants;
- listar contagens por tenant.

## Ja refletidos na operacao atual

- cadastrar gestores e motoristas;
- cadastrar veiculos;
- cadastrar escolas e alunos;
- montar rotas;
- iniciar e finalizar execucao;
- visualizar estatisticas do dashboard operacional;
- usar convites para entrada de usuarios;
- rastrear rota em andamento;
- mensageria basica;
- financeiro basico.

## Casos de uso novos necessarios

### Comercial e implantacao

- criar lead;
- converter lead em oportunidade;
- gerar proposta;
- fechar contrato;
- definir modulos contratados;
- definir licencas por tipo de uso;
- abrir projeto de implantacao;
- acompanhar status de onboarding;
- registrar aceite do cliente;
- liberar tenant para operacao.

### Produto modular

- habilitar modulo por tenant;
- bloquear modulo vencido;
- cobrar apenas o contratado;
- limitar uso por regra de licenca;
- trocar de plano sem recriar tenant.

### Multi-vertical

- prefeitura escolar;
- empresa de fretamento;
- operador logistico;
- distribuicao urbana;
- transporte corporativo.

### Operacao inteligente

- importar demandas;
- sugerir rota;
- otimizar rota por perfil;
- recalcular dinamicamente;
- suportar prioridades, capacidade e janelas;
- operar offline parcial no motorista;
- sincronizar quando voltar internet.

---

## 11. Requisitos funcionais recomendados

## RF - Control Plane

- RF-001: cadastrar e manter tenants.
- RF-002: classificar tenant por segmento e modelo operacional.
- RF-003: cadastrar planos, modulos e tipos de licenca.
- RF-004: associar contrato a tenant.
- RF-005: associar multiplos itens contratuais a um mesmo tenant.
- RF-006: habilitar e desabilitar modulos por tenant.
- RF-007: controlar capacidade contratada por metrica.
- RF-008: gerenciar convites de gestores.
- RF-009: registrar auditoria de alteracoes administrativas.
- RF-010: registrar uso diario consolidado por tenant.
- RF-011: emitir alertas de anomalia e extrapolacao.
- RF-012: acompanhar onboarding e implantacao.
- RF-013: registrar billing, faturas e status de pagamento.

## RF - Operational Platform

- RF-101: autenticar gestor e motorista.
- RF-102: bloquear acesso quando tenant estiver inativo.
- RF-103: bloquear acesso quando modulo nao estiver contratado.
- RF-104: cadastrar e manter frota.
- RF-105: cadastrar e manter motoristas.
- RF-106: cadastrar dispositivos e vinculacoes.
- RF-107: cadastrar demandas operacionais por vertical.
- RF-108: criar e otimizar rotas.
- RF-109: iniciar, pausar, finalizar e cancelar execucoes.
- RF-110: transmitir localizacao em tempo real.
- RF-111: registrar eventos de parada, embarque, entrega ou atendimento.
- RF-112: manter historico imutavel de execucao.
- RF-113: permitir operacao mobile em Flutter.
- RF-114: permitir operacao desktop em Electron.
- RF-115: gerar indicadores operacionais.

## RF - Routing Engine

- RF-201: receber uma lista de pontos e restricoes.
- RF-202: calcular sequencia otimizada.
- RF-203: considerar capacidade, tempo e prioridade.
- RF-204: suportar perfis por vertical.
- RF-205: recalcular rota com evento em andamento.
- RF-206: retornar rota, ETA, distancia e justificativa basica.

---

## 12. Requisitos nao funcionais

- RNF-001: isolamento multi-tenant forte em todas as consultas.
- RNF-002: APIs stateless.
- RNF-003: idempotencia em consumidores de evento.
- RNF-004: auditoria de acoes administrativas e operacionais sensiveis.
- RNF-005: suporte a escala horizontal.
- RNF-006: observabilidade com logs estruturados, metricas e tracing.
- RNF-007: tolerancia a falhas parciais entre servicos.
- RNF-008: latencia baixa para rastreamento em tempo real.
- RNF-009: versionamento de contratos HTTP e eventos.
- RNF-010: compliance LGPD por tenant.
- RNF-011: capacidade de operar com features por modulo.
- RNF-012: estrategia de backup e restore por ambiente.

---

## 13. Estrutura recomendada de apps

## Flutter

Padronizar Flutter como app principal de motorista.

Razoes:

- melhor controle de build Android;
- melhor empacotamento de APK;
- melhor caminho para operacao embarcada;
- reduz dispersao entre React Native e Flutter.

Recomendacao objetiva:

- congelar evolucao funcional do `apps/mobile` em React Native;
- migrar investimento para `apps/mobile_flutter`;
- transformar o app Flutter em produto principal do motorista/tablet.

## Electron

Ter 2 sabores de desktop:

- `desktop-admin`
  - foco em control plane, comercial, onboarding, suporte;
- `desktop-ops`
  - foco em operacao, despacho, monitoramento.

No curto prazo ambos podem compartilhar shell Electron e apontar para frontends diferentes.

## APK combinado

Faz sentido somente quando houver clareza de perfis:

- modo operador;
- modo motorista;
- modo supervisor.

Nao recomendo tentar unificar tudo agora. O risco de UX ruim e acoplamento excessivo e alto. Primeiro padronize dominios e contratos.

---

## 14. Arquitetura do core de roteirizacao

## Posicionamento correto

Seu diferencial de produto nao e apenas “CRUD de transporte”, e o `routing-core`.

Esse core deve ser tratado como plataforma:

- entrada padronizada;
- adaptadores por vertical;
- saida padronizada;
- explainability minima;
- possibilidade de trocar provedor de mapa.

## Camadas recomendadas

### Camada 1: Ingestao

Recebe:

- pontos;
- janelas de tempo;
- capacidades;
- prioridade;
- tipo de operacao;
- restricoes especificas.

### Camada 2: Normalizacao

Transforma cada vertical para um formato canonico:

- `stops`
- `vehicles`
- `drivers`
- `constraints`
- `service_profile`

### Camada 3: Optimization Engine

Implementa:

- heuristicas;
- reordenação;
- clustering;
- balanceamento de carga;
- recalculo incremental.

### Camada 4: Navigation Output

Entrega:

- sequencia otimizada;
- geometria;
- ETA;
- distancia;
- instrucoes para execucao.

## Dependencias externas

Voce pode usar provedores como:

- Mapbox;
- Google Directions;
- OSRM;
- Valhalla;
- GraphHopper.

Para longo prazo, a melhor independencia vem de:

- interface interna `RoutingProvider`;
- implementacoes plugaveis por provedor.

---

## 15. Roadmap recomendado

## Fase 0 - Decisao e saneamento

- congelar o monolito atual para features grandes;
- definir Flutter como app mobile principal;
- definir os dois repositorios Git;
- definir ownership dos dominios;
- fechar nomenclatura oficial das entidades.

## Fase 1 - Foundation

- criar `management-api`;
- criar `app-api`;
- separar schemas `management` e `app`;
- criar barramento de eventos com outbox;
- publicar contratos compartilhados;
- subir observabilidade basica.

## Fase 2 - Control Plane MVP

- tenants;
- modulos;
- licencas;
- contratos;
- convites de gestores;
- dashboard de uso;
- alertas de extrapolacao;
- onboarding/implantacao basico.

## Fase 3 - Operational Rewrite MVP

- auth de gestor e motorista;
- frota;
- motoristas;
- dispositivos;
- rotas;
- execucao;
- rastreamento;
- historico;
- guardas por tenant/modulo/licenca.

## Fase 4 - Routing Core V1

- input canonico;
- otimizacao inicial para escolar;
- reuso para entrega simples;
- telemetria e recalculo leve;
- comparar resultados com operação atual.

## Fase 5 - Produto comercializavel

- billing por consumo;
- plano por modulo;
- contratos hibridos;
- onboarding padronizado;
- relatorios executivos;
- empacotamento desktop/mobile consolidado.

---

## 16. Backlog tecnico prioritario

### Prioridade alta

- separar dominio `management` de `app`;
- remodelar licenciamento para suportar veiculos, dispositivos e motoristas;
- introduzir `contracts` e `contract_items`;
- introduzir `implementation_projects`;
- definir `operation_profile` por tenant;
- revisar modelagem escolar para extrair `routing-core`;
- adotar outbox pattern.

### Prioridade media

- materialized views para dashboards;
- telemetria mais rica;
- device registry;
- billing automatizado;
- feature flags por modulo.

### Prioridade baixa

- unificacao de apps em APK combinado;
- motor de otimização como servico isolado;
- suporte multi-regiao de infraestrutura.

---

## 17. Riscos e decisoes importantes

### Risco 1: abstrair demais cedo

Se tentar transformar escolar, entrega e fretamento em um unico modelo totalmente generico agora, voce pode travar a evolucao.

Decisao:

- core generico apenas para roteirizacao;
- dominio operacional ainda com verticais explicitas.

### Risco 2: dois backends com banco compartilhado sem ownership claro

Isso vira monolito distribuido.

Decisao:

- ownership por schema e por tabela;
- leitura cruzada apenas quando inevitavel;
- sem escrita cruzada fora de contratos definidos.

### Risco 3: licenciamento mal modelado

Se a licenca ficar presa a `max_veiculos` e `max_motoristas`, o produto nao fecha comercialmente.

Decisao:

- contrato com multiplos itens;
- medicao por metrica;
- enforcement por politica.

### Risco 4: manter dois apps mobile em paralelo

Isso dispersa esforço.

Decisao:

- Flutter como caminho principal.

---

## 18. Recomendacao final

A direcao de duas APIs ja documentada no projeto esta correta, mas ainda falta completar a parte mais importante: transformar isso em plataforma de produto, nao apenas em reescrita tecnica do sistema atual.

O desenho recomendado e:

1. `management-api` como control plane comercial, contratual, modular e de implantacao.
2. `app-api` como plataforma operacional multi-tenant.
3. `routing-core` como nucleo estrategico, inicialmente dentro do `app-api`, preparado para virar servico proprio.
4. Flutter como app principal do motorista.
5. Electron separado por contexto administrativo e operacional.

Se for seguir esse caminho, o proximo documento a produzir deve ser um `domain model` detalhado com:

- entidades;
- relacionamentos;
- ownership por API;
- eventos publicados;
- requisitos funcionais por modulo.

Esse deve ser o artefato-base antes de qualquer reescrita grande.
