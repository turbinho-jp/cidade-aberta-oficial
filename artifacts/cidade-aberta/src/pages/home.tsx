import { Link } from "wouter";
import { ArrowRight, CheckCircle2, Megaphone, Users, Activity, BarChart2 } from "lucide-react";
import { useGetDashboardSummary, useGetTopDemands, useGetRecentActivity, useListCategories } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { DemandCard } from "@/components/demand-card";
import { CategoryIcon } from "@/components/category-icon";
import { Card, CardContent } from "@/components/ui/card";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

export default function Home() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: topDemands, isLoading: loadingTop } = useGetTopDemands();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 5 });
  const { data: categories } = useListCategories();

  return (
    <div className="flex flex-col w-full">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-primary text-primary-foreground py-24 md:py-32">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&q=80&w=2000')] opacity-10 bg-cover bg-center" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-tight">
              A cidade que você quer começa com a sua voz.
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/80 max-w-2xl">
              Reporte problemas, apoie demandas de vizinhos e acompanhe as obras públicas em tempo real. Participe ativamente da melhoria do seu bairro.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <Link href="/demandas/nova">
                <Button size="lg" variant="secondary" className="font-semibold px-8 text-base">
                  <Megaphone className="mr-2 w-5 h-5" />
                  Reportar Problema
                </Button>
              </Link>
              <Link href="/mapa">
                <Button size="lg" variant="outline" className="font-semibold px-8 text-base bg-transparent border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary">
                  Explorar Mapa
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Ribbon */}
      <section className="border-b bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-border/50">
            {[
              { label: "Cidadãos Ativos", value: summary?.totalCitizens || 0, icon: Users },
              { label: "Demandas Abertas", value: summary?.totalDemands || 0, icon: Megaphone },
              { label: "Problemas Resolvidos", value: summary?.resolvedDemands || 0, icon: CheckCircle2 },
              { label: "Apoios Registrados", value: summary?.totalConfirmations || 0, icon: Activity },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center text-center px-4">
                <stat.icon className="w-8 h-8 text-primary mb-3 opacity-80" />
                {loadingSummary ? (
                  <Skeleton className="h-10 w-24 mb-1" />
                ) : (
                  <span className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">{stat.value.toLocaleString('pt-BR')}</span>
                )}
                <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16 grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content - Left Column */}
        <div className="lg:col-span-2 space-y-16">
          {/* Top Demands */}
          <section className="space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Demandas em Destaque</h2>
                <p className="text-muted-foreground mt-1">Os problemas com maior apoio na cidade neste momento.</p>
              </div>
              <Link href="/demandas">
                <Button variant="ghost" className="hidden sm:flex group">
                  Ver todas <ArrowRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-6">
              {loadingTop ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-[300px] rounded-xl" />
                ))
              ) : topDemands?.length ? (
                topDemands.map(demand => (
                  <DemandCard key={demand.id} demand={demand} />
                ))
              ) : (
                <div className="col-span-2 text-center py-12 bg-muted/20 rounded-xl border border-dashed">
                  <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <p className="text-muted-foreground">Nenhuma demanda registrada ainda.</p>
                </div>
              )}
            </div>
            
            <Link href="/demandas" className="sm:hidden block">
              <Button variant="outline" className="w-full">Ver todas as demandas</Button>
            </Link>
          </section>

          {/* Quick Categories */}
          <section className="space-y-6">
            <h2 className="text-2xl font-bold tracking-tight">O que você precisa reportar?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {categories?.slice(0, 8).map(category => (
                <Link key={category.id} href={`/demandas/nova?category=${category.id}`}>
                  <Card className="hover-elevate cursor-pointer border-border/50 bg-muted/10 transition-colors hover:bg-muted/30 h-full">
                    <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                      <div 
                        className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-sm"
                        style={{ backgroundColor: category.color }}
                      >
                        <CategoryIcon name={category.icon} className="w-6 h-6" />
                      </div>
                      <span className="font-medium text-sm">{category.name}</span>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar - Right Column */}
        <div className="space-y-8">
          <section className="bg-card border rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Atividade Recente
            </h3>
            
            <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-border/50">
              {loadingActivity ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-16 w-full" /></div>
                ))
              ) : recentActivity?.length ? (
                recentActivity.map(event => (
                  <div key={event.id} className="relative flex gap-4 pl-10">
                    <div className="absolute left-0 w-6 h-6 rounded-full bg-background border-2 border-primary z-10 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium text-foreground">{event.actorName || 'Cidadão'}</span>{' '}
                        <span className="text-muted-foreground">{event.description}</span>
                      </p>
                      {event.demandTitle && (
                        <Link href={`/demandas/${event.demandId}`} className="text-sm font-medium text-primary hover:underline line-clamp-1 mt-1">
                          "{event.demandTitle}"
                        </Link>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(event.createdAt), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground text-sm pl-4">Nenhuma atividade recente.</p>
              )}
            </div>
          </section>

          <section className="bg-secondary/10 border border-secondary/20 rounded-2xl p-6 relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-lg font-bold text-secondary-foreground mb-2 flex items-center gap-2">
                <BarChart2 className="w-5 h-5" />
                Transparência
              </h3>
              <p className="text-sm text-secondary-foreground/80 mb-6">
                Acompanhe os indicadores de resolução, desempenho por secretaria e ranking de bairros.
              </p>
              <Link href="/painel">
                <Button className="w-full font-semibold" variant="secondary">
                  Acessar Painel
                </Button>
              </Link>
            </div>
            <BarChart2 className="w-32 h-32 text-secondary/20 absolute -right-6 -bottom-6" />
          </section>
        </div>
      </div>
    </div>
  );
}
