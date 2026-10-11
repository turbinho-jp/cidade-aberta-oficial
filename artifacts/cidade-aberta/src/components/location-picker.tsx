import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { LocateFixed, MapPin, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_ZOOM,
  JOAO_PESSOA_CENTER,
  OUT_OF_AREA_MESSAGE,
  SERVICE_AREA_BOUNDS,
  isInsideServiceArea,
  roundCoordinate,
} from "@/lib/geo";

export interface PickedLocation {
  lat: number;
  lng: number;
}

interface LocationPickerProps {
  value: PickedLocation | null;
  onChange: (value: PickedLocation | null) => void;
  invalid?: boolean;
}

// Pino próprio (divIcon): não depende de imagens externas do Leaflet.
const pinIcon = L.divIcon({
  className: "",
  html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" fill="#dc2626" stroke="white" stroke-width="1.5">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`,
  iconSize: [32, 48],
  iconAnchor: [16, 48],
});

function ClickToPlace({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Move o mapa só quando `focus` muda (ex.: "usar minha localização"). */
function FocusOn({ focus }: { focus: { lat: number; lng: number; n: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.flyTo([focus.lat, focus.lng], Math.max(map.getZoom(), 17));
  }, [focus, map]);
  return null;
}

export function LocationPicker({ value, onChange, invalid }: LocationPickerProps) {
  const [notice, setNotice] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [focus, setFocus] = useState<{ lat: number; lng: number; n: number } | null>(null);

  const place = (lat: number, lng: number): boolean => {
    if (!isInsideServiceArea(lat, lng)) {
      setNotice(OUT_OF_AREA_MESSAGE);
      return false;
    }
    setNotice(null);
    onChange({ lat: roundCoordinate(lat), lng: roundCoordinate(lng) });
    return true;
  };

  const locateMe = () => {
    if (!("geolocation" in navigator)) {
      setNotice("Seu navegador não permite obter a localização. Clique no mapa para marcar o local.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        if (place(latitude, longitude)) {
          setFocus({ lat: latitude, lng: longitude, n: Date.now() });
        }
      },
      () => {
        setLocating(false);
        setNotice("Não foi possível obter sua localização. Clique no mapa para marcar o local.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div className="space-y-2">
      <div
        className={`relative isolate z-0 overflow-hidden rounded-md border ${
          invalid ? "border-destructive" : "border-border"
        }`}
        style={{ height: 320 }}
      >
        <MapContainer
          center={JOAO_PESSOA_CENTER}
          zoom={DEFAULT_ZOOM}
          minZoom={11}
          maxBounds={SERVICE_AREA_BOUNDS}
          maxBoundsViscosity={1}
          scrollWheelZoom={false}
          style={{ width: "100%", height: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickToPlace onPick={place} />
          <FocusOn focus={focus} />
          {value && (
            <Marker
              position={[value.lat, value.lng]}
              icon={pinIcon}
              draggable
              eventHandlers={{
                dragend(e) {
                  const marker = e.target as L.Marker;
                  const { lat, lng } = marker.getLatLng();
                  if (!place(lat, lng)) {
                    // Soltou fora da área: volta para o último ponto válido.
                    marker.setLatLng([value.lat, value.lng]);
                  }
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={locateMe} disabled={locating}>
          {locating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LocateFixed className="w-4 h-4 mr-2" />}
          Usar minha localização
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setNotice(null);
              onChange(null);
            }}
          >
            <X className="w-4 h-4 mr-1" />
            Remover marcação
          </Button>
        )}
        <span className="text-xs text-muted-foreground flex items-center gap-1 ml-auto" aria-live="polite">
          <MapPin className="w-3 h-3" />
          {value
            ? `Local marcado: ${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}`
            : "Clique no mapa para marcar o local"}
        </span>
      </div>

      {notice && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {notice}
        </p>
      )}
    </div>
  );
}
