import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { coverUrl } from "@/lib/attachments";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, ShieldCheck, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type PendingDemand = {
  id: number;
  title: string;
  description: string;
  address: string;
  authorName: string;
  createdAt: string;
  category?: { name: string };
  neighborhood?: { name: string };
};

async function call(path: string, method: string, body?: unknown) {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

export default function AdminModeration() {
  const { isAdmin, isSecretary, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<PendingDemand[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await call("/api/demands/pending", "GET");
      setItems(data.demands ?? []);
    } catch {
      setItems([]);
      toast({ title: "Não foi possível carregar a fila", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (isAdmin || isSecretary)) load();
  }, [authLoading, isAdmin, isSecretary, load]);

  const approve = async (id: number) => {
    setBusyId(id);
    try {
      await call(`/api/demands/${id}/approve`, "PATCH");
      setItems((cur) => (cur ?? []).filter((d) => d.id !== id));
      toast({ title: "Demanda publicada" });
    } catch {
      toast({ title: "Não foi possível aprovar", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: number) => {
    const reason = window.prompt("Motivo da rejeição (o autor poderá ver):");
    if (reason === null) return;
    setBusyId(id);
    try {
      await call(`/api/demands/${id}/status`, "PATCH", {
        status: "rejected",
        publicResponse: reason.trim() || "Esta demanda não atende às regras de publicação.",
      });
      setItems((cur) => (cur ?? []).filter((d) => d.id !== id));
      toast({ title: "Demanda rejeitada" });
    } catch {
      toast({ title: "Não foi possível rejeitar", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (authLoading) return null;

  if (!isAdmin && !isSecretary) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
          Acesso restrito à equipe de gestão.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3 mb-2">
          <ShieldCheck className="w-8 h-8 text-primary" />
          Moderação
        </h1>
        <p className="text-muted-foreground mb-8">
          Demandas novas aguardando aprovação. Só aparecem para o público depois de publicadas.
        </p>

        {items === null ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhuma demanda pendente.</CardContent></Card>
        ) : (
          <div className="space-y-4">
            {items.map((d) => {
              const photo = coverUrl(d as any);
              return (
                <Card key={d.id}>
                  <CardContent className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4">
                    {photo && (
                      <img src={photo} alt={d.title} className="w-full sm:w-40 h-40 object-cover rounded-lg bg-muted" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-1">
                        {d.category?.name} · {d.neighborhood?.name} · {formatDistanceToNow(new Date(d.createdAt), { addSuffix: true, locale: ptBR })}
                      </div>
                      <h2 className="font-semibold text-lg leading-snug">{d.title}</h2>
                      <p className="text-sm text-foreground/80 mt-1 whitespace-pre-wrap">{d.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">{d.address} · por {d.authorName}</p>
                      <div className="flex flex-wrap gap-2 mt-4">
                        <Button size="sm" onClick={() => approve(d.id)} disabled={busyId === d.id}>
                          <Check className="w-4 h-4 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => reject(d.id)} disabled={busyId === d.id}>
                          <X className="w-4 h-4 mr-1" /> Rejeitar
                        </Button>
                        <Link href={`/demandas/${d.id}`}>
                          <Button size="sm" variant="ghost">Ver demanda</Button>
                        </Link>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
