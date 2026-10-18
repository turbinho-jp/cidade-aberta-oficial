import { useRoute } from "wouter";
import { useGetUserProfile, getGetUserProfileQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Trophy, Calendar, Megaphone, ThumbsUp, MessageSquare } from "lucide-react";
import { DemandCard } from "@/components/demand-card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Profile() {
  const [, params] = useRoute("/perfil/:id");
  const userId = parseInt(params?.id || "0");

  const { data: profile, isLoading } = useGetUserProfile(userId, { query: { queryKey: getGetUserProfileQueryKey(userId), enabled: !!userId } });

  if (isLoading) return <Layout><div className="container mx-auto p-8"><Skeleton className="h-[400px]" /></div></Layout>;
  if (!profile) return <Layout><div className="container mx-auto p-8 text-center">Perfil não encontrado</div></Layout>;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        <div className="bg-card border rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center md:items-start gap-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          
          <Avatar className="w-32 h-32 border-4 border-background shadow-md">
            <AvatarImage src={profile.avatarUrl || undefined} />
            <AvatarFallback className="text-4xl bg-primary text-primary-foreground">{profile.name.substring(0,2).toUpperCase()}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <h1 className="text-3xl font-bold">{profile.name}</h1>
              <div className="flex items-center justify-center md:justify-start gap-2 text-muted-foreground mt-1">
                <span className="capitalize">{profile.role === 'citizen' ? 'Cidadão' : profile.role}</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> Membro desde {format(new Date(profile.createdAt), "MMM yyyy", { locale: ptBR })}
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
              <div className="bg-secondary/10 text-secondary-foreground px-4 py-2 rounded-xl flex items-center gap-2 border border-secondary/20">
                <Trophy className="w-5 h-5 text-secondary" />
                <span className="font-bold text-lg">{profile.points}</span>
                <span className="text-xs uppercase tracking-wider font-semibold">Pontos Civicos</span>
              </div>
              {profile.rankPosition && (
                <div className="bg-primary/10 text-primary px-4 py-2 rounded-xl font-bold border border-primary/20">
                  #{profile.rankPosition} no Ranking
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <Megaphone className="w-6 h-6 text-amber-500 mb-2" />
              <span className="text-2xl font-bold">{profile.demandsCount}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Demandas Criadas</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <ThumbsUp className="w-6 h-6 text-green-500 mb-2" />
              <span className="text-2xl font-bold">{profile.confirmationsCount}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Apoios</span>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <MessageSquare className="w-6 h-6 text-blue-500 mb-2" />
              <span className="text-2xl font-bold">{profile.commentsCount}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Comentários</span>
            </CardContent>
          </Card>
        </div>

        {profile.recentDemands && profile.recentDemands.length > 0 && (
          <div className="space-y-6 pt-8">
            <h2 className="text-2xl font-bold tracking-tight border-b pb-2">Demandas recentes</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {profile.recentDemands.map(demand => (
                <DemandCard key={demand.id} demand={demand} />
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}
