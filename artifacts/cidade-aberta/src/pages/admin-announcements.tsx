import { useCallback, useEffect, useState } from "react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Megaphone, Trash2, Send, MapPin, Camera, X } from "lucide-react";
import { format } from "date-fns";
import { LocationPicker } from "@/components/location-picker";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import type { AnnouncementItem } from "./announcements";

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(blob);
  });
}

export default function AdminAnnouncements() {
  const { isAdmin, isSecretary, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<AnnouncementItem[] | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [expiresAt, setExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements?includeExpired=true", { credentials: "include" });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setItems(data.announcements ?? []);
    } catch {
      setItems([]);
      toast({ title: "Erro ao carregar publicações", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if (!authLoading && (isAdmin || isSecretary)) load();
  }, [authLoading, isAdmin, isSecretary, load]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 5 || body.trim().length < 10) {
      toast({ title: "Preencha título (mín. 5) e texto (mín. 10 caracteres)", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      let finalImageUrl: string | null = imageUrl.trim() || null;

      // Se o administrador escolheu uma foto/flyer direto do aparelho, converte para Data URL
      if (photos.length > 0) {
        finalImageUrl = await blobToDataUrl(photos[0].blob);
      }

      const res = await fetch("/api/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          body: body.trim(),
          scope: "comunitario",
          imageUrl: finalImageUrl,
          lat: coords ? coords.lat : null,
          lng: coords ? coords.lng : null,
          expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
          isPublished: true,
        }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "Publicação enviada para o mural!" });
      setTitle("");
      setBody("");
      setImageUrl("");
      setPhotos([]);
      setCoords(null);
      setExpiresAt("");
      load();
    } catch {
      toast({ title: "Não foi possível publicar", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Remover esta publicação permanentemente?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/announcements/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      setItems((cur) => (cur ?? []).filter((i) => i.id !== id));
      toast({ title: "Publicação removida" });
    } catch {
      toast({ title: "Não foi possível remover", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  if (authLoading) return null;

  if (!isAdmin && !isSecretary) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 text-center text-muted-foreground">
          Acesso restrito à administração da plataforma.
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary" />
            Gerenciar Mural de Avisos
          </h1>
          <p className="text-muted-foreground mt-1">
            Divulgue acontecimentos, ações comunitárias, campanhas e informativos para os moradores.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Nova Publicação</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  placeholder="Ex.: Mutirão de limpeza e ação social neste sábado"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Camera className="w-4 h-4" /> Imagem ou flyer da ação (opcional)
                </Label>
                <p className="text-xs text-muted-foreground">
                  Envie uma foto direto do seu aparelho (reduzida automaticamente) ou cole um link externo abaixo.
                </p>
                <PhotoPicker
                  value={photos}
                  onChange={(next) => setPhotos(next.slice(0, 1))}
                  disabled={submitting}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="imageUrl">Ou cole uma URL de imagem (opcional)</Label>
                  <Input
                    id="imageUrl"
                    type="url"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={photos.length > 0}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="expiresAt">Exibir até (opcional)</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="body">Texto da publicação</Label>
                <Textarea
                  id="body"
                  rows={4}
                  placeholder="Escreva os detalhes do acontecimento, data, local e orientações..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Label className="flex items-center gap-2 font-semibold">
                    <MapPin className="w-4 h-4 text-primary" /> Local no mapa (opcional)
                  </Label>
                  {coords && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-muted-foreground"
                      onClick={() => setCoords(null)}
                    >
                      <X className="w-3.5 h-3.5 mr-1" /> Remover pino
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  Clique no mapa para marcar onde a ação vai acontecer. Se marcar um ponto, o aviso aparece também com um pino roxo no Mapa da Cidade.
                </p>
                <LocationPicker value={coords} onChange={setCoords} />
              </div>

              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
                Publicar no Mural
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Publicações Ativas</h2>
          {items === null ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
          ) : items.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma publicação cadastrada.</CardContent></Card>
          ) : (
            items.map((item) => (
              <Card key={item.id}>
                <CardContent className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(item.publishedAt), "dd/MM/yyyy 'às' HH:mm")}
                      </span>
                      {typeof item.lat === "number" && typeof item.lng === "number" && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                          <MapPin className="w-3 h-3" /> No mapa
                        </span>
                      )}
                    </div>
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-muted-foreground line-clamp-2">{item.body}</p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-destructive shrink-0"
                    disabled={deletingId === item.id}
                    onClick={() => handleDelete(item.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}