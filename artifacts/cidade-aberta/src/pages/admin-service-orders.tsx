import { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useListServiceOrders, useUpdateServiceOrder } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Loader2, HardHat } from "lucide-react";
import { ServiceOrderUpdateStatus } from "@workspace/api-client-react";

export default function AdminServiceOrders() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isAdmin, isSecretary, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { data: osResponse, isLoading } = useListServiceOrders({
    status: statusFilter !== "all" ? statusFilter : undefined,
    limit: 50,
  });

  const updateOSMutation = useUpdateServiceOrder();

  // Role guard
  if (!authLoading && (!isAuthenticated || (!isAdmin && !isSecretary))) {
    setLocation("/");
    return null;
  }

  const handleUpdateStatus = (id: number, newStatus: string) => {
    updateOSMutation.mutate({ 
      id, 
      data: { status: newStatus as ServiceOrderUpdateStatus } 
    }, {
      onSuccess: () => {
        toast({ title: "OS Atualizada" });
        queryClient.invalidateQueries({ queryKey: ["/api/service-orders"] });
      }
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <HardHat className="w-8 h-8 text-secondary" />
              Ordens de Serviço
            </h1>
            <p className="text-muted-foreground mt-2">Gestão de equipes e execução de campo.</p>
          </div>
          <div className="flex items-center gap-4">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] bg-background">
                <SelectValue placeholder="Filtrar por Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as OS</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="assigned">Atribuídas</SelectItem>
                <SelectItem value="in_progress">Em Execução</SelectItem>
                <SelectItem value="completed">Concluídas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle>Controle Operacional</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : osResponse?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-muted/50 text-muted-foreground">
                    <tr>
                      <th className="px-6 py-3 font-semibold">OS #</th>
                      <th className="px-6 py-3 font-semibold">Demanda Ref.</th>
                      <th className="px-6 py-3 font-semibold">Equipe</th>
                      <th className="px-6 py-3 font-semibold">Prioridade</th>
                      <th className="px-6 py-3 font-semibold">Status</th>
                      <th className="px-6 py-3 font-semibold text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {osResponse.map(os => (
                      <tr key={os.id} className="hover:bg-muted/20">
                        <td className="px-6 py-4 font-mono font-bold text-xs">{os.id}</td>
                        <td className="px-6 py-4 max-w-[200px] truncate text-xs text-muted-foreground">
                          {os.demand?.title || `Demanda #${os.demandId}`}
                        </td>
                        <td className="px-6 py-4 font-medium">{os.team?.name || '-'}</td>
                        <td className="px-6 py-4">
                          <span className={`text-xs uppercase font-bold ${
                            os.priority === 'urgent' ? 'text-red-500' : 'text-muted-foreground'
                          }`}>
                            {os.priority}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={os.status} className="scale-90 origin-left" />
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Select 
                            value={os.status} 
                            onValueChange={(val) => handleUpdateStatus(os.id, val)}
                          >
                            <SelectTrigger className="w-[140px] ml-auto h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending">Pendente</SelectItem>
                              <SelectItem value="assigned">Atribuída</SelectItem>
                              <SelectItem value="in_progress">Em Andamento</SelectItem>
                              <SelectItem value="completed">Concluída</SelectItem>
                              <SelectItem value="cancelled">Cancelada</SelectItem>
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
                Nenhuma ordem de serviço encontrada.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
