# Rotavans - Domain Model Specification
**Date:** 2026-03-12  
**Status:** Proposed  
**Scope:** Plataforma modular multi-tenant para prefeituras e empresas

---

## 1. Purpose

This document defines the domain model for the next architecture phase of Rotavans.

It exists to answer, with precision:

- which domains exist;
- which entities belong to each domain;
- which service owns each entity;
- which data may be read cross-domain;
- which events are published;
- which business rules are enforced in each context.

This is a specification document. It is not the final SQL migration set and not the final API contract, but it is the base artifact that should drive both.

---

## 2. Product Vision

Rotavans is a modular operational platform centered on route planning, route optimization, execution, and monitoring.

It must support:

- municipalities;
- private companies;
- mixed operational models;
- pricing by enabled modules and actual usage;
- different device strategies:
  - fixed tablet/totem;
  - driver-owned mobile phone;
  - hybrid.

The platform is organized around:

- a Control Plane;
- an Operational Platform;
- a Routing Core.

---

## 3. Bounded Contexts

## 3.1 Control Plane

Primary concern:

- sell, configure, activate, bill, and govern the product for each client.

Owned by:

- `management-api`

Main responsibilities:

- tenant lifecycle;
- commercial lifecycle;
- modules and plans;
- contracts and licenses;
- implementation projects;
- platform audit and usage metering;
- internal Rotavans users.

## 3.2 Operational Platform

Primary concern:

- execute the client operation daily.

Owned by:

- `app-api`

Main responsibilities:

- gestor and motorista access;
- fleet and devices;
- operational records;
- route lifecycle;
- execution lifecycle;
- messages and incidents;
- operational dashboards.

## 3.3 Routing Core

Primary concern:

- transform operational demand into optimized route plans.

Initial runtime placement:

- internal module inside `app-api`

Future placement:

- dedicated service if load and complexity justify separation

Main responsibilities:

- normalize routing input;
- calculate optimized sequencing;
- recompute ETA and route adjustments;
- support vertical-specific constraints.

---

## 4. Service Ownership Rules

## 4.1 Management API owns

- product catalog;
- modules;
- plans;
- tenants;
- contracts;
- licenses;
- implementation records;
- billing records;
- platform-level usage summaries;
- administrative audit trail.

## 4.2 App API owns

- gestores;
- motoristas;
- vehicles;
- devices;
- operational demand entities;
- routes and stops;
- executions;
- location stream state;
- operational incidents;
- operational messages;
- immutable execution history.

## 4.3 Shared rule

No service may write into another service's owned tables except through an explicit contract approved in architecture.

Cross-service communication should prefer:

- events;
- read models;
- cache projections;
- controlled shared tables only when unavoidable.

---

## 5. Core Domain Concepts

## 5.1 Organization

Represents a legal or commercial party.

Examples:

- municipality;
- private company;
- operator;
- Rotavans partner.

This is broader than a tenant. One organization may have one or more tenants.

## 5.2 Tenant

Represents an isolated operational environment.

A tenant is the platform isolation unit for:

- users;
- modules;
- licenses;
- operational data;
- configuration;
- metrics.

## 5.3 Operation Profile

Defines how a tenant operates.

Examples:

- school transport;
- urban delivery;
- corporate shuttle;
- field service.

This is critical because optimization and UI behavior may vary by profile.

## 5.4 Module

Represents a sellable functional capability.

Examples:

- routing;
- tracking;
- messaging;
- finance;
- analytics;
- devices;
- school;
- delivery.

## 5.5 License

Represents allowed usage limits and enforcement rules.

A tenant may have:

- one active license;
- or multiple active license items under the same contract.

## 5.6 Contract

Represents the commercial agreement between Rotavans and a client.

It defines:

- active commercial relationship;
- plan composition;
- enabled modules;
- pricing logic;
- billing cadence;
- usage entitlements.

## 5.7 Routing Demand

Represents the set of operational inputs that will be optimized.

It may come from:

- student transport;
- delivery orders;
- service appointments;
- pickup/dropoff lists.

## 5.8 Execution

Represents the real-world running instance of a route.

It has:

- planned state;
- active state;
- completed state;
- canceled state.

---

