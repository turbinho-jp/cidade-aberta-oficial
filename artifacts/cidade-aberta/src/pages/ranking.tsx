import { useState } from "react";
import { useGetCitizenRanking, useListNeighborhoods } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trophy, Medal, Star, Crown } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { LevelBadge, LevelProgressBar } from "@/components/level-badge";
import { getLevelProgress, HOW_TO_EARN, LEVELS } from "@/lib/gamification";

type Period = "month" | "all";

export default function Ranking() {
  const [period, setPeriod] = useState<Period>("month");
  const [neighborhoodId, setNeighborhoodId] = useState("all");
  const { user, isAuthenticated } = useAuth();
  const { data: neighborhoods } = useListNeighborhoods();
  const { data: ranking, isLoading } = useGetCitizenRanking({
    limit: 50,
    period: period === "month" ? "month" : undefined,
    neighborhoodId: neighborhoodId !== "all" ? parseInt(neighborhoodId) : undefined,
  });

  const neighborhoodName = neighborhoods?.find(n => String(n.id) === neighborhoodId)?.name;
  const mayorTitle = neighborhoodName ? `Prefeito do ${neighborhoodName}` : "Prefeito da Cidade";
  const isCitizen = user && user.role === "citizen";
  const myLevel = isCitizen ? getLevelProgress(user.points) : null;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div className="text-center space-y-4 mb-8">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Ranking Cidadão</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Quem mais ajuda a cidade a funcionar. O título de Prefeito é de quem lidera o mês.
          </p>
        </div>

        {isCitizen && myLevel && (
          <Card className="border-primary/30">
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-3">
                  <LevelBadge points={user.points} />
                  <span className="text-sm text-muted-foreground">Sua patente</span>
                </div>
                <div className="font-bold text-lg text-primary flex items-center gap-1">
                  {user.points} <Star className="w-4 h-4 fill-primary" /> <span className="text-xs text-muted-foreground font-medium uppercase">pts</span>
                </div>
              </div>
              <LevelProgressBar points={user.points} />
            </CardContent>
          </Card>
        )}

        <Card className="border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border space-y-4">
            <div>
              <CardTitle>{period === "month" ? "Top do mês" : "Top de todos os tempos"}</CardTitle>
              <CardDescription>
                {neighborhoodName ? `Pontos ganhos em demandas de ${neighborhoodName}.` : "Pontos por demandas publicadas, apoios, comentários e problemas resolvidos."}
              </CardDescription>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <TabsList>
                  <TabsTrigger value="month">Este mês</TabsTrigger>
                  <TabsTrigger value="all">Geral</TabsTrigger>
                </TabsList>
              </Tabs>
              <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
                <SelectTrigger className="w-full sm:w-[220px] bg-background" aria-label="Filtrar por bairro">
                  <SelectValue placeholder="Toda a cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toda a cidade</SelectItem>
                  {neighborhoods?.map(n => (
                    <SelectItem key={n.id} value={String(n.id)}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : ranking?.length ? (
              <div className="divide-y divide-border">
                {ranking.map((item, idx) => (
                  <Link key={item.userId} href={`/perfil/${item.userId}`} className="flex items-center p-4 sm:p-6 hover:bg-muted/50 transition-colors group">
                    <div className="w-12 text-center font-bold text-lg">
                      {idx === 0 ? <Medal className="w-8 h-8 text-amber-500 mx-auto" /> :
                       idx === 1 ? <Medal className="w-8 h-8 text-slate-400 mx-auto" /> :
                       idx === 2 ? <Medal className="w-8 h-8 text-orange-600 mx-auto" /> :
                       <span className="text-muted-foreground group-hover:text-foreground transition-colors">#{idx + 1}</span>}
                    </div>

                    <Avatar className="w-12 h-12 border-2 border-background shadow-sm ml-4 mr-4">
                      <AvatarImage src={item.avatarUrl || undefined} />
                      <AvatarFallback>{item.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors truncate">{item.name}</span>
                        {period === "month" && idx === 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-300 rounded-full px-2 py-0.5">
                            <Crown className="w-3 h-3" aria-hidden /> {mayorTitle}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        {/* A patente usa o total acumulado; em visão mensal/por bairro `points` é parcial. */}
                        {period === "all" && neighborhoodId === "all" && <LevelBadge points={item.points} />}
                        <span>{item.demandsCount} Demandas</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{item.confirmationsCount} Apoios</span>
                      </div>
                    </div>

                    <div className="text-right ml-4">
                      <div className="font-bold text-xl text-primary flex items-center gap-1 justify-end">
                        {item.points} <Star className="w-4 h-4 fill-primary" />
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-0.5">Pontos</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                {period === "month"
                  ? "Ninguém pontuou neste mês ainda. Reporte ou apoie uma demanda para abrir o ranking."
                  : "Nenhum dado de ranking disponível."}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Como ganhar pontos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {HOW_TO_EARN.map(r => (
                <div key={r.label} className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <div>{r.label}</div>
                    {r.note && <div className="text-xs text-muted-foreground">{r.note}</div>}
                  </div>
                  <span className="font-bold text-primary whitespace-nowrap">+{r.points}</span>
                </div>
              ))}
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Pontos só contam depois que a demanda é aprovada pela moderação. Apoiar a própria demanda não pontua.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Patentes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {LEVELS.map(l => {
                const Icon = l.icon;
                return (
                  <div key={l.id} className="flex items-center justify-between gap-4 text-sm">
                    <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${l.color}`}>
                      <Icon className="w-3.5 h-3.5" aria-hidden /> {l.name}
                    </span>
                    <span className="text-muted-foreground whitespace-nowrap">{l.min === 0 ? "a partir de 0" : `${l.min}+ pts`}</span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}
