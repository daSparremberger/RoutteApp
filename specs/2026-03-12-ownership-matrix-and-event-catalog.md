# Rotavans - Ownership Matrix and Event Catalog
**Date:** 2026-03-12  
**Status:** Proposed  
**Depends on:** `2026-03-12-domain-model-spec.md`

---

## 1. Purpose

This document translates the domain model into implementation ownership rules.

It exists to answer:

- which service owns each entity;
- which service may read each entity;
- which service may never write each entity;
- which events each aggregate publishes;
- which events each service consumes;
- which projections must exist for runtime decisions.

This is the document that should guide:

- relational schema ownership;
- API boundaries;
- event contracts;
- outbox/inbox implementation.

---

## 2. Service Roles

## `management-api`

Owns:

- commercial, contractual, configuration, onboarding, and governance concerns.

Never owns:

- route execution lifecycle;
- operational telemetry details;
- raw real-time location;
- route stop processing.

## `app-api`

Owns:

- operational execution and tenant runtime behavior.

Never owns:

- CRM;
- contract authoring;
- module catalog definition;
- billing master records.

## `routing-core`

Owns logically:

- optimization request/result lifecycle.

In V1:

- implemented inside `app-api`

In V2+:

- may become standalone service.

---

## 3. Ownership Matrix

## 3.1 Control Plane Tables

| Entity | Owner Write | Read Access | Forbidden Writers | Notes |
|---|---|---|---|---|
| `organizations` | `management-api` | `management-api` | `app-api` | Legal/commercial master |
| `tenants` | `management-api` | `management-api`, `app-api` | `app-api` | App may read status and identity only |
| `tenant_profiles` | `management-api` | `management-api`, `app-api` | `app-api` | App consumes effective runtime profile |
| `products` | `management-api` | `management-api` | `app-api` | Catalog only |
| `modules` | `management-api` | `management-api`, `app-api` | `app-api` | Module catalog definition |
| `module_dependencies` | `management-api` | `management-api` | `app-api` | Build-time and validation concern |
| `plans` | `management-api` | `management-api` | `app-api` | Commercial bundles |
| `plan_modules` | `management-api` | `management-api` | `app-api` | Commercial definition |
| `contracts` | `management-api` | `management-api` | `app-api` | Commercial agreement |
| `contract_items` | `management-api` | `management-api` | `app-api` | Pricing and entitlements source |
| `licenses` | `management-api` | `management-api`, `app-api` | `app-api` | App reads effective license only |
| `tenant_modules` | `management-api` | `management-api`, `app-api` | `app-api` | Runtime module enablement source |
| `implementation_projects` | `management-api` | `management-api` | `app-api` | Onboarding and rollout |
| `implementation_tasks` | `management-api` | `management-api` | `app-api` | Internal execution support |
| `billing_accounts` | `management-api` | `management-api` | `app-api` | Financial scope |
| `invoices` | `management-api` | `management-api` | `app-api` | Financial scope |
| `payments` | `management-api` | `management-api` | `app-api` | Financial scope |
| `commercial_leads` | `management-api` | `management-api` | `app-api` | Sales pipeline |
| `commercial_opportunities` | `management-api` | `management-api` | `app-api` | Sales pipeline |
| `internal_users` | `management-api` | `management-api` | `app-api` | Rotavans staff |
| `audit_logs` | `management-api` | `management-api` | `app-api` direct write forbidden | App contributes through events |
| `tenant_usage_daily` | `management-api` | `management-api`, `app-api` read optional | `app-api` direct write forbidden | Built from event consumers/projections |
| `anomaly_alerts` | `management-api` | `management-api` | `app-api` | Derived governance concern |

## 3.2 Operational Tables

