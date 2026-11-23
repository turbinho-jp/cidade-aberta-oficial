import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useListDemands,
  useListCategories,
  useListNeighborhoods,
  useListPublicWorks,
  DemandStatus,
} from "@workspace/api-client-react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge, isPendingModeration } from "@/components/status-badge";
import { CategoryIcon } from "@/components/category-icon";
import {
  Search,
  Loader2,
  MapPin,
  AlertTriangle,
  Megaphone,
  SlidersHorizontal,
  X,
  HardHat,
  Bell,
} from "lucide-react";
import { JOAO_PESSOA_CENTER, DEFAULT_ZOOM, isInsideServiceArea } from "@/lib/geo";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const createDemandIcon = (status: string, pending = false) => {
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

const createWorkIcon = () => {
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" fill="#1d4ed8" stroke="white" stroke-width="1.5">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z"/>
    <circle cx="14" cy="14" r="7.5" fill="white"/>
    <path d="M9.5 15.5h9M10.5 15.5a3.5 3.5 0 0 1 7 0M14 10.5v2" stroke="#1d4ed8" stroke-width="1.6" stroke-linecap="round" fill="none"/>
  </svg>`;

  return L.divIcon({
    className: "",
    html: svgIcon,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -44],
  });
};

const createAnnouncementIcon = () => {
  const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 40" fill="#7c3aed" stroke="white" stroke-width="1.5">
    <path d="M14 0C6.3 0 0 6.3 0 14c0 10.5 14 26 14 26s14-15.5 14-26C28 6.3 21.7 0 14 0z"/>
    <circle cx="14" cy="14" r="7.5" fill="white"/>
    <path d="M14 9.5a3 3 0 0 1 3 3v2l1 1v.5h-8v-.5l1-1v-2a3 3 0 0 1 3-3zM12.8 17.5a1.3 1.3 0 0 0 2.4 0" stroke="#7c3aed" stroke-width="1.5" stroke-linecap="round" fill="none"/>
  </svg>`;

  return L.divIcon({
    className: "",
    html: svgIcon,
    iconSize: [30, 42],
    iconAnchor: [15, 42],
    popupAnchor: [0, -44],
  });
};

type MapAnnouncement = {
  id: number;
  title: string;
  body?: string;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  neighborhoodId?: number | null;
  createdAt?: string;
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

  // Camadas ativas no mapa
  const [showDemands, setShowDemands] = useState(true);
  const [showWorks, setShowWorks] = useState(true);
  const [showAnnouncements, setShowAnnouncements] = useState(true);

  const [announcements, setAnnouncements] = useState<MapAnnouncement[]>([]);

  const activeExtraFiltersCount = (status !== "all" ? 1 : 0) + (categoryId !== "all" ? 1 : 0);

  const { data: demandsResponse, isLoading: loadingDemands } = useListDemands({
    search: search || undefined,
    status: status !== "all" ? (status as DemandStatus) : undefined,
    categoryId: categoryId !== "all" ? parseInt(categoryId) : undefined,
    neighborhoodId: neighborhoodId !== "all" ? parseInt(neighborhoodId) : undefined,
    limit: 500,
  });

  const { data: worksResponse } = useListPublicWorks({});
  const { data: categories } = useListCategories();
  const { data: neighborhoods } = useListNeighborhoods();

  // Carrega avisos ativos para exibir os que tiverem geolocalização
  useEffect(() => {
    let cancelled = false;
    fetch("/api/announcements", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        const list = Array.isArray(data) ? data : Array.isArray(data.announcements) ? data.announcements : [];
        setAnnouncements(list);
      })
      .catch(() => {
        // Silencioso caso a rota não retorne dados
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedNeighborhoodName = useMemo(() => {
    if (neighborhoodId === "all") return null;
    return neighborhoods?.find((n) => n.id.toString() === neighborhoodId)?.name ?? null;
  }, [neighborhoodId, neighborhoods]);

  const { visibleDemands, hiddenCount, stats } = useMemo(() => {
    const all = demandsResponse?.demands ?? [];
    const visible = all.filter((d) => d.lat != null && d.lng != null && isInsideServiceArea(d.lat, d.lng));
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
    };
  }, [demandsResponse?.demands]);

  const visibleWorks = useMemo(() => {
    const all = Array.isArray(worksResponse) ? worksResponse : [];
    return all.filter((w: any) => {
      if (w.lat == null || w.lng == null || !isInsideServiceArea(w.lat, w.lng)) return false;
      if (neighborhoodId !== "all" && w.neighborhoodId?.toString() !== neighborhoodId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = w.title?.toLowerCase().includes(q);
        const matchDesc = w.description?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc) return false;
      }
      return true;
    });
  }, [worksResponse, neighborhoodId, search]);

  const visibleAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      if (a.lat == null || a.lng == null || !isInsideServiceArea(a.lat, a.lng)) return false;
      if (neighborhoodId !== "all" && a.neighborhoodId?.toString() !== neighborhoodId) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = a.title?.toLowerCase().includes(q);
        const matchBody = a.body?.toLowerCase().includes(q);
        if (!matchTitle && !matchBody) return false;
      }
      return true;
    });
  }, [announcements, neighborhoodId, search]);

  const allPoints = useMemo(() => {
    const pts: Array<[number, number]> = [];
    if (showDemands) {
      for (const d of visibleDemands) pts.push([d.lat, d.lng]);
    }
    if (showWorks) {
      for (const w of visibleWorks as any[]) pts.push([w.lat, w.lng]);
    }
    if (showAnnouncements) {
      for (const a of visibleAnnouncements) {
        if (a.lat != null && a.lng != null) pts.push([a.lat, a.lng]);
      }
    }
    return pts;
  }, [showDemands, showWorks, showAnnouncements, visibleDemands, visibleWorks, visibleAnnouncements]);

  const workIcon = useMemo(() => createWorkIcon(), []);
  const announcementIcon = useMemo(() => createAnnouncementIcon(), []);

  return (
    <Layout>
      <div className="flex flex-col h-[calc(100dvh-64px)]">
        {/* Barra de filtros compacta no mobile e completa no desktop */}
        <div className="z-20 bg-card border-b px-3 py-2.5 sm:p-4 shadow-sm flex flex-col lg:flex-row gap-2.5 lg:gap-4 lg:items-center lg:justify-between flex-shrink-0">
          <div className="hidden lg:flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold">Mapa da Cidade</h1>
          </div>

          {/* Linha principal: Bairro + Botão Filtros no mobile */}
          <div className="flex items-center gap-2 w-full lg:w-auto">
            <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
              <SelectTrigger className="flex-1 lg:w-[180px] h-9 text-sm">
                <SelectValue placeholder="Bairro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bairros</SelectItem>
                {neighborhoods?.map((n) => (
                  <SelectItem key={n.id} value={n.id.toString()}>
                    {n.name}
                  </SelectItem>
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
                placeholder="Buscar no mapa..."
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
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative z-10 min-h-0">
          {/* Painel flutuante superior: Resumo + Camadas alternáveis */}
          {!loadingDemands && (
            <div className="absolute top-3 left-14 right-3 sm:right-auto z-[1000] flex flex-col gap-1.5">
              {/* Resumo numérico */}
              <div className="rounded-xl border bg-card/95 backdrop-blur-sm px-3 py-2 shadow-md flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs">
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

              {/* Botões de camadas do mapa */}
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowDemands((v) => !v)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm border transition flex items-center gap-1.5 ${
                    showDemands
                      ? "bg-amber-500 text-white border-amber-600"
                      : "bg-card/95 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  <MapPin className="w-3 h-3" />
                  Demandas ({visibleDemands.length})
                </button>

                <button
                  type="button"
                  onClick={() => setShowWorks((v) => !v)}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm border transition flex items-center gap-1.5 ${
                    showWorks
                      ? "bg-blue-700 text-white border-blue-800"
                      : "bg-card/95 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  <HardHat className="w-3 h-3" />
                  Obras ({visibleWorks.length})
                </button>

                {visibleAnnouncements.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAnnouncements((v) => !v)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm border transition flex items-center gap-1.5 ${
                      showAnnouncements
                        ? "bg-violet-600 text-white border-violet-700"
                        : "bg-card/95 text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    <Bell className="w-3 h-3" />
                    Avisos ({visibleAnnouncements.length})
                  </button>
                )}
              </div>
            </div>
          )}

          {loadingDemands && (
            <div className="absolute inset-0 z-[1000] bg-background/50 flex items-center justify-center backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="font-medium text-primary">Carregando mapa...</p>
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
            <MapViewportController points={allPoints} hasNeighborhoodFilter={neighborhoodId !== "all"} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {/* Camada: Demandas */}
            {showDemands &&
              visibleDemands.map((demand) => (
                <Marker
                  key={`demand-${demand.id}`}
                  position={[demand.lat, demand.lng]}
                  icon={createDemandIcon(demand.status, isPendingModeration(demand))}
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
                      {demand.address && <p className="text-xs text-muted-foreground truncate">{demand.address}</p>}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        {demand.category && <CategoryIcon name={demand.category.icon} className="w-3 h-3" />}
                        <span className="truncate">{demand.category?.name}</span>
                        <span className="ml-auto font-medium text-primary">{demand.confirmationsCount} confirmações</span>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Camada: Obras Públicas */}
            {showWorks &&
              visibleWorks.map((work: any) => (
                <Marker key={`work-${work.id}`} position={[work.lat, work.lng]} icon={workIcon}>
                  <Popup>
                    <div style={{ minWidth: 210 }} className="flex flex-col gap-2 p-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 px-2 py-0.5 text-[10px] font-bold">
                          <HardHat className="w-3 h-3" /> Obra Pública
                        </span>
                        <span className="text-[10px] font-semibold text-muted-foreground">
                          {work.status === "completed"
                            ? "Concluída"
                            : work.status === "in_progress"
                              ? "Em andamento"
                              : work.status === "planned"
                                ? "Planejada"
                                : "Suspensa"}
                        </span>
                      </div>
                      <Link href="/obras" className="font-semibold text-blue-700 hover:underline text-sm leading-tight">
                        {work.title}
                      </Link>
                      {work.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{work.description}</p>
                      )}
                      {typeof work.progressPercent === "number" && (
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] font-medium">
                            <span>Execução</span>
                            <span>{work.progressPercent}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-600 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, work.progressPercent))}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}

            {/* Camada: Avisos */}
            {showAnnouncements &&
              visibleAnnouncements.map((ann) => (
                <Marker key={`ann-${ann.id}`} position={[ann.lat!, ann.lng!]} icon={announcementIcon}>
                  <Popup>
                    <div style={{ minWidth: 200 }} className="flex flex-col gap-2 p-1">
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 text-violet-800 px-2 py-0.5 text-[10px] font-bold w-fit">
                        <Bell className="w-3 h-3" /> Aviso Comunitário
                      </span>
                      <Link href="/avisos" className="font-semibold text-violet-700 hover:underline text-sm leading-tight">
                        {ann.title}
                      </Link>
                      {ann.body && <p className="text-xs text-muted-foreground line-clamp-2">{ann.body}</p>}
                      {ann.address && <p className="text-[11px] text-muted-foreground truncate">{ann.address}</p>}
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