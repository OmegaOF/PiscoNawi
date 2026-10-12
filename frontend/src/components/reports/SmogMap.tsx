import React, { useEffect, useMemo, useRef } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ZonaItem } from '../../lib/reportsApi';
import { etiquetaZona, NIVEL_LABEL, nivelSmog } from '../../lib/smog';
import { LEVEL_COLORS } from '../../lib/chartCtx';
import { fmtInt, fmtPct } from '../../lib/format';

interface SmogMapProps {
  zonas: ZonaItem[];
  height: number | string;
  dark: boolean;
  permanentLabels?: boolean;
  selectedId?: number | null;
}

const FitBounds: React.FC<{ zonas: ZonaItem[]; padding: number }> = ({ zonas, padding }) => {
  const map = useMap();
  const key = zonas.map((z) => z.ubicacion_id).join(',');
  useEffect(() => {
    if (!zonas.length) return;
    if (zonas.length === 1) {
      map.setView([zonas[0].latitud, zonas[0].longitud], 14);
      return;
    }
    map.fitBounds(L.latLngBounds(zonas.map((z) => [z.latitud, z.longitud] as [number, number])), { padding: [padding, padding], maxZoom: 14 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
};

const InvalidateOnResize: React.FC = () => {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    const onFs = () => setTimeout(() => map.invalidateSize(), 150);
    document.addEventListener('fullscreenchange', onFs);
    return () => {
      ro.disconnect();
      document.removeEventListener('fullscreenchange', onFs);
    };
  }, [map]);
  return null;
};

const FlyToSelected: React.FC<{ zonas: ZonaItem[]; selectedId?: number | null; markers: React.MutableRefObject<Record<number, L.CircleMarker | null>> }> = ({
  zonas,
  selectedId,
  markers,
}) => {
  const map = useMap();
  useEffect(() => {
    if (selectedId == null) return;
    const z = zonas.find((x) => x.ubicacion_id === selectedId);
    if (!z) return;
    map.flyTo([z.latitud, z.longitud], 14, { duration: 0.8 });
    setTimeout(() => markers.current[selectedId]?.openPopup(), 850);
  }, [selectedId, zonas, map, markers]);
  return null;
};

const SmogMap: React.FC<SmogMapProps> = ({ zonas, height, dark, permanentLabels, selectedId }) => {
  const markers = useRef<Record<number, L.CircleMarker | null>>({});
  const maxTotal = useMemo(() => Math.max(1, ...zonas.map((z) => z.total)), [zonas]);
  const center: [number, number] = zonas.length ? [zonas[0].latitud, zonas[0].longitud] : [-17.39, -66.16];
  const tiles = dark
    ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'
    : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';

  return (
    <div className="overflow-hidden rounded-xl bg-neutral-border" style={{ height }}>
      <MapContainer center={center} zoom={12} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer key={tiles} url={tiles} attribution='Mapa base &copy; Esri, HERE, Garmin, &copy; OpenStreetMap' maxZoom={16} />
        <FitBounds zonas={zonas} padding={permanentLabels ? 56 : 40} />
        <InvalidateOnResize />
        <FlyToSelected zonas={zonas} selectedId={selectedId} markers={markers} />
        {zonas.map((z) => {
          const n = nivelSmog(z.pct_smog, z.smog);
          const color = LEVEL_COLORS[n][dark ? 'dark' : 'light'];
          const r = Math.min(30, Math.max(9, 9 + Math.sqrt(z.total / maxTotal) * 21));
          return (
            <React.Fragment key={z.ubicacion_id}>
              <CircleMarker center={[z.latitud, z.longitud]} radius={r + 10} pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0.18 }} interactive={false} />
              <CircleMarker
                ref={(m) => {
                  markers.current[z.ubicacion_id] = m;
                }}
                center={[z.latitud, z.longitud]}
                radius={r}
                pathOptions={{ color: dark ? '#1C1517' : '#ffffff', weight: 2, fillColor: color, fillOpacity: 0.9 }}
              >
                <Tooltip direction="top" offset={[0, -r]} permanent={permanentLabels} className="zona-label">
                  {etiquetaZona(z)} · {fmtPct(z.pct_smog, 0)}
                </Tooltip>
                <Popup>
                  <div className="min-w-[200px] space-y-1 text-sm">
                    <p className="font-semibold text-vino">{etiquetaZona(z)}</p>
                    {z.direccion && <p className="text-xs text-gray-500">{z.direccion}</p>}
                    {z.ciudad && <p className="text-xs text-gray-500">Ciudad: {z.ciudad}</p>}
                    <p>
                      Vehículos analizados: <strong>{fmtInt(z.total)}</strong>
                    </p>
                    <p>
                      Con smog: <strong>{fmtInt(z.smog)}</strong> ({fmtPct(z.pct_smog)})
                    </p>
                    <p>
                      Nivel: <strong style={{ color }}>{NIVEL_LABEL[n]}</strong>
                    </p>
                  </div>
                </Popup>
              </CircleMarker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default SmogMap;
