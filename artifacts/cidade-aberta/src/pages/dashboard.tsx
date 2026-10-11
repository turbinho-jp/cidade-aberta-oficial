import { useState, useMemo, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useGetDashboardSummary, useGetDemandsByNeighborhood, useGetDemandsByCategory, useGetRecentActivity, useGetCitizenRanking } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, AreaChart, Area } from "recharts";
import { Activity, Users, CheckCircle2, Megaphone, Map as MapIcon, ArrowUpRight, Trophy, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const COLORS = ['#10b981', '#f59e0b', '#06b6d4', '#8b5cf6', '#ef4444', '#f97316', '#3b82f6'];

export default function Dashboard() {
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();
  const { data: byNeighborhood, isLoading: loadingNeighborhoods } = useGetDemandsByNeighborhood();
  const { data: byCategory, isLoading: loadingCategories } = useGetDemandsByCategory();
  const { data: recentActivity, isLoading: loadingActivity } = useGetRecentActivity({ limit: 10 });
  const { data: ranking, isLoading: loadingRanking } = useGetCitizenRanking({ limit: 5 });

  const pieData = useMemo(() => {
    if (!byCategory) return [];
    return byCategory.map(item => ({
      name: item.categoryName,
      value: item.totalDemands,
      color: item.categoryColor || COLORS[Math.floor(Math.random() * COLORS.length)]
    }));
  }, [byCategory]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Painel de Transparência</h1>
          <p className="text-muted-foreground mt-1">Acompanhe os dados da nossa cidade em tempo real.</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Resolução</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold">{summary?.resolutionRate?.toFixed(1) || 0}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Das demandas concluídas</p>
                </>
              )}
            </CardContent>
          </Card>
          
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tempo Médio</CardTitle>
              <Clock className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold">{summary?.avgResolutionDays?.toFixed(0) || 0} dias</div>
                  <p className="text-xs text-muted-foreground mt-1">Para resolução final</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Demandas Abertas</CardTitle>
              <Megaphone className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold">{summary?.openDemands || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Aguardando análise</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Cidadãos Ativos</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              {loadingSummary ? <Skeleton className="h-8 w-20" /> : (
                <>
                  <div className="text-2xl font-bold">{summary?.totalCitizens || 0}</div>
                  <p className="text-xs text-muted-foreground mt-1">Registrados na plataforma</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Charts */}
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Demandas por Bairro</CardTitle>
                <CardDescription>Volume total e taxa de resolução</CardDescription>
              </CardHeader>
              <CardContent className="pl-0">
                {loadingNeighborhoods ? (
                  <Skeleton className="h-[300px] w-full ml-4" />
                ) : (
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={byNeighborhood?.slice(0, 10)} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <XAxis dataKey="neighborhoodName" tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                        <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{fill: 'rgba(0,0,0,0.05)'}}
                          contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="totalDemands" name="Total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="resolved" name="Resolvidos" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid sm:grid-cols-2 gap-8">
              <Card>
                <CardHeader>
                  <CardTitle>Por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="flex justify-center">
                  {loadingCategories ? (
                    <Skeleton className="h-[250px] w-[250px] rounded-full" />
                  ) : (
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {pieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Ranking Cidadão</CardTitle>
                  <CardDescription>Usuários mais engajados</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {loadingRanking ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3"><Skeleton className="w-8 h-8 rounded-full" /><Skeleton className="h-4 flex-1" /></div>
                      ))
                    ) : ranking?.map((user, idx) => (
                      <Link key={user.userId} href={`/perfil/${user.userId}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${idx === 0 ? 'bg-amber-100 text-amber-700' : idx === 1 ? 'bg-slate-200 text-slate-700' : idx === 2 ? 'bg-orange-100 text-orange-800' : 'bg-muted text-muted-foreground'}`}>
                            {idx + 1}
                          </div>
                          <Avatar className="w-8 h-8">
                            <AvatarImage src={user.avatarUrl || undefined} />
                            <AvatarFallback>{user.name.substring(0,2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-sm">{user.name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-sm font-semibold text-primary">
                          {user.points} <span className="text-xs text-muted-foreground font-normal">pts</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  Feed de Atividade
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-border/50">
                  {loadingActivity ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex gap-4"><Skeleton className="h-6 w-6 rounded-full" /><Skeleton className="h-16 w-full" /></div>
                    ))
                  ) : recentActivity?.map(event => (
                    <div key={event.id} className="relative flex gap-4 pl-8">
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
                          {new Date(event.createdAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