## 6. Entity Model by Context

## 6.1 Control Plane Entities

### `organizations`

Purpose:

- legal/commercial master record.

Key attributes:

- `id`
- `legal_name`
- `display_name`
- `document_number`
- `organization_type`
- `email`
- `phone`
- `status`
- `created_at`

Rules:

- unique by document number when present;
- may own multiple tenants.

### `tenants`

Purpose:

- isolated platform workspace.

Key attributes:

- `id`
- `organization_id`
- `name`
- `slug`
- `segment`
- `status`
- `city`
- `state`
- `country`
- `go_live_at`
- `created_at`
- `updated_at`

Rules:

- `slug` unique;
- tenant status controls operational access;
- tenant can be active even if implementation is not fully complete only when explicitly approved.

### `tenant_profiles`

Purpose:

- classify the tenant operational model.

Key attributes:

- `tenant_id`
- `operation_profile`
- `primary_use_case`
- `device_strategy`
- `has_dispatch_center`
- `requires_offline_mode`

Rules:

- one active profile per tenant version;
- changes may affect route optimization rules.

### `products`

Purpose:

- top-level commercial product catalog.

Examples:

- Rotavans Platform;
- Rotavans Routing Core;
- Rotavans Monitoring Suite.

### `modules`

Purpose:

- functional sellable modules.

Key attributes:

- `id`
- `slug`
- `name`
- `description`
- `status`
- `category`

Rules:

- unique `slug`;
- module may have dependencies.

### `module_dependencies`

Purpose:

- express required module relationships.

Example:

- `tracking` depends on `routing-core` or `devices`.

### `plans`

Purpose:

- commercial bundles of modules and entitlements.

### `plan_modules`

Purpose:

- define which modules are included in each plan.

### `contracts`

Purpose:

- client commercial agreement.

Key attributes:

- `id`
- `tenant_id`
- `contract_number`
- `start_date`
- `end_date`
- `status`
- `currency`
- `billing_cycle`
- `signed_at`

Rules:

- a tenant can have multiple contracts historically;
- only one primary active contract at a time unless hybrid structure is explicitly supported.

### `contract_items`

Purpose:

- explicit priced items within a contract.

Examples:

- 30 vehicles;
- 100 drivers;
- routing module;
- tracking module;
- analytics module.

Key attributes:

- `contract_id`
- `item_type`
- `reference_type`
- `reference_id`
- `quantity`
- `unit_price`
- `billing_metric`
- `status`

This table is the base for flexible pricing.

### `licenses`

Purpose:

- technical enforcement rules derived from contract items.

Key attributes:

- `tenant_id`
- `license_type`
- `max_vehicles`
- `max_drivers`
- `max_devices`
- `max_totems`
- `max_concurrent_sessions`
- `valid_from`
- `valid_to`
- `status`

Rules:

- derived from contract items, but persisted as operationally enforceable state;
- only active licenses are pushed to app runtime.

### `tenant_modules`

Purpose:

- actual module activation state for a tenant.

Key attributes:

- `tenant_id`
- `module_id`
- `enabled`
- `enabled_at`
- `disabled_at`
- `source`

`source` examples:

- plan;
- manual override;
- trial;
- contract add-on.

### `implementation_projects`

Purpose:

- track onboarding and deployment work for each client.

Key attributes:

- `tenant_id`
- `status`
- `kickoff_at`
- `planned_go_live_at`
- `actual_go_live_at`
- `owner_internal_user_id`

### `implementation_tasks`

Purpose:

- detailed implementation checklist and operational readiness.

Examples:

- import initial data;
- configure modules;
- train gestores;
- validate devices;
- publish app build.

### `billing_accounts`

Purpose:

- financial identity for invoicing.

### `invoices`

Purpose:

- billable documents issued to the client.

### `payments`

Purpose:

- payment status and reconciliation.

### `commercial_leads`

Purpose:

- pre-contract pipeline management.

### `commercial_opportunities`

Purpose:

- track sales funnel from lead to closed deal.

### `internal_users`

Purpose:

- Rotavans staff and platform operators.

Examples:

- sales;
- onboarding;
- support;
- superadmin.

### `audit_logs`

Purpose:

