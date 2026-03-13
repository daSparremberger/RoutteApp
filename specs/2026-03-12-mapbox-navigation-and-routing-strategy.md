# Rotavans - Mapbox Navigation and Routing Strategy
**Date:** 2026-03-12  
**Status:** Proposed  
**Scope:** Uso do Mapbox na plataforma operacional e no `routing-core`

---

## 1. Purpose

This document defines how the app should use Mapbox navigation capabilities and how the internal routing intelligence should decide which capability to apply in each scenario.

The goal is not to call one API for everything.

The goal is to create a decision layer that selects the correct strategy for:

- simple navigation;
- route preview;
- ETA and distance estimation;
- multi-stop sequencing;
- route correction from noisy GPS traces;
- execution monitoring;
- future dynamic rerouting.

---

## 2. Architectural Position

Mapbox is an external navigation capability provider.

Inside Rotavans, it should sit behind an internal abstraction:

- `RoutingProvider`
- `NavigationDecisionEngine`

This means:

- app screens never choose Mapbox endpoint directly;
- business flows ask for an outcome;
- the internal engine decides which provider capability to use.

Examples:

- "calculate ETA"
- "optimize 12 school pickups"
- "snap live GPS trace to road"
- "generate drivable geometry for this route"

---

## 3. Mapbox Capabilities to Adopt

## 3.1 Directions API

Use for:

- point-to-point routing;
- fixed ordered stops;
- route preview in dashboard;
- distance and duration estimation;
- generating route geometry and turn-by-turn-compatible path output.

Best fit:

- when stop order is already known;
- when execution is active and only route shape/ETA is needed;
- when recalculating one route for one driver/vehicle.

## 3.2 Matrix API

Use for:

- cost matrix generation;
- comparing many origins/destinations;
- supporting internal optimization heuristics;
- selecting best assignment candidate.

Best fit:

- when internal engine needs travel-time matrix to decide stop sequence;
- when assigning demand to vehicles or balancing routes.

## 3.3 Optimization API v1

Use for:

- basic traveling-salesman / vehicle-routing style sequencing;
- smaller stop sets where hosted optimization is acceptable;
- first production-ready optimization path before heavier internal solver logic.

Best fit:

- ordered route generation for low-to-medium complexity cases;
- school routes with bounded stop counts;
- delivery batches that fit API limits.

## 3.4 Optimization API v2

Use for:

- more advanced optimization workflows as the product matures.

Positioning:

- treat as optional/experimental path until validated against your operational scenarios and commercial stability requirements.

## 3.5 Map Matching API

Use for:

- snapping noisy GPS points to the road network;
- rebuilding driven path from telemetry;
- validating whether execution followed intended road behavior;
- improving historical playback.

Best fit:

- active execution supervision;
- post-execution reconstruction;
- mobile/tablet GPS cleanup.

## 3.6 Isochrone API

Use for:

- service area analysis;
- coverage planning;
- expansion studies;
- implementation and sales diagnostics.

Best fit:

- "which stops can this vehicle serve within X minutes?"
- pre-sales and onboarding analysis;
- territorial planning.

---

## 4. Internal Components

## 4.1 `NavigationDecisionEngine`

Main responsibility:

- inspect the use case and decide which routing strategy to use.

Inputs:

- operation profile;
- number of stops;
- whether order is fixed;
- whether route is in planning or execution phase;
- whether GPS cleanup is required;
- whether ETA only is needed;
- whether optimization quality matters more than speed;
- tenant license limits;
- external provider health.

Outputs:

- chosen strategy;
- chosen Mapbox capability;
- fallback chain;
- execution parameters.

## 4.2 `RoutingProvider`

Interface responsibility:

- abstract provider calls behind a stable internal contract.

Required methods:

- `getDirections()`
- `getMatrix()`
- `optimizeRoute()`
- `matchTrace()`
- `getIsochrone()`

Future-safe methods:

- `recomputeEta()`
- `getAlternativeRoutes()`

## 4.3 `RouteOptimizationService`

Responsibility:

- orchestrate optimization workflow.

It should decide whether to use:

- direct Mapbox Optimization;
- Matrix + internal heuristic;
- Directions only;
- stored geometry reuse.

## 4.4 `TraceCorrectionService`

Responsibility:

- consume raw GPS telemetry and apply Map Matching when needed.

---

## 5. Decision Rules

## Case A: Ordered route already exists

Examples:

- route already saved by gestor;
- driver is executing current assigned route;
- need geometry, ETA, and map preview only.

Strategy:

- use `Directions API`

Why:

- no need to optimize stop sequence;
- only need drivable route and travel estimates.

## Case B: Small to medium stop list, no fixed order

Examples:

- school route generated from passenger list;
- delivery batch for one vehicle;
- one operational run needing best sequence.

Strategy:

- prefer `Optimization API v1`
- fallback to `Matrix + internal heuristic`

Why:

- hosted sequencing is faster to implement;
- internal fallback avoids provider lock-in and limit issues.

## Case C: Larger stop list or richer business constraints

Examples:

- many stops;
- hybrid constraints by shift, capacity, and priority;
- future mixed operations.

Strategy:

- use `Matrix API` + internal optimization engine
- optionally use Directions after sequencing to build final geometry

Why:

- you need more control than black-box hosted optimization alone;
- this is the path to a differentiated product.

## Case D: Live GPS is noisy or drifted

Examples:

- urban canyons;
- weak device GPS;
- historical replay looks wrong.

Strategy:

- use `Map Matching API`

Why:

- execution should be aligned to actual roads;
- this improves monitoring and analytics quality.

