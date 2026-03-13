import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import type { RotaParada } from '@rotavans/shared';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface Props {
  paradas: RotaParada[];
  geojson?: string;
}

export function RouteMap({ paradas, geojson }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const map = new mapboxgl.Map({
      container: ref.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [-47.9292, -15.7801],
      zoom: 11,
    });

    map.on('load', () => {
      paradas.forEach((p, i) => {
        if (!p.lat || !p.lng) return;
        const el = document.createElement('div');
        el.style.cssText = 'width:26px;height:26px;background:#3B82F6;border:2px solid white;border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-size:11px;font-weight:700;';
        el.textContent = String(i + 1);
        new mapboxgl.Marker({ element: el })
          .setLngLat([p.lng, p.lat])
          .setPopup(new mapboxgl.Popup({ offset: 15 }).setText(p.aluno_nome || `Parada ${i + 1}`))
          .addTo(map);
      });

      if (geojson) {
        map.addSource('rota', { type: 'geojson', data: JSON.parse(geojson) });
        map.addLayer({
          id: 'rota-line',
          type: 'line',
          source: 'rota',
          paint: { 'line-color': '#3B82F6', 'line-width': 4, 'line-opacity': 0.85 },
        });
      }

      const valid = paradas.filter((p) => p.lat && p.lng);
      if (valid.length > 1) {
        const bounds = valid.reduce(
          (b, p) => b.extend([p.lng!, p.lat!]),
          new mapboxgl.LngLatBounds([valid[0].lng!, valid[0].lat!], [valid[0].lng!, valid[0].lat!])
        );
        map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
      }
    });

    return () => map.remove();
  }, [paradas, geojson]);

  return <div ref={ref} className="w-full h-80 rounded-xl overflow-hidden border border-surface2" />;
}