- immutable administrative audit trail.

Examples:

- login;
- module enabled;
- contract changed;
- tenant deactivated.

### `tenant_usage_daily`

Purpose:

- daily aggregated usage.

Examples:

- active devices;
- active vehicles;
- active drivers;
- route optimizations;
- executions completed.

### `anomaly_alerts`

Purpose:

- open or resolved alerts for license or usage anomalies.

Examples:

- over license limit;
- suspicious login spikes;
- abrupt operational burst.

---

## 6.2 Operational Platform Entities

### `gestores`

Purpose:

- operational managers inside the tenant.

Key attributes:

- `id`
- `tenant_id`
- `firebase_uid`
- `name`
- `email`
- `status`
- `created_at`

### `motoristas`

Purpose:

- field users responsible for execution.

Key attributes:

- `id`
- `tenant_id`
- `firebase_uid`
- `name`
- `phone`
- `pin_hash`
- `status`
- `invitation_token`
- `onboarding_completed`

### `vehicles`

Purpose:

- fleet assets used in operation.

Key attributes:

- `id`
- `tenant_id`
- `plate`
- `type`
- `model`
- `manufacturer`
- `year`
- `capacity`
- `status`

Rules:

- unique plate per tenant;
- capacity is critical for routing.

### `devices`

Purpose:

- tablets, totems, or mobile devices recognized by the platform.

Key attributes:

- `id`
- `tenant_id`
- `device_uid`
- `device_type`
- `os_type`
- `app_flavor`
- `status`
- `last_seen_at`

This is broader and cleaner than using only header-based IDs without a canonical device table.

### `vehicle_device_bindings`

Purpose:

- history of active device binding to a vehicle.

Rules:

- at most one active binding per device;
- at most one active primary device per vehicle by binding type.

### `vehicle_driver_bindings`

Purpose:

- define which drivers are authorized or currently assigned to which vehicles.

### `operation_profiles`

Purpose:

- operational runtime profile for a tenant inside app context.

This mirrors management classification but is stored as app-consumable configuration.

Examples:

- route stop behavior;
- terminology;
- required fields;
- optimization profile.

### `service_points`

Purpose:

- normalized physical points used in routing.

Examples:

- home;
- school;
- pickup point;
- delivery point;
- depot;
- service site.

### `passengers`

Purpose:

- normalized transported individuals.

School-specific records such as students can be modeled as:

- `passengers` + `school_passenger_profiles`

### `shipments`

Purpose:

- delivery-oriented demand records.

### `schools`

Purpose:

- school-specific vertical entity.

This remains explicit because school transport is a strong vertical already present in the product.

### `routes`

Purpose:

- planned operational route definition.

Key attributes:

- `id`
- `tenant_id`
- `name`
- `route_type`
- `assigned_vehicle_id`
- `assigned_driver_id`
- `optimization_profile`
- `status`
- `geometry`

### `route_stops`

Purpose:

- ordered stop composition of a route.

Key attributes:

- `route_id`
- `service_point_id`
- `subject_type`
- `subject_id`
- `stop_order`
- `planned_arrival_at`
- `service_window_start`
- `service_window_end`

This is preferable to tying every stop directly to `aluno`.

### `executions`

Purpose:

- actual route run instance.

Key attributes:

- `id`
- `tenant_id`
- `route_id`
- `driver_id`
- `vehicle_id`
- `started_at`
- `completed_at`
- `status`

### `execution_stops`

Purpose:

- actual stop outcomes within one execution.

Examples:

- boarded;
- skipped;
- delivered;
- absent;
- failed service.

### `telemetry_positions`

Purpose:

- optional persisted GPS telemetry timeline.

Persistence strategy:

- hot state in Redis;
- selective durable persistence in database.

### `messages`

Purpose:

- tenant-scoped communication between users.

### `attachments`

Purpose:

- files linked to messages, incidents, drivers, or vehicles.

### `incidents`

Purpose:

- operational occurrence register.

Examples:

- route deviation;
- driver issue;
- passenger no-show;
- device failure.

### `operational_snapshots`

Purpose:

- immutable denormalized execution summary.

Used for:

- history;
- audit;
- export;
- stable reporting even after source record changes.

---