## Case E: Coverage and implementation study

Examples:

- estimate viable pickup areas;
- show municipality service radius;
- compare expansion scenarios.

Strategy:

- use `Isochrone API`

Why:

- this is a planning and BI use case, not route execution.

## Case F: Need only travel-time estimates between many points

Examples:

- choosing which vehicle should serve which demand;
- balancing routes;
- estimating assignment cost.

Strategy:

- use `Matrix API`

Why:

- directions per pair would be wasteful;
- matrix is the proper primitive for assignment.

---

## 6. Decision Matrix

| Scenario | Ordered Stops? | Need Optimization? | Need Road Snap? | Recommended Capability |
|---|---|---|---|---|
| Active execution route preview | Yes | No | No | Directions |
| Save route geometry after manual editing | Yes | No | No | Directions |
| One driver, small stop set | No | Yes | No | Optimization v1 |
| Larger stop set with custom constraints | No | Yes | No | Matrix + internal solver |
| Driver telemetry cleanup | N/A | No | Yes | Map Matching |
| Territory/service radius analysis | N/A | No | No | Isochrone |
| Vehicle-demand assignment scoring | N/A | Yes | No | Matrix |

---

## 7. Strategy Policy Object

The app should persist strategy metadata per optimization request.

Suggested fields:

- `operation_profile`
- `stop_count`
- `ordered_input`
- `has_capacity_constraint`
- `has_time_windows`
- `requires_trace_matching`
- `strategy_selected`
- `provider_selected`
- `fallback_used`

This is why the schema includes:

- `app.optimization_requests`
- `app.optimization_results`

---

## 8. Recommended Selection Heuristics

## Baseline heuristics

### Use `Directions`

When:

- stop order is already fixed;
- total path just needs rendering/ETA;
- reroute scope is single active route.

### Use `Optimization v1`

When:

- one route is being built;
- stop list is not too large;
- constraints are still relatively simple;
- response speed matters more than deep customization.

### Use `Matrix + internal heuristic`

When:

- stop count grows;
- custom business rules matter;
- you need explainability and controllable weighting;
- you want product differentiation.

### Use `Map Matching`

When:

- raw GPS enters analytics or operational history;
- road snapping quality matters;
- execution replay is user-facing.

### Use `Isochrone`

When:

- the user is analyzing service reach or territory.

---

## 9. Vertical-Specific Policy

## School Transport

Default:

- route creation: `Optimization v1` for initial sequencing
- route geometry: `Directions`
- execution replay: `Map Matching`

Additional logic:

- preserve shift constraints;
- favor stable routes over aggressive daily changes;
- optimize with child pickup consistency in mind.

## Delivery

Default:

- assignment cost: `Matrix`
- sequencing: `Matrix + internal heuristic`
- final route geometry: `Directions`
- execution replay: `Map Matching`

Additional logic:

- prioritize capacity and time windows;
- support dynamic insertion later.

## Corporate Shuttle

Default:

- recurring route templates;
- `Optimization v1` or internal heuristic for initial design;
- `Directions` for execution and ETA.

---

## 10. Runtime Flow

## Planning Flow

1. gestor submits route demand
2. app-api normalizes demand into canonical payload
3. `NavigationDecisionEngine` classifies the case
4. selected strategy is persisted in `optimization_requests`
5. selected provider path runs
6. result is persisted in `optimization_results`
7. `routes` and `route_stops` are updated
8. event `route.optimized` is published

## Execution Flow

1. driver starts route
2. app loads saved geometry and stop sequence
3. ETA refresh uses `Directions` when needed
4. raw telemetry may be buffered
5. `Map Matching` is applied for quality-sensitive monitoring/history
6. immutable snapshot is written at completion

---

## 11. Mobile App Intelligence

The intelligence should not sit only in backend.

The mobile app should have lightweight local decision support for:

- offline tolerance;
- deciding when to request reroute;
- deciding when to batch telemetry before upload;
- deciding when local GPS should be flagged as low confidence.

But provider selection itself should remain server-driven whenever possible.

Reason:

- easier rollout;
- easier observability;
- lower exposure of provider logic;
- better cost control.

---

## 12. Cost and Safety Controls

The app must not call expensive APIs blindly.

Required controls:

- server-side provider gateway;
- request throttling by tenant;
- cache for repeated Directions requests on unchanged routes;
- matrix and optimization request audit;
- per-tenant quota checks from effective license.

Suggested caches:

- route geometry cache by normalized stop signature;
- ETA cache with short TTL;
- service area cache for onboarding and BI.

---

## 13. Fallback Strategy

Primary principle:

- if the best provider path fails, degrade gracefully rather than block all operation.

Recommended fallback chain:

### For planned routing

1. Optimization API
2. Matrix + internal heuristic
3. keep existing route order and call Directions

### For live execution

1. Directions for reroute
2. keep stored geometry and continue execution

### For telemetry cleanup

1. Map Matching
2. use raw telemetry marked as unsnapped

---

## 14. Data to Persist for Explainability

For every optimization, persist:

- why this strategy was selected;
- input size and complexity markers;
- provider used;
- fallback path if any;
- response duration;
- final quality score.

This is necessary because your product goal is not just routing, but intelligent routing.

---

## 15. Recommended Next Technical Step

The next implementation artifact should be a provider contract such as:

- `packages/contracts/src/routing.ts`

Containing:

- internal request/response types;
- strategy enum;
- Mapbox adapter interfaces;
- normalized stop and constraint types.

That contract should then drive both:

- `app-api`
- Flutter client integration.
