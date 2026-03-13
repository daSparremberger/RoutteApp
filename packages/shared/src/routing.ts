export interface LineStringGeometry {
  type: "LineString";
  coordinates: number[][];
}

export type OptimizationStrategy =
  | "directions"
  | "optimization_v1"
  | "matrix_heuristic"
  | "map_matching";

export type OperationProfile =
  | "route_preview"
  | "route_optimization"
  | "execution_reroute"
  | "trace_correction"
  | "assignment_scoring"
  | "coverage_analysis";

export interface NormalizedStop {
  id: number;
  lat: number;
  lng: number;
  label?: string;
  ordem?: number;
}

export interface RoutingDecisionInput {
  operationProfile: OperationProfile;
  stops: NormalizedStop[];
  orderedInput: boolean;
  hasCapacityConstraint: boolean;
  hasTimeWindows: boolean;
  requiresTraceMatching: boolean;
}

export interface RoutingDecisionOutput {
  strategy: OptimizationStrategy;
  fallbackChain: OptimizationStrategy[];
  reason: string;
}

export interface DirectionsResult {
  geometry: LineStringGeometry;
  distance: number;
  duration: number;
  waypoints: Array<{ location: [number, number]; name: string }>;
}

export interface MatrixResult {
  durations: number[][];
  distances: number[][];
  sources: Array<{ location: [number, number] }>;
  destinations: Array<{ location: [number, number] }>;
}

export interface OptimizationResult {
  trips: Array<{
    geometry: LineStringGeometry;
    distance: number;
    duration: number;
  }>;
  waypoints: Array<{
    waypoint_index: number;
    trips_index: number;
    location: [number, number];
  }>;
}

export interface MapMatchResult {
  geometry: LineStringGeometry;
  confidence: number;
  matchings: Array<{
    distance: number;
    duration: number;
    geometry: LineStringGeometry;
  }>;
}

export interface RoutingProvider {
  getDirections(stops: NormalizedStop[], profile?: string): Promise<DirectionsResult>;
  getMatrix(origins: NormalizedStop[], destinations: NormalizedStop[]): Promise<MatrixResult>;
  optimizeRoute(stops: NormalizedStop[], profile?: string): Promise<OptimizationResult>;
  matchTrace(coordinates: [number, number][], timestamps?: number[]): Promise<MapMatchResult>;
}

export interface OptimizationRequestRecord {
  id: number;
  tenant_id: number;
  rota_id: number;
  operation_profile: OperationProfile;
  stop_count: number;
  ordered_input: boolean;
  strategy_selected: OptimizationStrategy;
  fallback_used: boolean;
  fallback_strategy?: OptimizationStrategy;
  status: "pending" | "completed" | "failed";
  criado_em: string;
}

export interface OptimizationResultRecord {
  id: number;
  request_id: number;
  provider: string;
  strategy_used: OptimizationStrategy;
  input_stops: NormalizedStop[];
  output_order: number[];
  geometry?: LineStringGeometry;
  distance_total?: number;
  duration_total?: number;
  quality_score?: number;
  response_time_ms: number;
  raw_response?: Record<string, unknown>;
  criado_em: string;
}
