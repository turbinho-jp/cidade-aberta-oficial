import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, MapPin, Calendar, Building2, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export type AnnouncementItem = {
  id: number;
  title: string;
  body: string;
  scope: "municipal" | "estadual" | "comunitario";
  department?: { id: number; name: string };
  neighborhood?: { id: number; name: string };
  category?: { id: number; name: string; icon: string; color: string };
  imageUrl: string | null;
  isPublished: boolean;
  publishedAt: string;
  expiresAt: string | null;
};

const SCOPE_LABELS: Record<AnnouncementItem["scope"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  municipal: { label: "Municipal", variant: "default" },
  estadual: { label: "Estadual", variant: "secondary" },
  comunitario: { label: "Comunitário", variant: "outline" },
};

export default function Announcements() {
  const { isAdmin, isSecretary } = useAuth();
  const [items, setItems] = useState<AnnouncementItem[] | null>(null);
  const [scope, setScope] = useState<string>("");

  useEffect(() => {
    let active = true;
    setItems(null);
    const params = new URLSearchParams();
    if (scope) params.set("scope", scope);
    fetch(`/api/announcements?${params.toString()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { announcements: [] }))
      .then((data) => {
        if (active) setItems(data.announcements ?? []);
      })
      .catch(() => {
        if (active) setItems([]);
      });
    return () => {
      active = false;
    };
  }, [scope]);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Megaphone className="w-8 h-8 text-primary" />
              Mural de Avisos
            </h1>
            <p className="text-muted-foreground mt-2">
              Comunicados oficiais, campanhas, interdições e ações comunitárias em João Pessoa.
            </p>
          </div>
          {(isAdmin || isSecretary) && (
            <Link href="/admin/avisos">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Gerenciar Avisos
              </Button>
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { value: "", label: "Todos" },
            { value: "municipal", label: "Municipal" },
            { value: "estadual", label: "Estadual" },
            { value: "comunitario", label: "Comunitário" },
          ].map((tab) => (
            <Button
              key={tab.value}
              size="sm"
              variant={scope === tab.value ? "default" : "outline"}
              onClick={() => setScope(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {items === null ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))
          ) : items.length > 0 ? (
            items.map((item) => {
              const scopeMeta = SCOPE_LABELS[item.scope] ?? SCOPE_LABELS.municipal;
              return (
                <Card key={item.id} className="overflow-hidden flex flex-col">
                  {item.imageUrl && (
                    <div className="h-44 w-full overflow-hidden bg-muted">
                      <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <CardHeader className="pb-2">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Badge variant={scopeMeta.variant}>{scopeMeta.label}</Badge>
                      {item.category && <Badge variant="outline">{item.category.name}</Badge>}
                    </div>
                    <CardTitle className="text-lg leading-snug">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                    <p className="text-sm text-foreground/85 whitespace-pre-wrap">{item.body}</p>
                    <div className="text-xs text-muted-foreground space-y-1 pt-3 border-t">
                      {item.department && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5" />
                          {item.department.name}
                        </div>
                      )}
                      {item.neighborhood && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          {item.neighborhood.name}
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" />
                        Publicado em {format(new Date(item.publishedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full text-center py-20 bg-muted/20 border border-dashed rounded-xl">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Nenhum aviso ativo no momento</h3>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}