# Rotavans - Relational Schema Specification
**Date:** 2026-03-12  
**Status:** Proposed  
**Depends on:**  
- `2026-03-12-domain-model-spec.md`  
- `2026-03-12-ownership-matrix-and-event-catalog.md`

---

## 1. Purpose

This document defines the target relational schema for the new architecture.

It is intended to be close enough to implementation that it can be converted into SQL migrations with minimal interpretation.

The schema is split into:

- `management` schema
- `app` schema

Ownership is strict:

- `management-api` owns `management.*`
- `app-api` owns `app.*`

---

## 2. General Modeling Rules

- primary keys: `bigserial` for high-growth tables, `serial` acceptable for small static catalogs;
- timestamps: `created_at timestamptz not null default now()`;
- mutable rows use `updated_at timestamptz not null default now()`;
- soft delete only where audit value exists;
- status fields use constrained `text` or lookup table;
- all tenant-scoped tables must contain `tenant_id`;
- uniqueness should be tenant-aware unless globally canonical;
- history tables must be append-only where practical;
- all event-producing tables should be compatible with outbox transactions.

---

## 3. `management` Schema

## 3.1 Catalog and Commercial Core

### `management.organizations`

Purpose:

- legal/commercial account owner.

Columns:

- `id bigserial primary key`
- `legal_name text not null`
- `display_name text not null`
- `document_number text null`
- `organization_type text not null`
- `email text null`
- `phone text null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `organization_type in ('municipality','private_company','operator','partner','internal')`
- `status in ('active','inactive','prospect')`

Indexes:

- unique partial on `document_number` when not null
- index on `status`

### `management.tenants`

Columns:

- `id bigserial primary key`
- `organization_id bigint not null references management.organizations(id)`
- `name text not null`
- `slug text not null`
- `segment text not null`
- `status text not null default 'provisioning'`
- `city text null`
- `state text null`
- `country text not null default 'BR'`
- `timezone text not null default 'America/Sao_Paulo'`
- `go_live_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `slug`
- `segment in ('school_transport','delivery','corporate_shuttle','field_service','mixed')`
- `status in ('provisioning','implementation','active','suspended','inactive','archived')`

Indexes:

- `organization_id`
- `status`
- `segment`

### `management.tenant_profiles`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `operation_profile text not null`
- `primary_use_case text not null`
- `device_strategy text not null`
- `requires_offline_mode boolean not null default false`
- `has_dispatch_center boolean not null default false`
- `profile_version integer not null default 1`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`

Constraints:

- `operation_profile in ('school_transport','delivery','corporate_shuttle','field_service','mixed')`
- `device_strategy in ('embedded_tablet','byod_driver_phone','hybrid')`

Indexes:

- unique partial on `(tenant_id)` where `active = true`

### `management.products`

Columns:

- `id bigserial primary key`
- `slug text not null unique`
- `name text not null`
- `description text null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`

### `management.modules`

Columns:

- `id bigserial primary key`
- `product_id bigint null references management.products(id)`
- `slug text not null unique`
- `name text not null`
- `description text null`
- `category text not null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`

Constraints:

- `category in ('core','operations','analytics','finance','communication','vertical','devices')`
- `status in ('active','inactive','beta')`

### `management.module_dependencies`

Columns:

- `module_id bigint not null references management.modules(id) on delete cascade`
- `depends_on_module_id bigint not null references management.modules(id) on delete cascade`
- `dependency_type text not null default 'required'`
- `created_at timestamptz not null default now()`

Primary key:

- `(module_id, depends_on_module_id)`

Constraint:

- `dependency_type in ('required','recommended')`

### `management.plans`

Columns:

- `id bigserial primary key`
- `slug text not null unique`
- `name text not null`
- `description text null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`

### `management.plan_modules`

Columns:

- `plan_id bigint not null references management.plans(id) on delete cascade`
- `module_id bigint not null references management.modules(id) on delete cascade`
- `included boolean not null default true`
- `created_at timestamptz not null default now()`

Primary key:

- `(plan_id, module_id)`

## 3.2 Sales, Contract, and Billing

### `management.commercial_leads`

Columns:

- `id bigserial primary key`
- `organization_id bigint null references management.organizations(id)`
- `source text null`
- `status text not null default 'open'`
- `owner_user_id bigint null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('open','qualified','disqualified','converted')`

### `management.commercial_opportunities`

Columns:

- `id bigserial primary key`
- `lead_id bigint null references management.commercial_leads(id)`
- `organization_id bigint not null references management.organizations(id)`
- `tenant_id bigint null references management.tenants(id)`
- `stage text not null`
- `estimated_mrr numeric(12,2) null`
- `estimated_arr numeric(12,2) null`
- `close_probability numeric(5,2) null`
- `expected_close_date date null`
- `owner_user_id bigint null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `stage in ('discovery','proposal','negotiation','won','lost')`

