export interface AddressSuggestion {
  address: string;
  lat: number;
  lng: number;
}

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

function hasToken() {
  return typeof MAPBOX_TOKEN === 'string' && MAPBOX_TOKEN.length > 0;
}

function buildUrl(query: string) {
  const encoded = encodeURIComponent(query);
  return `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json?access_token=${MAPBOX_TOKEN}&autocomplete=true&limit=5&language=pt&country=br`;
}

export async function searchAddresses(query: string): Promise<AddressSuggestion[]> {
  const trimmed = query.trim();
  if (!trimmed || trimmed.length < 3 || !hasToken()) return [];

  const res = await fetch(buildUrl(trimmed));
  if (!res.ok) return [];

  const data = await res.json();
  const features = Array.isArray(data?.features) ? data.features : [];

  return features
    .filter((feature: any) => Array.isArray(feature?.center) && feature.center.length === 2)
    .map((feature: any) => ({
      address: String(feature.place_name || feature.text || '').trim(),
      lng: Number(feature.center[0]),
      lat: Number(feature.center[1]),
    }))
    .filter((item: AddressSuggestion) => item.address && Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

export async function geocodeAddress(query: string): Promise<AddressSuggestion | null> {
  const [first] = await searchAddresses(query);
  return first || null;
}
