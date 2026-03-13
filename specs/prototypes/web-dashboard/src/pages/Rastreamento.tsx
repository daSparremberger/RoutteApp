import { useEffect, useRef, useState } from 'react';
import { Radio, MapPin, Navigation } from 'lucide-react';
import mapboxgl from 'mapbox-gl';
import { io, Socket } from 'socket.io-client';
import { PageHeader } from '../components/ui/PageHeader';
import { PageTransition } from '../components/ui/PageTransition';
import { useAuthStore } from '../stores/auth';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

interface MotoristaLocation {
  motorista_id: number;
  nome: string;
  lat: number;
  lng: number;
  speed: number;
  heading: number;
  rota_id?: number;
  rota_nome?: string;
  timestamp: number;
}

export function Rastreamento() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const socketRef = useRef<Socket | null>(null);
  const [locations, setLocations] = useState<MotoristaLocation[]>([]);
  const [connected, setConnected] = useState(false);
  const [selectedMotorista, setSelectedMotorista] = useState<number | null>(null);
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (!mapRef.current) return;

    const map = new mapboxgl.Map({
      container: mapRef.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1',
      center: [-47.9292, -15.7801],
      zoom: 11,
    });

    mapInstance.current = map;

    return () => map.remove();
  }, []);

  useEffect(() => {
    if (!token) return;
    connectSocket();
    return () => {
      socketRef.current?.disconnect();
    };
  }, [token]);

  async function connectSocket() {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:3001', {
      auth: { token }
    });

    socket.on('connect', () => {
      console.log('[Socket] Conectado');
      setConnected(true);
      socket.emit('get_locations');
    });

    socket.on('disconnect', () => {
      console.log('[Socket] Desconectado');
      setConnected(false);
    });

    socket.on('all_locations', (locs: MotoristaLocation[]) => {
      setLocations(locs);
      locs.forEach(updateMarker);
    });

    socket.on('location_update', (loc: MotoristaLocation) => {
      setLocations(prev => {
        const exists = prev.findIndex(l => l.motorista_id === loc.motorista_id);
        if (exists >= 0) {
          const updated = [...prev];
          updated[exists] = loc;
          return updated;
        }
        return [...prev, loc];
      });
      updateMarker(loc);
    });

    socket.on('motorista_offline', ({ motorista_id }: { motorista_id: number }) => {
      setLocations(prev => prev.filter(l => l.motorista_id !== motorista_id));
      removeMarker(motorista_id);
    });

    socketRef.current = socket;
  }

  function updateMarker(loc: MotoristaLocation) {
    const map = mapInstance.current;
    if (!map) return;

    let marker = markersRef.current.get(loc.motorista_id);

    if (!marker) {
      // Criar elemento do marker
      const el = document.createElement('div');
      el.className = 'van-marker';
      el.innerHTML = `
        <div style="
          width: 40px; height: 40px;
          background: #3B82F6;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          cursor: pointer;
          transform: rotate(${loc.heading}deg);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
          </svg>
        </div>
      `;

      marker = new mapboxgl.Marker({ element: el })
        .setLngLat([loc.lng, loc.lat])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
          <div style="color: #333; padding: 8px;">
            <strong>${loc.nome}</strong><br/>
            ${loc.rota_nome ? `Rota: ${loc.rota_nome}<br/>` : ''}
            Velocidade: ${loc.speed.toFixed(0)} km/h
          </div>
        `))
        .addTo(map);

      markersRef.current.set(loc.motorista_id, marker);
    } else {
      // Atualizar posicao existente
      marker.setLngLat([loc.lng, loc.lat]);

      // Atualizar rotacao
      const el = marker.getElement();
      const innerDiv = el.querySelector('div');
      if (innerDiv) {
        innerDiv.style.transform = `rotate(${loc.heading}deg)`;
      }

      // Atualizar popup
      marker.setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="color: #333; padding: 8px;">
          <strong>${loc.nome}</strong><br/>
          ${loc.rota_nome ? `Rota: ${loc.rota_nome}<br/>` : ''}
          Velocidade: ${loc.speed.toFixed(0)} km/h
        </div>
      `));
    }
  }

  function removeMarker(motoristaId: number) {
    const marker = markersRef.current.get(motoristaId);
    if (marker) {
      marker.remove();
      markersRef.current.delete(motoristaId);
    }
  }

  function focusMotorista(loc: MotoristaLocation) {
    setSelectedMotorista(loc.motorista_id);
    mapInstance.current?.flyTo({
      center: [loc.lng, loc.lat],
      zoom: 15,
      duration: 1000
    });
  }

  function formatTime(timestamp: number) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return 'agora';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}min atrás`;
    return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  return (
    <PageTransition>
    <div className="flex h-full min-h-0 flex-col gap-4 lg:flex-row lg:gap-6">
      {/* Lista de motoristas */}
      <div className="w-full shrink-0 overflow-y-auto pr-0 lg:w-80 lg:pr-1">
        <PageHeader title="Rastreamento" subtitle={
          <span className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
            {connected ? 'Ao vivo' : 'Desconectado'}
          </span>
        } />

        {locations.length === 0 ? (
          <div className="border border-border/30 rounded-xl p-6 text-center">
            <Radio size={32} className="text-text-muted mx-auto mb-3" />
            <p className="text-text-muted text-sm">Nenhum motorista em rota</p>
          </div>
        ) : (
          <div className="space-y-2">
            {locations.map((loc) => (
              <button
                key={loc.motorista_id}
                onClick={() => focusMotorista(loc)}
                className={`w-full text-left border rounded-xl p-4 transition-colors ${
                  selectedMotorista === loc.motorista_id ? 'border-accent' : 'border-border/30 hover:border-border'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-text shrink-0">
                    <Navigation size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-text font-medium truncate">{loc.nome}</p>
                    {loc.rota_nome && (
                      <p className="text-text-muted text-xs truncate">{loc.rota_nome}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-success text-xs">{loc.speed.toFixed(0)} km/h</span>
                      <span className="text-text-muted text-xs">{formatTime(loc.timestamp)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Mapa */}
      <div className="min-h-[340px] flex-1 ui-table-wrap lg:min-h-0">
        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
    </PageTransition>
  );
}