### `management.contracts`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `plan_id bigint null references management.plans(id)`
- `contract_number text not null`
- `status text not null`
- `currency_code text not null default 'BRL'`
- `billing_cycle text not null`
- `starts_on date not null`
- `ends_on date null`
- `signed_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(tenant_id, contract_number)`
- `status in ('draft','pending_signature','active','suspended','expired','terminated')`
- `billing_cycle in ('monthly','quarterly','yearly','custom')`

Indexes:

- `(tenant_id, status)`

### `management.contract_items`

Columns:

- `id bigserial primary key`
- `contract_id bigint not null references management.contracts(id) on delete cascade`
- `item_type text not null`
- `module_id bigint null references management.modules(id)`
- `license_metric text null`
- `quantity integer null`
- `unit_price numeric(12,2) not null default 0`
- `minimum_commitment integer null`
- `status text not null default 'active'`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`

Constraints:

- `item_type in ('module','license_limit','implementation','support','custom')`
- `status in ('active','inactive','canceled')`

Indexes:

- `contract_id`
- `(item_type, status)`

### `management.licenses`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `contract_id bigint null references management.contracts(id)`
- `license_type text not null`
- `enforcement_policy text not null default 'soft_alert'`
- `max_vehicles integer null`
- `max_active_vehicles integer null`
- `max_drivers integer null`
- `max_monthly_active_drivers integer null`
- `max_devices integer null`
- `max_totems integer null`
- `max_concurrent_sessions integer null`
- `max_optimization_requests_per_day integer null`
- `status text not null default 'active'`
- `valid_from date not null`
- `valid_to date null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `license_type in ('fleet_based','driver_based','hybrid')`
- `enforcement_policy in ('hard_block','soft_alert','grace_limit','manual_review')`
- `status in ('draft','active','expired','suspended','revoked')`

Indexes:

- `(tenant_id, status)`
- `(valid_from, valid_to)`

### `management.tenant_modules`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `module_id bigint not null references management.modules(id) on delete cascade`
- `enabled boolean not null default true`
- `source text not null default 'contract'`
- `enabled_at timestamptz not null default now()`
- `disabled_at timestamptz null`
- `created_at timestamptz not null default now()`

Constraints:

- unique `(tenant_id, module_id)`
- `source in ('contract','plan','trial','manual_override')`

Indexes:

- `(tenant_id, enabled)`

## 3.3 Implementation and Internal Operations

### `management.internal_users`

Columns:

- `id bigserial primary key`
- `firebase_uid text not null unique`
- `name text not null`
- `email text not null`
- `role text not null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `role in ('superadmin','sales','onboarding','support','finance','ops_admin')`
- `status in ('active','inactive')`

### `management.implementation_projects`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `owner_user_id bigint null references management.internal_users(id)`
- `status text not null default 'planned'`
- `kickoff_at timestamptz null`
- `planned_go_live_at timestamptz null`
- `actual_go_live_at timestamptz null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('planned','in_progress','blocked','completed','canceled')`

### `management.implementation_tasks`

Columns:

- `id bigserial primary key`
- `project_id bigint not null references management.implementation_projects(id) on delete cascade`
- `title text not null`
- `description text null`
- `status text not null default 'pending'`
- `owner_user_id bigint null references management.internal_users(id)`
- `due_at timestamptz null`
- `completed_at timestamptz null`
- `sort_order integer not null default 0`
- `created_at timestamptz not null default now()`

Constraints:

- `status in ('pending','in_progress','blocked','completed','canceled')`

### `management.billing_accounts`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `document_number text null`
- `billing_email text null`
- `billing_name text not null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