| Entity | Owner Write | Read Access | Forbidden Writers | Notes |
|---|---|---|---|---|
| `gestores` | `app-api` | `app-api`, `management-api` aggregated only | `management-api` | Mgmt may query counts/read models |
| `motoristas` | `app-api` | `app-api`, `management-api` aggregated only | `management-api` | Mgmt reads metrics, not raw lifecycle |
| `vehicles` | `app-api` | `app-api`, `management-api` aggregated only | `management-api` | License monitoring depends on counts |
| `devices` | `app-api` | `app-api`, `management-api` aggregated only | `management-api` | Device registry is operational |
| `vehicle_device_bindings` | `app-api` | `app-api`, `management-api` via projections | `management-api` | Historical relation |
| `vehicle_driver_bindings` | `app-api` | `app-api` | `management-api` | Operational assignment |
| `operation_profiles` | `app-api` effective copy | `app-api` | `management-api` direct write to app copy forbidden | Derived from tenant profile |
| `service_points` | `app-api` | `app-api` | `management-api` | Routing input |
| `passengers` | `app-api` | `app-api` | `management-api` | Generic transport subjects |
| `shipments` | `app-api` | `app-api` | `management-api` | Delivery vertical |
| `schools` | `app-api` | `app-api` | `management-api` | School vertical |
| `routes` | `app-api` | `app-api`, `management-api` aggregated only | `management-api` | Core operational asset |
| `route_stops` | `app-api` | `app-api` | `management-api` | Ordered route composition |
| `executions` | `app-api` | `app-api`, `management-api` aggregated only | `management-api` | Runtime execution |
| `execution_stops` | `app-api` | `app-api` | `management-api` | Runtime results |
| `telemetry_positions` | `app-api` | `app-api` | `management-api` | High-volume operational data |
| `messages` | `app-api` | `app-api` | `management-api` | Tenant-scoped communication |
| `attachments` | `app-api` | `app-api` | `management-api` | Operational support |
| `incidents` | `app-api` | `app-api`, `management-api` aggregated only | `management-api` | Operational occurrence |
| `operational_snapshots` | `app-api` | `app-api`, `management-api` summary/export only | `management-api` | Immutable history |

## 3.3 Routing Core Logical Entities

| Entity | Owner Write | Read Access | Forbidden Writers | Notes |
|---|---|---|---|---|
| `optimization_requests` | `app-api` / `routing-core` | `app-api`, `routing-core`, `management-api` aggregated only | `management-api` | Created from operational flows |
| `optimization_results` | `routing-core` | `app-api`, `management-api` aggregated only | `management-api` | Basis for route versions |
| `routing_provider_logs` | `routing-core` | `routing-core`, `app-api` | `management-api` | Optional diagnostic store |

---

## 4. Cross-Service Read Policy

## Allowed direct reads

### App API may directly read from management-owned data

- `tenants`
- `tenant_profiles`
- `licenses`
- `tenant_modules`

Only for:

- auth and access control;
- runtime gating;
- effective profile hydration.

### Management API may directly read from app-owned data

Direct raw reads should be minimized.

Allowed cases:

- admin support tools;
- anomaly queries;
- repair scripts;
- migration tools.

Normal product behavior should prefer:

- projections;
- daily summaries;
- event-derived metrics.

## Forbidden as standard pattern

- synchronous business dependency where one request in `management-api` waits for `app-api` table processing;
- dashboards built by large cross-schema raw joins on hot operational tables;
- direct writes across ownership boundaries.

---

## 5. Runtime Projections Required

## App runtime projections

These should be cached locally in Redis or persisted as app-readable projection tables:

- `effective_tenant_status`
- `effective_tenant_modules`
- `effective_tenant_license`
- `effective_operation_profile`

## Management runtime projections

These should be event-fed or batch-updated:

- `tenant_usage_daily`
- `tenant_usage_hourly`
- `active_device_summary`
- `active_vehicle_summary`
- `execution_summary_daily`
- `optimization_usage_summary`

---

## 6. Event Catalog

## 6.1 Event Envelope

Every event should use a common envelope:

```json
{
  "event_id": "uuid",
  "event_type": "tenant.created",
  "event_version": 1,
  "occurred_at": "2026-03-12T12:00:00Z",
  "producer": "management-api",
  "tenant_id": 123,
  "correlation_id": "uuid",
  "causation_id": "uuid",
  "payload": {}
}
```

Required rules:

- `event_id` unique globally;
- `event_version` mandatory;
- `tenant_id` required when tenant-scoped;
- `correlation_id` propagated through workflows;
- `payload` immutable after publish.

---

## 6.2 Control Plane Published Events

### `tenant.created`

Producer:

- `management-api`

Triggered when:

- a new tenant is provisioned

Payload:

- `tenant_id`
- `organization_id`
- `tenant_slug`
- `segment`
- `status`

Consumers:

- `app-api`

Actions:

- initialize runtime tenant projection;
- mark tenant as known but not necessarily operationally ready.

### `tenant.updated`

Payload:

- `tenant_id`
- `changed_fields`
- `status`
- `segment`

Consumers:

- `app-api`

Actions:

- refresh runtime tenant metadata cache.

### `tenant.activated`

Payload:

- `tenant_id`
- `activated_at`

Consumers:

- `app-api`

Actions:

- allow authentication and socket participation.

### `tenant.deactivated`

Payload:

- `tenant_id`
- `reason`
- `deactivated_at`

Consumers:

- `app-api`

Actions:

- deny new logins;
- disconnect active realtime sessions;
- mark runtime as blocked.

### `tenant.profile.changed`

Payload:

- `tenant_id`
- `operation_profile`
- `device_strategy`
- `requires_offline_mode`

Consumers:

- `app-api`
- `routing-core`

Actions:

- update effective runtime behavior;
- update optimization strategy selection.

### `tenant.module.enabled`

Payload:

- `tenant_id`
- `module_slug`
- `source`

Consumers:

- `app-api`

Actions:

- enable runtime access.

### `tenant.module.disabled`

Payload:

- `tenant_id`
- `module_slug`
- `source`
- `disabled_reason`

Consumers:

- `app-api`

Actions:

- block runtime access;
- optionally terminate feature-specific sessions.

### `contract.activated`

Payload:

- `tenant_id`
- `contract_id`
- `activated_at`

Consumers:

- `app-api`

Actions:

- informational or projection update only.

### `contract.suspended`

Payload:

- `tenant_id`
- `contract_id`
- `suspended_at`
- `reason`

Consumers:

- `app-api`

Actions:

- potentially trigger runtime restrictions depending on policy.

### `license.updated`

Payload:

- `tenant_id`
- `effective_license`

`effective_license` fields:

- `license_type`
- `max_vehicles`
- `max_drivers`
- `max_devices`
- `max_totems`
- `max_concurrent_sessions`
- `enforcement_policy`

Consumers:

- `app-api`

Actions:

- refresh runtime enforcement cache.

### `implementation.started`

Payload:

- `tenant_id`
- `implementation_project_id`
- `started_at`

Consumers:

- optional only

### `implementation.completed`

Payload:

- `tenant_id`
- `implementation_project_id`
- `completed_at`
- `go_live_ready`

Consumers:

- `app-api`

Actions:

- enable onboarding-complete runtime behaviors if needed.

---

## 6.3 Operational Platform Published Events

### `user.logged_in`

Producer:

- `app-api`

Payload:

- `tenant_id`
- `user_id`
- `user_type`
- `firebase_uid`
- `device_id`
- `ip`
- `user_agent`
- `login_method`

Consumers:

- `management-api`

Actions:

- append audit log;
- update usage counters.

### `device.registered`

Payload:

- `tenant_id`
- `device_id`
- `device_type`
- `os_type`
- `app_flavor`

Consumers:

- `management-api`

Actions:

- update device usage counters and anomaly inputs.

### `device.bound`

Payload:

- `tenant_id`
- `device_id`
- `vehicle_id`
- `driver_id`
- `bound_at`

Consumers:

- `management-api`

Actions:

- update active device/vehicle projections.

### `device.unbound`

Payload:

- `tenant_id`
- `device_id`
- `vehicle_id`
- `driver_id`
- `unbound_at`

Consumers:

- `management-api`

Actions:

- update active device/vehicle projections.

### `route.created`

Payload:

- `tenant_id`
- `route_id`
- `route_type`
- `operation_profile`

Consumers:

- `management-api` optional summary only

### `route.updated`

Payload:

- `tenant_id`
- `route_id`
- `change_type`

### `route.optimization.requested`

Payload:

- `tenant_id`
- `route_id`
- `request_id`
- `operation_profile`
- `stop_count`

Consumers:

- `management-api`
- `routing-core` when externalized

Actions:

- usage tracking;
- async optimization handling.

### `route.optimized`

Payload:

- `tenant_id`
- `route_id`
- `request_id`
- `result_id`
- `provider`
- `distance_total`
- `duration_total`
- `quality_score`

Consumers:

- `management-api`

Actions:

- increment optimization usage metrics.

### `execution.started`

Payload:

- `tenant_id`
- `execution_id`
- `route_id`
- `driver_id`
- `vehicle_id`
- `started_at`

Consumers:

- `management-api`

Actions:

- increment daily operational counters.

### `execution.completed`

Payload:

- `tenant_id`
- `execution_id`
- `route_id`
- `driver_id`
- `vehicle_id`
- `completed_at`
- `stats`

`stats` examples:

- `completed_stops`
- `skipped_stops`
- `distance_total`
- `duration_total`

Consumers:

- `management-api`

Actions:

- increment summaries;
- feed BI and usage views.

### `execution.canceled`

Payload:

- `tenant_id`
- `execution_id`
- `reason`
- `canceled_at`

Consumers:

- `management-api`

Actions:

- anomaly or KPI input.

### `location.updated`

Payload:

- `tenant_id`
- `driver_id`
- `vehicle_id`
- `device_id`
- `lat`
- `lng`
- `speed`
- `heading`
- `captured_at`

Consumers:

- normally no management consumer for full stream

Actions:

- app realtime broadcasting;
- optional summarized active vehicle counting.

### `incident.created`

