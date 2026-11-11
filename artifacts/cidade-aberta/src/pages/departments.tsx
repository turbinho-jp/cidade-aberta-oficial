import { useListDepartments } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, CheckCircle2, Clock, Info, Megaphone, Percent } from "lucide-react";
import { Link } from "wouter";

export default function Departments() {
  const { data: departments, isLoading } = useListDepartments();
  const hasData = !!departments?.some((d) => (d.demandsCount || 0) > 0);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Building2 className="w-8 h-8 text-primary" />
            Secretarias
          </h1>
          <p className="text-muted-foreground mt-2">
            Como cada área da prefeitura está respondendo às demandas dos cidadãos.
          </p>
        </div>

        {!isLoading && departments && departments.length > 0 && !hasData && (
          <div className="mb-6 rounded-xl border border-dashed bg-muted/20 p-6 flex gap-4 items-start">
            <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-foreground">Ainda não há histórico para comparar as secretarias</p>
              <p className="text-muted-foreground mt-1">
                Os indicadores de cada secretaria (demandas recebidas, taxa de resolução e tempo médio) aparecem aqui
                assim que as primeiras demandas forem encaminhadas e resolvidas. Até lá, você pode conhecer as áreas
                abaixo e acompanhar as demandas já publicadas.
              </p>
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))
          ) : departments?.map((dept) => (
            <Link key={dept.id} href={`/secretarias/${dept.id}`}>
              <Card className="hover-elevate cursor-pointer h-full border-border/50 transition-colors hover:border-primary/50 group">
                <CardHeader>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors">{dept.name}</CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{dept.description}</p>
                </CardHeader>
                <CardContent>
                  {(dept.demandsCount || 0) > 0 ? (
                    <>
                      <div className="grid grid-cols-4 gap-2 border-t pt-4">
                        <div className="flex flex-col items-center text-center">
                          <Megaphone className="w-5 h-5 text-amber-500 mb-1" />
                          <span className="text-xl font-bold">{dept.demandsCount}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Demandas</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <CheckCircle2 className="w-5 h-5 text-green-500 mb-1" />
                          <span className="text-xl font-bold">{dept.resolvedCount || 0}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Resolvidas</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <Percent className="w-5 h-5 text-primary mb-1" />
                          <span className="text-xl font-bold">{Math.round(((dept.resolvedCount || 0) / (dept.demandsCount || 1)) * 100)}%</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Resolução</span>
                        </div>
                        <div className="flex flex-col items-center text-center">
                          <Clock className="w-5 h-5 text-blue-500 mb-1" />
                          <span className="text-xl font-bold">{(dept.resolvedCount || 0) > 0 && dept.avgResolutionDays ? `${dept.avgResolutionDays.toFixed(0)} d` : "—"}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Tempo Médio</span>
                        </div>
                      </div>
                      <p className="text-sm text-primary font-medium mt-4">Ver detalhes da secretaria →</p>
                    </>
                  ) : (
                    <p className="border-t pt-4 text-sm text-muted-foreground">Sem histórico ainda: nenhuma demanda foi encaminhada a esta secretaria. Os indicadores aparecerão aqui quando houver as primeiras.</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}
