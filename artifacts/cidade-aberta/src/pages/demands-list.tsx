import { useState } from "react";
import { Link } from "wouter";
import { useListDemands, useListCategories, useListNeighborhoods } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DemandCard } from "@/components/demand-card";
import { Search, Loader2, Megaphone, Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/lib/auth";

export default function DemandsList() {
  const { isAuthenticated } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [categoryId, setCategoryId] = useState<string>("all");
  const [neighborhoodId, setNeighborhoodId] = useState<string>("all");

  const { data: demandsResponse, isLoading } = useListDemands({
    search: search || undefined,
    status: status !== "all" ? status : undefined,
    categoryId: categoryId !== "all" ? parseInt(categoryId) : undefined,
    neighborhoodId: neighborhoodId !== "all" ? parseInt(neighborhoodId) : undefined,
    limit: 50,
  });

  const { data: categories } = useListCategories();
  const { data: neighborhoods } = useListNeighborhoods();

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

        <div className="bg-card border rounded-lg p-4 mb-8 flex flex-col md:flex-row gap-4 items-center shadow-sm">
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
              <SelectTrigger className="w-full sm:w-[150px] bg-background">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="open">Aberto</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
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

        {isLoading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-[300px] rounded-xl" />
            ))}
          </div>
        ) : demandsResponse?.demands.length ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {demandsResponse.demands.map(demand => (
              <DemandCard key={demand.id} demand={demand} />
            ))}
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
