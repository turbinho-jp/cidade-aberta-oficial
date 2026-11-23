import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, MapPin, Calendar, Plus } from "lucide-react";
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

export default function Announcements() {
  const { isAdmin, isSecretary } = useAuth();
  const [items, setItems] = useState<AnnouncementItem[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/announcements", { credentials: "include" })
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
  }, []);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Megaphone className="w-8 h-8 text-primary" />
              Mural de Avisos
            </h1>
            <p className="text-muted-foreground mt-2">
              Divulgação de acontecimentos, mobilizações, ações sociais e comunicados para a comunidade.
            </p>
          </div>
          {(isAdmin || isSecretary) && (
            <Link href="/admin/avisos">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Publicar Aviso
              </Button>
            </Link>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {items === null ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-56 rounded-xl" />
            ))
          ) : items.length > 0 ? (
            items.map((item) => (
              <Card key={item.id} className="overflow-hidden flex flex-col">
                {item.imageUrl && (
                  <div className="h-48 w-full overflow-hidden bg-muted">
                    <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  {item.category && (
                    <div className="mb-2">
                      <Badge variant="outline">{item.category.name}</Badge>
                    </div>
                  )}
                  <CardTitle className="text-lg leading-snug">{item.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 flex-1 flex flex-col justify-between">
                  <p className="text-sm text-foreground/85 whitespace-pre-wrap">{item.body}</p>
                  <div className="text-xs text-muted-foreground space-y-1 pt-3 border-t">
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
            ))
          ) : (
            <div className="col-span-full text-center py-20 bg-muted/20 border border-dashed rounded-xl">
              <Megaphone className="w-12 h-12 text-muted-foreground mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium">Nenhuma publicação no mural no momento</h3>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}