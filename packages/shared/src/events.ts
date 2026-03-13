export type CrossServiceEvent =
  | "tenant.created"
  | "tenant.deactivated"
  | "tenant.module.enabled"
  | "tenant.module.disabled"
  | "license.updated"
  | "user.logged_in"
  | "device.bound"
  | "device.unbound"
  | "execution.started"
  | "execution.completed"
  | "route.optimization_requested"
  | "route.optimization_completed";

export interface EventEnvelope<TPayload> {
  event_id: string;
  event_type: CrossServiceEvent;
  event_version: number;
  occurred_at: string;
  producer: "management-api" | "app-api";
  tenant_id?: number;
  correlation_id?: string;
  causation_id?: string;
  payload: TPayload;
}

export interface EventPayloads {
  "tenant.created": {
    tenant_id: number;
  };
  "tenant.deactivated": {
    tenant_id: number;
    reason?: string;
  };
  "tenant.module.enabled": {
    tenant_id: number;
    module_slug: string;
  };
  "tenant.module.disabled": {
    tenant_id: number;
    module_slug: string;
    disabled_reason?: string;
  };
  "license.updated": {
    tenant_id: number;
    effective_license: {
      max_vehicles?: number;
      max_drivers?: number;
      max_devices?: number;
    };
  };
  "user.logged_in": {
    tenant_id: number;
    user_id: number;
    user_type: "gestor" | "motorista";
    firebase_uid?: string;
    device_id?: string;
    ip?: string;
    user_agent?: string;
    login_method?: "firebase" | "pin";
  };
  "device.bound": {
    tenant_id: number;
    device_id: string;
    vehicle_id: number;
    driver_id: number;
    bound_at: string;
  };
  "device.unbound": {
    tenant_id: number;
    device_id: string;
    vehicle_id: number;
    driver_id: number;
    unbound_at: string;
  };
  "execution.started": {
    tenant_id: number;
    execution_id: number;
    route_id: number;
    driver_id: number;
    vehicle_id: number;
    started_at: string;
  };
  "execution.completed": {
    tenant_id: number;
    execution_id: number;
    route_id: number;
    driver_id: number;
    vehicle_id: number;
    completed_at: string;
    stats: {
      completed_stops?: number;
      skipped_stops?: number;
      distance_total?: number;
      duration_total?: number;
    };
  };
  "route.optimization_requested": {
    tenant_id: number;
    rota_id: number;
    request_id: number;
    strategy: string;
    stop_count: number;
  };
  "route.optimization_completed": {
    tenant_id: number;
    rota_id: number;
    request_id: number;
    strategy: string;
    distance_total?: number;
    duration_total?: number;
  };
}

export type EventPayload<E extends CrossServiceEvent> = EventPayloads[E];

export type EventPayloadMap = EventPayloads;
