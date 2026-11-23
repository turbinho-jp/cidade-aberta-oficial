import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useListDemands, useListCategories, useListNeighborhoods } from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, isPendingModeration } from "@/components/status-badge";
import { DemandStatus } from "@workspace/api-client-react";
import { CategoryIcon } from "@/components/category-icon";
import { Search, Loader2, MapPin, AlertTriangle, Megaphone, SlidersHorizontal, X } from "lucide-react";
import { JOAO_PESSOA_CENTER, DEFAULT_ZOOM, isInsideServiceArea } from "@/lib/geo";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const createCustomIcon = (status: string, pending = false) => {
  let color = "#64748b";
  if (status === "open") color = "#f59e0b";
  if (status === "under_review" || status === "approved") color = "#a855f7";
  if (status === "in_progress") color = "#06b6d4";
  if (status === "completed") color = "#22c55e";
  if (status === "rejected") color = "#ef4444";
  if (pending) color = "#94a3b8";

  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" fill="${color}" stroke="white" stroke-width="1.5">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z"/>
    <circle cx="12" cy="12" r="5" fill="white"/>
  </svg>`;

  return L.divIcon({
    className: "",
    html: svgIcon,
    iconSize: [28, 42],
    iconAnchor: [14, 42],
    popupAnchor: [0, -44],
  });
};

function MapViewportController({
  points,
  hasNeighborhoodFilter,
}: {
  points: Array<[number, number]>;
  hasNeighborhoodFilter: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!hasNeighborhoodFilter) {
      map.flyTo(JOAO_PESSOA_CENTER, DEFAULT_ZOOM, { duration: 0.8 });
      return;
    }
    if (points.length === 1) {
      map.flyTo(points[0], 16, { duration: 0.8 });
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points);
      map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 16, duration: 0.8 });
    }
  }, [map, points, hasNeighborhoodFilter]);

  return null;
}

export default function MapPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [neighborhoodId, setNeighborhoodId] = useState<string>("all");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const activeExtraFiltersCount = (status !== "all" ? 1 : 0) + (categoryId !== "all" ? 1 : 0);

  const { data: demandsResponse, isLoading: loadingDemands } = useListDemands({
    search: search || undefined,
    status: status !== "all" ? (status as DemandStatus) : undefined,
    categoryId: categoryId !== "all" ? parseInt(categoryId) : undefined,
    neighborhoodId: neighborhoodId !== "all" ? parseInt(neighborhoodId) : undefined,
    limit: 500,
  });

  const { data: categories } = useListCategories();
  const { data: neighborhoods } = useListNeighborhoods();

  const selectedNeighborhoodName = useMemo(() => {
    if (neighborhoodId === "all") return null;
    return neighborhoods?.find((n) => n.id.toString() === neighborhoodId)?.name ?? null;
  }, [neighborhoodId, neighborhoods]);

  const { visibleDemands, hiddenCount, stats, points } = useMemo(() => {
    const all = demandsResponse?.demands ?? [];
    const visible = all.filter(d => d.lat != null && d.lng != null && isInsideServiceArea(d.lat, d.lng));
    let open = 0;
    let inProgress = 0;
    let completed = 0;
    for (const d of visible) {
      if (d.status === "completed" || d.status === "closed") completed += 1;
      else if (d.status === "in_progress") inProgress += 1;
      else if (d.status !== "rejected") open += 1;
    }
    return {
      visibleDemands: visible,
      hiddenCount: all.length - visible.length,
      stats: { open, inProgress, completed, total: visible.length },
      points: visible.map((d) => [d.lat, d.lng] as [number, number]),
    };
  }, [demandsResponse?.demands]);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100dvh-64px)]">
        {/* Barra de filtros compacta no mobile e completa no desktop */}
        <div className="z-20 bg-card border-b px-3 py-2.5 sm:p-4 shadow-sm flex flex-col lg:flex-row gap-2.5 lg:gap-4 lg:items-center lg:justify-between flex-shrink-0">
          <div className="hidden lg:flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Mapa de Demandas</h1>
          </div>

          {/* Linha principal: Bairro + Botão Filtros no mobile */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
              <SelectTrigger className="flex-1 lg:w-[180px] h-9 text-sm">
                <SelectValue placeholder="Bairro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bairros</SelectItem>
                {neighborhoods?.map(n => (
                  <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              variant={mobileFiltersOpen || activeExtraFiltersCount > 0 ? "secondary" : "outline"}
              size="sm"
              className="lg:hidden h-9 px-3 shrink-0 gap-1.5"
              onClick={() => setMobileFiltersOpen((v) => !v)}
            >
              {mobileFiltersOpen ? <X className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
              Filtros
              {activeExtraFiltersCount > 0 && (
                <span className="ml-0.5 rounded-full bg-primary text-primary-foreground text-[10px] w-4 h-4 flex items-center justify-center font-bold">
                  {activeExtraFiltersCount}
                </span>
              )}
            </Button>
          </div>

          {/* Filtros extras: sempre visíveis no desktop, recolhíveis no mobile */}
          <div className={`${mobileFiltersOpen ? "flex" : "hidden"} lg:flex flex-col sm:flex-row gap-2.5 w-full lg:w-auto`}>
            <div className="relative flex-1 lg:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar demandas..."
                className="pl-9 h-9 text-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[155px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="under_review">Em análise</SelectItem>
                <SelectItem value="approved">Aprovado</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="rejected">Rejeitado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full sm:w-[175px] h-9 text-sm">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                {categories?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative z-10 min-h-0">
          {/* Resumo flutuante compacto */}
          {!loadingDemands && (
            <div className="absolute top-3 left-14 right-3 sm:right-auto z-[1000] rounded-xl border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-md flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs">
              <span className="font-bold text-foreground">
                {selectedNeighborhoodName ? selectedNeighborhoodName : "João Pessoa"}
              </span>
              <span className="flex items-center gap-1 text-amber-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
                {stats.open} {stats.open === 1 ? "aberta" : "abertas"}
              </span>
              <span className="flex items-center gap-1 text-cyan-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" />
                {stats.inProgress} andamento
              </span>
              <span className="flex items-center gap-1 text-green-600 font-semibold">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {stats.completed} {stats.completed === 1 ? "resolvida" : "resolvidas"}
              </span>
              {neighborhoodId !== "all" && (
                <button
                  type="button"
                  onClick={() => setNeighborhoodId("all")}
                  className="text-primary font-medium hover:underline"
                >
                  Limpar
                </button>
              )}
            </div>
          )}

          {loadingDemands && (
            <div className="absolute inset-0 z-[1000] bg-background/50 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="font-medium text-primary">Carregando demandas...</p>
              </div>
            </div>
          )}
          {hiddenCount > 0 && (
            <div className="hidden sm:flex absolute bottom-4 left-4 z-[1000] max-w-xs rounded-md border bg-card/95 p-3 text-xs shadow gap-2 items-start">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <span>
                {hiddenCount} {hiddenCount === 1 ? "demanda está" : "demandas estão"} sem localização válida em João Pessoa.
              </span>
            </div>
          )}
          <MapContainer
            center={JOAO_PESSOA_CENTER}
            zoom={DEFAULT_ZOOM}
            style={{ width: "100%", height: "100%" }}
            zoomControl={true}
          >
            <MapViewportController
              points={points}
              hasNeighborhoodFilter={neighborhoodId !== "all"}
            />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {visibleDemands.map((demand) => (
                <Marker
                  key={demand.id}
                  position={[demand.lat, demand.lng]}
                  icon={createCustomIcon(demand.status, isPendingModeration(demand))}
                >
                  <Popup>
                    <div style={{ minWidth: 200 }} className="flex flex-col gap-2 p-1">
                      <div className="flex justify-between items-start gap-2">
                        <StatusBadge status={demand.status} pending={isPendingModeration(demand)} />
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDistanceToNow(new Date(demand.createdAt), { locale: ptBR, addSuffix: true })}
                        </span>
                      </div>
                      <Link
                        href={`/demandas/${demand.id}`}
                        className="font-semibold text-primary hover:underline text-sm leading-tight"
                        style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
                      >
                        {demand.title}
                      </Link>
                      {demand.address && (
                        <p className="text-xs text-muted-foreground truncate">{demand.address}</p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {demand.category && <CategoryIcon name={demand.category.icon} className="w-3 h-3" />}
                        <span className="truncate">{demand.category?.name}</span>
                        <span className="ml-auto font-medium text-primary">{demand.confirmationsCount} confirmações</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
            ))}
          </MapContainer>

          <Link href="/demandas/nova" className="fixed bottom-5 right-4 left-4 sm:left-auto z-[1000]">
            <Button size="lg" className="w-full sm:w-auto rounded-full shadow-xl font-bold gap-2 h-12">
              <Megaphone className="w-5 h-5" />
              Reportar problema
            </Button>
          </Link>
        </div>
      </div>
    </Layout>
  );
}