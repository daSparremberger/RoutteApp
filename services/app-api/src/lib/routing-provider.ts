import type {
  DirectionsResult,
  MapMatchResult,
  MatrixResult,
  NormalizedStop,
  OptimizationResult,
  RoutingProvider
} from "@rotavans/shared";

const MAPBOX_BASE = "https://api.mapbox.com";

function getAccessToken() {
  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    throw new Error("MAPBOX_ACCESS_TOKEN not configured");
  }
  return token;
}

function serializeStops(stops: NormalizedStop[]) {
  return stops.map((stop) => `${stop.lng},${stop.lat}`).join(";");
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${MAPBOX_BASE}${path}&access_token=${getAccessToken()}`);
  if (!res.ok) {
    throw new Error(`Mapbox request failed with status ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const mapboxProvider: RoutingProvider = {
  async getDirections(stops, profile = "driving"): Promise<DirectionsResult> {
    const data = await request<any>(
      `/directions/v5/mapbox/${profile}/${serializeStops(stops)}?geometries=geojson&overview=full`
    );
    const route = data.routes?.[0];

    if (!route) {
      throw new Error("Mapbox directions returned no route");
    }

    return {
      geometry: route.geometry,
      distance: route.distance,
      duration: route.duration,
      waypoints: (data.waypoints ?? []).map((waypoint: any) => ({
        location: waypoint.location,
        name: waypoint.name ?? ""
      }))
    };
  },

  async getMatrix(origins, destinations): Promise<MatrixResult> {
    const stops = [...origins, ...destinations];
    const sources = origins.map((_, index) => index).join(";");
    const targetOffset = origins.length;
    const targets = destinations.map((_, index) => targetOffset + index).join(";");

    const data = await request<any>(
      `/directions-matrix/v1/mapbox/driving/${serializeStops(stops)}?sources=${sources}&destinations=${targets}&annotations=duration,distance`
    );

    return {
      durations: data.durations ?? [],
      distances: data.distances ?? [],
      sources: (data.sources ?? []).map((source: any) => ({ location: source.location })),
      destinations: (data.destinations ?? []).map((destination: any) => ({
        location: destination.location
      }))
    };
  },

  async optimizeRoute(stops, profile = "driving"): Promise<OptimizationResult> {
    const data = await request<any>(
      `/optimized-trips/v1/mapbox/${profile}/${serializeStops(stops)}?geometries=geojson&overview=full&roundtrip=false&source=first&destination=last`
    );

    return {
      trips: (data.trips ?? []).map((trip: any) => ({
        geometry: trip.geometry,
        distance: trip.distance,
        duration: trip.duration
      })),
      waypoints: (data.waypoints ?? []).map((waypoint: any) => ({
        waypoint_index: waypoint.waypoint_index,
        trips_index: waypoint.trips_index,
        location: waypoint.location
      }))
    };
  },

  async matchTrace(coordinates, timestamps): Promise<MapMatchResult> {
    const coords = coordinates.map((coord) => `${coord[0]},${coord[1]}`).join(";");
    const timestampQuery = timestamps?.length ? `&timestamps=${timestamps.join(";")}` : "";
    const data = await request<any>(
      `/matching/v5/mapbox/driving/${coords}?geometries=geojson&overview=full${timestampQuery}`
    );

    return {
      geometry: data.matchings?.[0]?.geometry ?? { type: "LineString", coordinates: [] },
      confidence: data.matchings?.[0]?.confidence ?? 0,
      matchings: (data.matchings ?? []).map((matching: any) => ({
        distance: matching.distance,
        duration: matching.duration,
        geometry: matching.geometry
      }))
    };
  }
};