## 6.3 Routing Core Entities

These may initially be logical models rather than physical tables.

### `optimization_requests`

Purpose:

- canonical input for route optimization.

Key attributes:

- `tenant_id`
- `operation_profile`
- `demand_type`
- `vehicles`
- `drivers`
- `stops`
- `constraints`
- `requested_by`

### `optimization_results`

Purpose:

- output of a routing calculation.

Key attributes:

- `request_id`
- `status`
- `routes_generated`
- `distance_total`
- `duration_total`
- `quality_score`
- `provider`
- `completed_at`

### `routing_providers`

Logical concept for provider abstraction.

Examples:

- Mapbox;
- Google;
- OSRM;
- internal heuristic engine.

---

## 7. Relationships

## Control Plane

- one `organization` to many `tenants`
- one `tenant` to many `contracts`
- one `contract` to many `contract_items`
- one `tenant` to many `licenses`
- one `tenant` to many `tenant_modules`
- one `tenant` to one active `tenant_profile`
- one `tenant` to many `implementation_tasks`
- one `tenant` to many `tenant_usage_daily`
- one `tenant` to many `anomaly_alerts`

## Operational Platform

- one `tenant` to many `gestores`
- one `tenant` to many `motoristas`
- one `tenant` to many `vehicles`
- one `tenant` to many `devices`
- one `tenant` to many `routes`
- one `route` to many `route_stops`
- one `execution` belongs to one `route`
- one `execution` to many `execution_stops`
- one `vehicle` to many `vehicle_device_bindings`
- one `vehicle` to many `vehicle_driver_bindings`
- one `tenant` to many `messages`
- one `tenant` to many `incidents`

---

## 8. Aggregates

Recommended aggregate roots:

- `Tenant`
- `Contract`
- `License`
- `ImplementationProject`
- `Vehicle`
- `Motorista`
- `Route`
- `Execution`
- `Device`

Reason:

These represent transaction boundaries where invariants matter.

Examples:

- a `Route` aggregate controls stop ordering and optimization state;
- an `Execution` aggregate controls status transitions;
- a `License` aggregate controls runtime entitlement state.

---

## 9. Business Invariants

## Tenant invariants

- a tenant must have exactly one active operational status;
- inactive tenant cannot authenticate into app runtime;
- tenant module access depends on active contract/license state.

## Contract and license invariants

- active operational entitlements must come from active contract items;
- license limits must not be edited directly without audit trail;
- runtime enforcement uses effective active license projection.

## Driver invariants

- one `firebase_uid` belongs to only one active driver identity in app context;
- PIN login is allowed only after onboarding completion;
- driver cannot execute route for inactive tenant.

## Vehicle and device invariants

- no duplicate active binding for same device;
- no duplicate active binding for same exclusive vehicle slot;
- vehicle usage metrics must count unique active vehicles, not raw events.

## Route invariants

- route stop order must be unique within one route;
- route optimization result must be linked to the input version used;
- editing a route after optimization invalidates prior optimization state unless explicitly preserved.

## Execution invariants

- only one active execution per driver unless concurrency is explicitly supported;
- execution completion writes immutable history snapshot;
- historical snapshot is never updated except for compliance correction flow.

---

## 10. Cross-Context Read Rules

## Management API may read

- aggregated app usage data;
- tenant operational counts;
- execution totals;
- active devices count;
- active drivers count;
- optimization consumption.

## App API may read

- tenant status;
- enabled modules;
- effective active licenses;
- tenant operation profile;
- rollout configuration.

## Not allowed as primary pattern

- management querying raw route details for normal workflows;
- app querying proposal, CRM, or invoice details for operational workflows.

---

## 11. Event Model

## 11.1 Control Plane Published Events

- `tenant.created`
- `tenant.updated`
- `tenant.activated`
- `tenant.deactivated`
- `tenant.profile.changed`
- `tenant.module.enabled`
- `tenant.module.disabled`
- `contract.activated`
- `contract.suspended`
- `license.updated`
- `implementation.started`
- `implementation.completed`

## 11.2 Operational Platform Published Events