### `management.invoices`

Columns:

- `id bigserial primary key`
- `billing_account_id bigint not null references management.billing_accounts(id)`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `reference_period date not null`
- `status text not null default 'open'`
- `amount_due numeric(12,2) not null`
- `amount_paid numeric(12,2) not null default 0`
- `due_date date null`
- `issued_at timestamptz not null default now()`
- `paid_at timestamptz null`
- `created_at timestamptz not null default now()`

Constraints:

- `status in ('draft','open','paid','partially_paid','void','overdue')`

Indexes:

- `(tenant_id, reference_period)`
- `(status, due_date)`

### `management.payments`

Columns:

- `id bigserial primary key`
- `invoice_id bigint not null references management.invoices(id) on delete cascade`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `amount numeric(12,2) not null`
- `payment_method text null`
- `payment_reference text null`
- `status text not null default 'confirmed'`
- `paid_at timestamptz not null`
- `created_at timestamptz not null default now()`

Constraints:

- `status in ('pending','confirmed','failed','reversed')`

## 3.4 Observability, Metrics, and Event Infrastructure

### `management.audit_logs`

Columns:

- `id bigserial primary key`
- `tenant_id bigint null references management.tenants(id) on delete set null`
- `actor_type text not null`
- `actor_id text null`
- `actor_role text null`
- `action text not null`
- `resource_type text null`
- `resource_id text null`
- `http_method text null`
- `http_path text null`
- `status_code integer null`
- `ip text null`
- `device_id text null`
- `user_agent text null`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`

Indexes:

- `(tenant_id, created_at desc)`
- `(actor_type, created_at desc)`
- `(action, created_at desc)`
- `device_id`

### `management.tenant_usage_daily`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `usage_date date not null`
- `active_vehicles integer not null default 0`
- `active_devices integer not null default 0`
- `active_drivers integer not null default 0`
- `executions_started integer not null default 0`
- `executions_completed integer not null default 0`
- `optimizations_requested integer not null default 0`
- `optimizations_completed integer not null default 0`
- `api_requests integer not null default 0`
- `unique_logins integer not null default 0`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(tenant_id, usage_date)`

### `management.anomaly_alerts`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null references management.tenants(id) on delete cascade`
- `alert_type text not null`
- `severity text not null`
- `status text not null default 'open'`
- `description text not null`
- `context jsonb null`
- `opened_at timestamptz not null default now()`
- `resolved_at timestamptz null`
- `resolution_note text null`
- `created_at timestamptz not null default now()`

Constraints:

- `severity in ('info','warning','critical')`
- `status in ('open','resolved','ignored')`

Indexes:

- `(tenant_id, status)`
- unique partial on `(tenant_id, alert_type)` where `status = 'open'`

### `management.outbox_events`

Columns:

- `id bigserial primary key`
- `event_id uuid not null unique`
- `event_type text not null`
- `event_version integer not null`
- `aggregate_type text not null`
- `aggregate_id text not null`
- `tenant_id bigint null`
- `payload jsonb not null`
- `occurred_at timestamptz not null`
- `published_at timestamptz null`
- `publish_attempts integer not null default 0`
- `last_error text null`
- `created_at timestamptz not null default now()`

Indexes:

- `(published_at nulls first, created_at)`
- `(event_type, created_at)`

### `management.inbox_events`

Columns:

- `event_id uuid primary key`
- `event_type text not null`
- `producer text not null`
- `received_at timestamptz not null default now()`
- `processed_at timestamptz null`
- `status text not null default 'received'`
- `error_message text null`

Constraints:

- `status in ('received','processed','failed','ignored')`

---

## 4. `app` Schema

## 4.1 Identity and Access

### `app.gestores`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `firebase_uid text not null unique`
- `name text not null`
- `email text not null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('active','inactive')`

Indexes:

- `tenant_id`

