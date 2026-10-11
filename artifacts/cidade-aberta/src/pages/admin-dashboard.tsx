import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListDemands, useUpdateDemandStatus } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { Loader2, Settings, Shield } from "lucide-react";
import { DemandStatus } from "@workspace/api-client-react";

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { user, isAuthenticated, isAdmin, isSecretary, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("open");
  const { data: demandsResponse, isLoading: loadingDemands } = useListDemands({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 50,
  });

  const updateStatusMutation = useUpdateDemandStatus();

  // Role guard
  if (!authLoading && (!isAuthenticated || (!isAdmin && !isSecretary))) {
    setLocation("/");
    return null;
  }

  const handleUpdateStatus = (id: number, newStatus: string) => {
    updateStatusMutation.mutate({ 
      id, 
      data: { status: newStatus as DemandStatus } 
    }, {
      onSuccess: () => {
        toast({ title: "Status atualizado", description: "O status da demanda foi alterado." });
        queryClient.invalidateQueries({ queryKey: ["/api/demands"] });
      }
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Shield className="w-8 h-8 text-primary" />
              Painel de Gestão
            </h1>
            <p className="text-muted-foreground mt-2">Triagem e atualização de demandas da cidade.</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="open">Abertos</SelectItem>
                <SelectItem value="under_review">Em Análise</SelectItem>
                <SelectItem value="approved">Aprovados</SelectItem>
                <SelectItem value="in_progress">Em Andamento</SelectItem>
                <SelectItem value="completed">Concluídos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle>Fila de Triagem</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingDemands ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : demandsResponse?.demands?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">ID</th>
                      <th className="px-6 py-3 font-semibold">Título</th>
                      <th className="px-6 py-3 font-semibold">Bairro</th>
                      <th className="px-6 py-3 font-semibold text-center">Apoios</th>
                      <th className="px-6 py-3 font-semibold">Status Atual</th>
                      <th className="px-6 py-3 font-semibold text-right">Ação Rápida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {demandsResponse.demands.map(demand => (
                      <tr key={demand.id} className="hover:bg-muted/20">
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">#{demand.id}</td>
                        <td className="px-6 py-4 font-medium max-w-[300px] truncate">{demand.title}</td>
                        <td className="px-6 py-4">{demand.neighborhood?.name}</td>
                        <td className="px-6 py-4 text-center font-semibold text-primary">{demand.confirmationsCount}</td>
                        <td className="px-6 py-4">
                          <StatusBadge status={demand.status} className="scale-90 origin-left" />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Select 
                            value={demand.status} 
                            onValueChange={(val) => handleUpdateStatus(demand.id, val)}
                          >
                            <SelectTrigger className="w-[140px] ml-auto h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="open">Aberto</SelectItem>
                              <SelectItem value="under_review">Em Análise</SelectItem>
                              <SelectItem value="approved">Aprovado</SelectItem>
                              <SelectItem value="in_progress">Em Andamento</SelectItem>
                              <SelectItem value="completed">Concluído</SelectItem>
                              <SelectItem value="rejected">Rejeitado</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                Nenhuma demanda na fila para os filtros selecionados.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
