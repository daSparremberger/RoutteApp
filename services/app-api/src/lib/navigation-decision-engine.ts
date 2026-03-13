import type { RoutingDecisionInput, RoutingDecisionOutput } from "@rotavans/shared";

const OPTIMIZATION_V1_MAX_STOPS = 12;

export function decideRoutingStrategy(input: RoutingDecisionInput): RoutingDecisionOutput {
  if (input.requiresTraceMatching) {
    return {
      strategy: "map_matching",
      fallbackChain: [],
      reason: "Trace correction requested"
    };
  }

  if (
    input.orderedInput ||
    input.operationProfile === "route_preview" ||
    input.operationProfile === "execution_reroute"
  ) {
    return {
      strategy: "directions",
      fallbackChain: [],
      reason: "Input order is fixed"
    };
  }

  if (
    input.operationProfile === "route_optimization" &&
    !input.hasCapacityConstraint &&
    !input.hasTimeWindows &&
    input.stops.length <= OPTIMIZATION_V1_MAX_STOPS
  ) {
    return {
      strategy: "optimization_v1",
      fallbackChain: ["matrix_heuristic", "directions"],
      reason: "Small unordered route without constraints"
    };
  }

  if (
    input.operationProfile === "route_optimization" ||
    input.operationProfile === "assignment_scoring" ||
    input.operationProfile === "coverage_analysis"
  ) {
    return {
      strategy: "matrix_heuristic",
      fallbackChain: ["directions"],
      reason: "Using matrix-based heuristic"
    };
  }

  return {
    strategy: "directions",
    fallbackChain: [],
    reason: "Default fallback"
  };
}
