import { coverUrl } from "@/lib/attachments";
import { useListPublicWorks } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { HardHat, MapPin, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

export default function PublicWorks() {
  const { data: response, isLoading } = useListPublicWorks({});

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <HardHat className="w-8 h-8 text-primary" />
            Obras Públicas
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe o andamento das obras e melhorias em nossa cidade.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))
          ) : response?.length ? (
            response.map((work: any) => (
              <Card key={work.id} className="hover-elevate overflow-hidden flex flex-col">
                {coverUrl(work) && (
                  <div className="h-40 w-full overflow-hidden">
                    <img src={coverUrl(work)!} alt={work.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-3 flex-1">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={work.status === 'completed' ? 'default' : 'secondary'}>
                      {work.status === 'completed' ? 'Concluída' : 
                       work.status === 'in_progress' ? 'Em Andamento' :
                       work.status === 'planned' ? 'Planejada' : 'Suspensa'}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg leading-tight">{work.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-sm text-muted-foreground line-clamp-2">{work.description}</p>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs font-medium">
                      <span>Progresso</span>
                      <span>{work.progressPercent}%</span>
                    </div>
                    <Progress value={work.progressPercent} className="h-2" />
                  </div>

                  <div className="text-xs text-muted-foreground space-y-1">
                    {work.neighborhood && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        {work.neighborhood.name}
                      </div>
                    )}
                    {work.startDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Início: {format(new Date(work.startDate), "dd/MM/yyyy")}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-muted/20 border border-dashed rounded-xl">
              <HardHat className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Nenhuma obra registrada</h3>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