- `user.logged_in`
- `device.registered`
- `device.bound`
- `device.unbound`
- `route.created`
- `route.updated`
- `route.optimization.requested`
- `route.optimized`
- `execution.started`
- `execution.completed`
- `execution.canceled`
- `location.updated`
- `incident.created`
- `usage.daily_measured`

## 11.3 Routing Core Published Events

- `optimization.requested`
- `optimization.completed`
- `optimization.failed`
- `eta.recomputed`

## Event requirements

- every event must have `event_id`;
- every event must have `event_version`;
- every event must have `occurred_at`;
- every event must carry `tenant_id` when tenant-scoped;
- consumers must be idempotent.

---

## 12. Read Models and Projections

These are valid denormalized models:

- tenant summary for admin dashboard;
- billing summary by tenant;
- daily license usage summary;
- active operations dashboard;
- route execution history projection;
- driver current status projection;
- device health projection.

They are projections, not source of truth.

---

## 13. Licensing Model

## 13.1 License Types

- `fleet_based`
- `driver_based`
- `hybrid`

## 13.2 Billing Metrics

- `vehicle_count`
- `active_vehicle_count`
- `driver_count`
- `monthly_active_driver_count`
- `device_count`
- `totem_count`
- `optimization_request_count`
- `execution_count`

## 13.3 Enforcement Policies

- `hard_block`
- `soft_alert`
- `grace_limit`
- `manual_review`

Recommended default:

- monitoring-first for new tenants;
- soft enforcement during onboarding;
- configurable hard enforcement after operational maturity.

---

## 14. Vertical Strategy

## 14.1 School Transport

Specialized entities:

- `schools`
- school-specific passenger attributes;
- school shift constraints.

## 14.2 Delivery

Specialized entities:

- `shipments`
- pickup/dropoff windows;
- proof-of-delivery fields.

## 14.3 Corporate Shuttle / Charter

Specialized entities:

- employee passengers;
- fixed schedules;
- recurring route templates.

## Strategy

Keep the optimization core generic.

Keep vertical-specific entities explicit when they carry real business meaning.

Do not force a single generic table for all business semantics too early.

---

## 15. Mobile and Desktop Implications

## Flutter mobile

Primary target:

- motorista;
- vehicle/tablet operation;
- offline-capable field execution.

Domain implications:

- stable device identity;
- PIN-based fast re-entry;
- sync-safe execution events;
- local cache for active route.

## Electron desktop

Primary targets:

- control plane operator;
- dispatcher;
- operational supervisor.

Domain implications:

- richer monitoring dashboards;
- bulk configuration;
- real-time supervisory actions.

---

## 16. Suggested Table Naming Conventions

Use:

- English table names for new architecture;
- snake_case columns;
- explicit timestamps:
  - `created_at`
  - `updated_at`
  - `deleted_at` when needed

Avoid mixing:

- Portuguese and English names in the same new service;
- entity names tied only to the current school domain when the entity is meant to be reusable.

Legacy names may remain only during migration.

---

## 17. Migration Guidance from Current State

Current reusable concepts already present:

- tenant;
- gestor;
- motorista;
- vehicle;
- route;
- route stop;
- execution history;
- admin dashboard;
- invites.

Main model evolutions required:

- `tenants` must move under management ownership;
- `convites_gestor` should evolve into generalized invite model;
- `alunos` should stop being the only stop-linked subject type;
- `rota_historico` should evolve into execution + immutable snapshot pattern;
- device identity should become first-class entity;
- licensing must evolve from simple counters into contract-backed entitlements.

---

## 18. Open Decisions

These still require explicit product decision:

- whether one organization can operate multiple independent tenants from the start;
- whether billing will be invoice-only or integrated with payment provider;
- whether optimization provider abstraction is required in V1 or V2;
- whether telemetry raw history will be stored long-term or only summarized;
- whether combined APK is a product requirement or a future convenience feature;
- whether hybrid contracts may have concurrent fleet-based and driver-based items active together.

---

## 19. Final Recommendation

Implementation should not start from tables first.

The correct order is:

1. approve this domain model;
2. derive event catalog and API ownership matrix;
3. derive relational schema for `management` and `app`;
4. derive module-level functional specs;
5. only then write migrations and service code.

This domain model should be treated as the governing specification for the rewrite.
