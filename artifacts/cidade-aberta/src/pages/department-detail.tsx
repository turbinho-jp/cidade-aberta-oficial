import { Link, useRoute } from "wouter";
import { useGetDepartmentStats, getGetDepartmentStatsQueryKey, useListDepartments } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CheckCircle2, Clock, Megaphone, Activity, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DemandCard } from "@/components/demand-card";

export default function DepartmentDetail() {
  const [, params] = useRoute("/secretarias/:id");
  const deptId = parseInt(params?.id || "0");
  
  const { data: departments } = useListDepartments();
  const dept = departments?.find((d) => d.id === deptId);
  const { data: stats, isLoading } = useGetDepartmentStats(deptId, { query: { queryKey: getGetDepartmentStatsQueryKey(deptId), enabled: !!deptId } });

  if (isLoading) return <Layout><div className="container mx-auto p-8"><Skeleton className="h-[400px]" /></div></Layout>;
  if (!stats) return <Layout><div className="container mx-auto p-8">Secretaria não encontrada</div></Layout>;

  const hasHistory = stats.totalDemands > 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
        <div className="bg-card border rounded-2xl p-6 md:p-10 shadow-sm flex flex-col md:flex-row gap-8 items-start justify-between">
          <div className="space-y-4 max-w-2xl">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <Building2 className="w-8 h-8 text-primary" />
              {dept?.name ?? `Secretaria #${stats.departmentId}`}
            </h1>
            <p className="text-lg text-muted-foreground">
              {dept?.description || "Desempenho e indicadores desta secretaria no atendimento à população."}
            </p>
            <Link href={`/demandas?departmentId=${stats.departmentId}`}>
              <Button variant="outline" className="mt-2">Ver todas as demandas desta secretaria</Button>
            </Link>
          </div>
          
          {hasHistory && (
            <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-primary" />
              </div>
              <div>
                <div className="text-sm font-medium text-primary uppercase tracking-wider">Índice de Eficiência</div>
                <div className="text-2xl font-bold text-foreground">{stats.efficiencyIndex?.toFixed(1) || 0}/10</div>
              </div>
            </div>
          )}
        </div>

        {hasHistory ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Megaphone className="w-8 h-8 text-amber-500 mb-2" />
                <span className="text-3xl font-bold">{stats.totalDemands}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Total Recebido</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
                <span className="text-3xl font-bold">{stats.resolved}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Concluídas</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Activity className="w-8 h-8 text-cyan-500 mb-2" />
                <span className="text-3xl font-bold">{stats.inProgress}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Em Andamento</span>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 flex flex-col items-center text-center">
                <Clock className="w-8 h-8 text-blue-500 mb-2" />
                <span className="text-3xl font-bold">{stats.resolved > 0 && stats.avgResolutionDays ? stats.avgResolutionDays.toFixed(0) : '—'}</span>
                <span className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Dias p/ Resolver</span>
                {stats.resolved === 0 && <span className="text-[10px] text-muted-foreground mt-1">Nenhuma concluída ainda</span>}
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-muted/20 p-8 flex flex-col items-center text-center gap-3">
            <Info className="w-8 h-8 text-primary" />
            <h2 className="text-lg font-semibold">Ainda não há histórico para esta secretaria</h2>
            <p className="text-sm text-muted-foreground max-w-xl">
              Nenhuma demanda foi encaminhada a esta secretaria até agora, então ainda não há o que medir.
              Quando as primeiras demandas chegarem e forem resolvidas, os indicadores de volume,
              andamento e tempo de resolução aparecerão aqui.
            </p>
            <Link href="/demandas">
              <Button variant="outline" size="sm">Ver demandas da cidade</Button>
            </Link>
          </div>
        )}

        {stats.recentDemands && stats.recentDemands.length > 0 && (
          <div className="space-y-6 pt-8">
            <h2 className="text-2xl font-bold tracking-tight border-b pb-2">Demandas Recentes Encaminhadas</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.recentDemands.map(demand => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