### `app.motoristas`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `firebase_uid text null unique`
- `name text not null`
- `email text null`
- `phone text null`
- `photo_url text null`
- `document_url text null`
- `pin_hash text null`
- `invitation_token text null unique`
- `invitation_expires_at timestamptz null`
- `onboarding_completed boolean not null default false`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('active','inactive','blocked')`

Indexes:

- `tenant_id`
- `firebase_uid`

### `app.user_invites`

Optional generalized invite table.

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `target_role text not null`
- `email text null`
- `token text not null unique`
- `status text not null default 'pending'`
- `expires_at timestamptz null`
- `accepted_at timestamptz null`
- `created_at timestamptz not null default now()`

Constraints:

- `target_role in ('gestor','motorista')`
- `status in ('pending','accepted','expired','revoked')`

This can replace role-specific invite models over time.

## 4.2 Fleet and Device Core

### `app.vehicles`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `plate text not null`
- `vehicle_type text not null default 'van'`
- `model text null`
- `manufacturer text null`
- `year integer null`
- `capacity integer null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(tenant_id, plate)`
- `status in ('active','inactive','maintenance','blocked')`

Indexes:

- `(tenant_id, status)`

### `app.devices`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `device_uid text not null`
- `device_type text not null`
- `os_type text not null`
- `app_flavor text not null`
- `model text null`
- `status text not null default 'active'`
- `last_seen_at timestamptz null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- unique `(tenant_id, device_uid)`
- `device_type in ('tablet','totem','phone','desktop')`
- `os_type in ('android','ios','windows','linux','macos','unknown')`
- `app_flavor in ('driver_flutter','ops_electron','admin_electron','web')`
- `status in ('active','inactive','blocked','lost')`

Indexes:

- `(tenant_id, status)`
- `last_seen_at`

### `app.vehicle_device_bindings`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `vehicle_id bigint not null references app.vehicles(id) on delete cascade`
- `device_id bigint not null references app.devices(id) on delete cascade`
- `binding_type text not null default 'primary'`
- `bound_at timestamptz not null default now()`
- `unbound_at timestamptz null`
- `created_at timestamptz not null default now()`

Constraints:

- `binding_type in ('primary','secondary','totem')`

Indexes:

- unique partial on `(device_id)` where `unbound_at is null`
- unique partial on `(vehicle_id, binding_type)` where `unbound_at is null`
- `(tenant_id, bound_at desc)`

### `app.vehicle_driver_bindings`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `vehicle_id bigint not null references app.vehicles(id) on delete cascade`
- `driver_id bigint not null references app.motoristas(id) on delete cascade`
- `binding_mode text not null default 'authorized'`
- `bound_at timestamptz not null default now()`
- `unbound_at timestamptz null`
- `created_at timestamptz not null default now()`

Constraints:

- `binding_mode in ('authorized','assigned')`

Indexes:

- unique partial on `(vehicle_id, driver_id, binding_mode)` where `unbound_at is null`
- `(tenant_id, bound_at desc)`

## 4.3 Runtime Configuration

### `app.operation_profiles`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `operation_profile text not null`
- `settings jsonb not null default '{}'::jsonb`
- `version integer not null default 1`
- `active boolean not null default true`
- `created_at timestamptz not null default now()`

Indexes:

- unique partial on `(tenant_id)` where `active = true`

## 4.4 Operational Demand and Vertical Data

### `app.service_points`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `point_type text not null`
- `label text not null`
- `address text null`
- `lat double precision not null`
- `lng double precision not null`
- `metadata jsonb null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `point_type in ('home','school','depot','pickup','dropoff','service_site','custom')`
- `status in ('active','inactive')`

Indexes:

- `tenant_id`
- `(lat, lng)`

### `app.passengers`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `name text not null`
- `guardian_name text null`
- `guardian_document text null`
- `guardian_phone text null`
- `home_service_point_id bigint null references app.service_points(id) on delete set null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('active','inactive')`

### `app.schools`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `name text not null`
- `service_point_id bigint null references app.service_points(id) on delete set null`
- `morning_shift boolean not null default false`
- `afternoon_shift boolean not null default false`
- `night_shift boolean not null default false`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Indexes:

- `tenant_id`

### `app.school_passenger_profiles`

Columns:

- `passenger_id bigint primary key references app.passengers(id) on delete cascade`
- `school_id bigint null references app.schools(id) on delete set null`
- `shift text null`
- `notes text null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `shift in ('morning','afternoon','night')`