Payload:

- `tenant_id`
- `incident_id`
- `incident_type`
- `severity`
- `route_id`
- `execution_id`

Consumers:

- `management-api`

Actions:

- summary and governance alerts.

### `usage.daily_measured`

Payload:

- `tenant_id`
- `date`
- `active_vehicles`
- `active_devices`
- `active_drivers`
- `executions_completed`
- `optimizations_completed`

Consumers:

- `management-api`

Actions:

- upsert `tenant_usage_daily`.

---

## 6.4 Routing Core Published Events

### `optimization.requested`

Producer:

- `routing-core` when standalone

Payload:

- `tenant_id`
- `request_id`
- `operation_profile`
- `provider_strategy`

### `optimization.completed`

Payload:

- `tenant_id`
- `request_id`
- `result_id`
- `provider`
- `status`
- `distance_total`
- `duration_total`
- `quality_score`

Consumers:

- `app-api`
- `management-api` summary only

Actions:

- persist result;
- update route optimization state;
- increment usage metrics.

### `optimization.failed`

Payload:

- `tenant_id`
- `request_id`
- `error_code`
- `retryable`
- `failed_at`

Consumers:

- `app-api`
- `management-api` optional alerting

### `eta.recomputed`

Payload:

- `tenant_id`
- `execution_id`
- `route_id`
- `updated_eta`

Consumers:

- `app-api`

Actions:

- update UI and execution supervision.

---

## 7. Consumer Matrix

| Event | Producer | Consumers |
|---|---|---|
| `tenant.created` | `management-api` | `app-api` |
| `tenant.updated` | `management-api` | `app-api` |
| `tenant.activated` | `management-api` | `app-api` |
| `tenant.deactivated` | `management-api` | `app-api` |
| `tenant.profile.changed` | `management-api` | `app-api`, `routing-core` |
| `tenant.module.enabled` | `management-api` | `app-api` |
| `tenant.module.disabled` | `management-api` | `app-api` |
| `contract.activated` | `management-api` | `app-api` |
| `contract.suspended` | `management-api` | `app-api` |
| `license.updated` | `management-api` | `app-api` |
| `implementation.started` | `management-api` | optional |
| `implementation.completed` | `management-api` | `app-api` |
| `user.logged_in` | `app-api` | `management-api` |
| `device.registered` | `app-api` | `management-api` |
| `device.bound` | `app-api` | `management-api` |
| `device.unbound` | `app-api` | `management-api` |
| `route.created` | `app-api` | optional |
| `route.updated` | `app-api` | optional |
| `route.optimization.requested` | `app-api` | `management-api`, `routing-core` optional |
| `route.optimized` | `app-api` or `routing-core` | `management-api` |
| `execution.started` | `app-api` | `management-api` |
| `execution.completed` | `app-api` | `management-api` |
| `execution.canceled` | `app-api` | `management-api` |
| `location.updated` | `app-api` | mostly internal runtime |
| `incident.created` | `app-api` | `management-api` |
| `usage.daily_measured` | `app-api` | `management-api` |
| `optimization.requested` | `routing-core` | optional |
| `optimization.completed` | `routing-core` | `app-api`, `management-api` |
| `optimization.failed` | `routing-core` | `app-api`, optional `management-api` |
| `eta.recomputed` | `routing-core` | `app-api` |

---

## 8. Outbox and Inbox Rules

## Outbox

Each writer service must persist business mutation and outbound event in the same database transaction.

Required tables per service:

- `management.outbox_events`
- `app.outbox_events`

Minimum columns:

- `id`
- `event_id`
- `event_type`
- `event_version`
- `aggregate_type`
- `aggregate_id`
- `tenant_id`
- `payload`
- `occurred_at`
- `published_at`
- `publish_attempts`

## Inbox

Each consumer service should record consumed event IDs for idempotency.

Required tables per service:

- `management.inbox_events`
- `app.inbox_events`

Minimum columns:

- `event_id`
- `event_type`
- `received_at`
- `processed_at`
- `status`

---

## 9. Access Control Decision Sources

## App API runtime authorization uses

- `tenants.status`
- `tenant_modules.enabled`
- `licenses.effective limits`
- tenant role membership in app tables

## Management API authorization uses

- `internal_users`
- platform role assignments

The app must not depend on CRM state directly for authorization.

---

## 10. Recommended Next Derivations

This document is sufficient to produce next artifacts:

1. SQL schema specification for `management` schema.
2. SQL schema specification for `app` schema.
3. API surface specification for `management-api`.
4. API surface specification for `app-api`.
5. Event contract package definitions.

The next most useful document is the relational schema spec, derived table by table from this matrix.
