import { useMemo, useState } from "react";
import { Link, useSearch } from "wouter";
import { useListDemands, useListCategories, useListNeighborhoods } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DemandCard } from "@/components/demand-card";
import { Search, Megaphone, Plus, AlertTriangle, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

const STALE_DAYS = 7;
const CRITICAL_DAYS = 15;

function getUnansweredDays(demand: { status: string; createdAt: string; publicResponse?: string | null }): number {
  if (!["open", "under_review"].includes(demand.status) || demand.publicResponse) return 0;
  const diffMs = Date.now() - new Date(demand.createdAt).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export default function DemandsList() {
  const { isAuthenticated } = useAuth();
  const urlParams = new URLSearchParams(useSearch());
  const departmentId = urlParams.get("departmentId");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [neighborhoodId, setNeighborhoodId] = useState<string>("all");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);

  const { data: demandsResponse, isLoading } = useListDemands({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    categoryId: categoryId !== "all" ? parseInt(categoryId) : undefined,
    neighborhoodId: neighborhoodId !== "all" ? parseInt(neighborhoodId) : undefined,
    departmentId: departmentId && !Number.isNaN(parseInt(departmentId)) ? parseInt(departmentId) : undefined,
    limit: 100,
  });

  const { data: categories } = useListCategories();
  const { data: neighborhoods } = useListNeighborhoods();

  const { displayedDemands, staleCount } = useMemo(() => {
    const all = demandsResponse?.demands ?? [];
    const stale = all.filter((d) => getUnansweredDays(d) >= STALE_DAYS);
    if (!onlyUnanswered) {
      return { displayedDemands: all, staleCount: stale.length };
    }
    const sorted = [...stale].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    return { displayedDemands: sorted, staleCount: stale.length };
  }, [demandsResponse, onlyUnanswered]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Demandas da Cidade</h1>
            <p className="text-muted-foreground mt-1">Explore os problemas reportados e apoie as causas do seu bairro.</p>
          </div>
          {isAuthenticated && (
            <Link href="/demandas/nova">
              <Button className="shrink-0 gap-2 font-semibold">
                <Plus className="w-4 h-4" /> Nova Demanda
              </Button>
            </Link>
          )}
        </div>

        {departmentId && (
          <div className="mb-4 flex items-center justify-between rounded-lg border bg-primary/5 px-4 py-2 text-sm">
            <span>Mostrando apenas as demandas de uma secretaria.</span>
            <Link href="/demandas" className="text-primary font-medium hover:underline">Limpar filtro</Link>
          </div>
        )}

        <div className="bg-card border rounded-lg p-4 mb-4 flex flex-col md:flex-row gap-4 items-center shadow-sm">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por título ou descrição..." 
              className="pl-9 bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="under_review">Em análise</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="closed">Fechado</SelectItem>
              </SelectContent>
            </Select>

            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {categories?.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
              <SelectTrigger className="w-full sm:w-[160px] bg-background">
                <SelectValue placeholder="Bairro" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bairros</SelectItem>
                {neighborhoods?.map(n => (
                  <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Radar de Cobrança: Demandas sem resposta */}
        {!isLoading && staleCount > 0 && (
          <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300/80 bg-amber-50/70 dark:bg-amber-950/25 dark:border-amber-800 px-4 py-3">
            <div className="flex items-center gap-2.5 text-sm">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                <strong>Radar de Cobrança:</strong>{" "}
                {staleCount === 1
                  ? "1 demanda está há mais de 7 dias sem resposta."
                  : `${staleCount} demandas estão há mais de 7 dias sem resposta.`}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              variant={onlyUnanswered ? "default" : "outline"}
              className="shrink-0"
              onClick={() => setOnlyUnanswered((v) => !v)}
            >
              {onlyUnanswered ? "Mostrar todas" : "Filtrar sem resposta"}
            </Button>
          </div>
        )}

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[300px] rounded-xl" />
            ))}
          </div>
        ) : displayedDemands.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayedDemands.map(demand => {
              const days = getUnansweredDays(demand);
              const isCritical = days >= CRITICAL_DAYS;
              const isStale = days >= STALE_DAYS;
              return (
                <div key={demand.id} className="flex flex-col">
                  {isStale && (
                    <Link
                      href={`/demandas/${demand.id}`}
                      className={`mb-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center justify-between border ${
                        isCritical
                          ? "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800"
                          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                      }`}
                    >
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        {isCritical ? "Crítica · " : ""}Sem resposta há {days} dias
                      </span>
                      <span>Cobrar →</span>
                    </Link>
                  )}
                  <div className="flex-1">
                    <DemandCard demand={demand} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-muted/20 border border-dashed rounded-xl">
            <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium text-foreground">Nenhuma demanda encontrada</h3>
            <p className="text-muted-foreground mt-1">Tente ajustar seus filtros ou buscar por outros termos.</p>
          </div>
        )}
      </div>
    </Layout>
  );
}