### `app.shipments`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `external_reference text null`
- `pickup_point_id bigint null references app.service_points(id) on delete set null`
- `dropoff_point_id bigint null references app.service_points(id) on delete set null`
- `status text not null default 'pending'`
- `payload jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('pending','planned','in_transit','delivered','failed','canceled')`

## 4.5 Routing Core Persistence in App Schema

### `app.routes`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `name text not null`
- `route_type text not null default 'planned'`
- `operation_profile text not null`
- `assigned_vehicle_id bigint null references app.vehicles(id) on delete set null`
- `assigned_driver_id bigint null references app.motoristas(id) on delete set null`
- `optimization_status text not null default 'not_optimized'`
- `geometry jsonb null`
- `status text not null default 'active'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `route_type in ('planned','template','dynamic')`
- `optimization_status in ('not_optimized','pending','optimized','failed','stale')`
- `status in ('active','inactive','archived')`

Indexes:

- `(tenant_id, status)`
- `(assigned_driver_id)`
- `(assigned_vehicle_id)`

### `app.route_stops`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `route_id bigint not null references app.routes(id) on delete cascade`
- `service_point_id bigint not null references app.service_points(id) on delete cascade`
- `subject_type text null`
- `subject_id bigint null`
- `stop_order integer not null`
- `planned_arrival_at timestamptz null`
- `service_window_start timestamptz null`
- `service_window_end timestamptz null`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`

Constraints:

- `subject_type in ('passenger','shipment','school','custom')` or null
- unique `(route_id, stop_order)`

Indexes:

- `route_id`
- `(tenant_id, route_id)`

### `app.optimization_requests`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `route_id bigint null references app.routes(id) on delete set null`
- `request_uuid uuid not null unique`
- `operation_profile text not null`
- `provider_strategy text not null`
- `input_payload jsonb not null`
- `status text not null default 'pending'`
- `requested_by_type text not null`
- `requested_by_id bigint null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `provider_strategy in ('directions','optimization_v1','optimization_v2','matrix_plus_internal','map_matching_plus_internal')`
- `status in ('pending','processing','completed','failed','canceled')`
- `requested_by_type in ('system','gestor','motorista')`

Indexes:

- `(tenant_id, created_at desc)`
- `(status, created_at)`

### `app.optimization_results`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `request_id bigint not null references app.optimization_requests(id) on delete cascade`
- `provider text not null`
- `provider_job_id text null`
- `status text not null`
- `distance_total_meters numeric(14,2) null`
- `duration_total_seconds numeric(14,2) null`
- `quality_score numeric(8,2) null`
- `result_payload jsonb not null`
- `created_at timestamptz not null default now()`

Constraints:

- `provider in ('mapbox_directions','mapbox_optimization_v1','mapbox_optimization_v2','internal_hybrid')`
- `status in ('completed','failed','partial')`

Indexes:

- `request_id`
- `(tenant_id, created_at desc)`

## 4.6 Execution and History

### `app.executions`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `route_id bigint null references app.routes(id) on delete set null`
- `driver_id bigint null references app.motoristas(id) on delete set null`
- `vehicle_id bigint null references app.vehicles(id) on delete set null`
- `started_at timestamptz null`
- `completed_at timestamptz null`
- `status text not null default 'planned'`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `status in ('planned','in_progress','paused','completed','canceled','failed')`

Indexes:

- `(tenant_id, status)`
- `(driver_id, status)`

### `app.execution_stops`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `execution_id bigint not null references app.executions(id) on delete cascade`
- `route_stop_id bigint null references app.route_stops(id) on delete set null`
- `subject_type text null`
- `subject_id bigint null`
- `outcome text not null`
- `recorded_at timestamptz not null default now()`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`

Constraints:

- `outcome in ('boarded','skipped','delivered','failed_service','absent','custom')`

Indexes:

- `execution_id`
- `(tenant_id, recorded_at desc)`

### `app.operational_snapshots`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `execution_id bigint null references app.executions(id) on delete set null`
- `route_id bigint null`
- `driver_id bigint null`
- `vehicle_id bigint null`
- `snapshot_type text not null default 'execution_summary'`
- `snapshot_payload jsonb not null`
- `execution_date date not null`
- `created_at timestamptz not null default now()`

Constraints:

- `snapshot_type in ('execution_summary','route_version','compliance_export')`

Indexes:

- `(tenant_id, execution_date desc)`
- `execution_id`

## 4.7 Realtime, Messages, and Incidents

### `app.telemetry_positions`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `driver_id bigint null references app.motoristas(id) on delete set null`
- `vehicle_id bigint null references app.vehicles(id) on delete set null`
- `device_id bigint null references app.devices(id) on delete set null`
- `lat double precision not null`
- `lng double precision not null`
- `speed double precision null`
- `heading double precision null`
- `captured_at timestamptz not null`
- `created_at timestamptz not null default now()`

Indexes:

- `(tenant_id, captured_at desc)`
- `(vehicle_id, captured_at desc)`
- `(driver_id, captured_at desc)`

### `app.messages`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `sender_type text not null`
- `sender_id bigint not null`
- `recipient_type text not null`
- `recipient_id bigint not null`
- `content text not null`
- `read_at timestamptz null`
- `created_at timestamptz not null default now()`

Constraints:

- `sender_type in ('gestor','motorista','system')`
- `recipient_type in ('gestor','motorista','group')`

Indexes:

- `(tenant_id, created_at desc)`
- `(recipient_type, recipient_id, read_at)`

### `app.attachments`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `attachment_type text not null`
- `resource_type text not null`
- `resource_id bigint not null`
- `file_url text not null`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`

### `app.incidents`

Columns:

- `id bigserial primary key`
- `tenant_id bigint not null`
- `execution_id bigint null references app.executions(id) on delete set null`
- `route_id bigint null references app.routes(id) on delete set null`
- `driver_id bigint null references app.motoristas(id) on delete set null`
- `vehicle_id bigint null references app.vehicles(id) on delete set null`
- `incident_type text not null`
- `severity text not null`
- `status text not null default 'open'`
- `description text null`
- `metadata jsonb null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `severity in ('info','warning','critical')`
- `status in ('open','acknowledged','resolved','ignored')`

Indexes:

- `(tenant_id, status)`
- `(severity, created_at desc)`

## 4.8 Event Infrastructure

### `app.outbox_events`

Same structure as `management.outbox_events`.

### `app.inbox_events`

Same structure as `management.inbox_events`.

---

## 5. Cross-Schema Foreign Key Guidance

Recommended rule:

- avoid cross-schema foreign keys between `management` and `app` for high-change runtime entities;
- `tenant_id` integrity is enforced by service logic and provisioning flow;
- use cross-schema reads sparingly;
- favor projections for hot paths.

Reason:

- independent migrations;
- lower deployment coupling;
- simpler service ownership boundaries.

---

## 6. Immediate Migration Strategy from Current Model

Current legacy entities with direct mapping:

- `tenants` -> `management.tenants`
- `gestores` -> `app.gestores`
- `motoristas` -> `app.motoristas`
- `veiculos` -> `app.vehicles`
- `rotas` -> `app.routes`
- `rota_paradas` -> `app.route_stops`
- `rota_historico` -> `app.executions` + `app.operational_snapshots`
- `convites_gestor` -> `app.user_invites` or management invite flow depending final choice

Current entities that should evolve:

- `alunos` -> `app.passengers` + `app.school_passenger_profiles`
- `escolas` -> `app.schools` + `app.service_points`
- tablet-only identity -> `app.devices`

---

## 7. Recommended Next Step

This schema spec is ready to be split into:

1. `management` migration plan
2. `app` migration plan
3. seed catalog spec for modules and plans
4. API contract derivation

For the routing and navigation stack, the next complementary spec should define:

- Mapbox integration boundaries;
- provider strategy selection;
- fallback rules;
- optimization workflow.
