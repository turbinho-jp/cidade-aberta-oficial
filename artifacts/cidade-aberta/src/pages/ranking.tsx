import { useGetCitizenRanking } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Medal, Star } from "lucide-react";
import { Link } from "wouter";

export default function Ranking() {
  const { data: ranking, isLoading } = useGetCitizenRanking({ limit: 50 });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div className="text-center space-y-4 mb-12">
          <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
            <Trophy className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight">Ranking Cidadão</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Reconhecendo os membros mais ativos da comunidade na construção de uma cidade melhor.
          </p>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader className="bg-muted/30 border-b border-border">
            <CardTitle>Top Cidadãos</CardTitle>
            <CardDescription>Pontuação baseada em demandas criadas, apoios e contribuições.</CardDescription>
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
                {ranking.map((user, idx) => (
                  <Link key={user.userId} href={`/perfil/${user.userId}`} className="flex items-center p-4 sm:p-6 hover:bg-muted/50 transition-colors group">
                    <div className="w-12 text-center font-bold text-lg">
                      {idx === 0 ? <Medal className="w-8 h-8 text-amber-500 mx-auto" /> : 
                       idx === 1 ? <Medal className="w-8 h-8 text-slate-400 mx-auto" /> : 
                       idx === 2 ? <Medal className="w-8 h-8 text-orange-600 mx-auto" /> : 
                       <span className="text-muted-foreground group-hover:text-foreground transition-colors">#{idx + 1}</span>}
                    </div>
                    
                    <Avatar className="w-12 h-12 border-2 border-background shadow-sm ml-4 mr-4">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback>{user.name.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <div className="font-semibold text-foreground text-lg group-hover:text-primary transition-colors">{user.name}</div>
                      <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                        <span>{user.demandsCount} Demandas</span>
                        <span className="hidden sm:inline">•</span>
                        <span>{user.confirmationsCount} Apoios</span>
                      </div>
                    </div>
                    
                    <div className="text-right ml-4">
                      <div className="font-bold text-xl text-primary flex items-center gap-1 justify-end">
                        {user.points} <Star className="w-4 h-4 fill-primary" />
                      </div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mt-0.5">Pontos</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                Nenhum dado de ranking disponível.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
