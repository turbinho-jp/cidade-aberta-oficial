import { useState } from "react";
import { useRoute, Link } from "wouter";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { 
  useGetDemand, useGetDemandTimeline, useListComments, 
  useCreateComment, useConfirmDemand, useUnconfirmDemand,
  getGetDemandQueryKey, getGetDemandTimelineQueryKey, getListCommentsQueryKey, deleteAttachment
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { PhotoGallery } from "@/components/photo-gallery";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { coverUrl, uploadAttachment } from "@/lib/attachments";
import { MAX_PHOTOS } from "@/lib/image-compress";
import { StatusBadge, isPendingModeration } from "@/components/status-badge";
import { CategoryIcon } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, ThumbsUp, Calendar, AlertCircle, HardHat, FileText, CheckCircle2, Clock, Send, ShieldAlert, Share2 } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function DemandDetail() {
  const [, params] = useRoute("/demandas/:id");
  const demandId = parseInt(params?.id || "0");
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: demand, isLoading: loadingDemand } = useGetDemand(demandId, { query: { queryKey: getGetDemandQueryKey(demandId), enabled: !!demandId } });
  const { data: timeline, isLoading: loadingTimeline } = useGetDemandTimeline(demandId, { query: { queryKey: getGetDemandTimelineQueryKey(demandId), enabled: !!demandId } });
  const { data: comments, isLoading: loadingComments } = useListComments(demandId, { query: { queryKey: getListCommentsQueryKey(demandId), enabled: !!demandId } });

  const confirmMutation = useConfirmDemand();
  const unconfirmMutation = useUnconfirmDemand();
  const commentMutation = useCreateComment();

  const [newComment, setNewComment] = useState("");
  const [newPhotos, setNewPhotos] = useState<PickedPhoto[]>([]);
  const [savingPhotos, setSavingPhotos] = useState(false);

  const canEditPhotos =
    !!user && !!demand && (user.id === demand.authorId || user.role === "admin" || user.role === "secretary");

  const handleSavePhotos = async () => {
    setSavingPhotos(true);
    let failed = 0;
    let lastError = "";
    for (const photo of newPhotos) {
      try {
        await uploadAttachment("demand", demandId, photo.blob);
      } catch (e) {
        failed++;
        lastError = e instanceof Error ? e.message : "";
      }
    }
    setSavingPhotos(false);
    if (failed < newPhotos.length) {
      setNewPhotos([]);
      queryClient.invalidateQueries({ queryKey: getGetDemandQueryKey(demandId) });
    }
    if (failed > 0) {
      toast({ title: "Algumas fotos não foram enviadas", description: lastError || undefined, variant: "destructive" });
    }
  };

  const handleDeletePhoto = async (photo: { id: number }) => {
    try {
      await deleteAttachment(photo.id);
      queryClient.invalidateQueries({ queryKey: getGetDemandQueryKey(demandId) });
    } catch {
      toast({ title: "Não foi possível apagar a foto", variant: "destructive" });
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = demand?.title ?? "Demanda";
    const text = `${title} - veja e apoie essa demanda no Cidade Aberta`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // usuário cancelou
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copiado", description: "Cole onde quiser compartilhar." });
    } catch {
      toast({ title: "Não foi possível copiar", description: url });
    }
  };

  const handleConfirmToggle = () => {
    if (!isAuthenticated) {
      toast({ title: "Faça login", description: "Você precisa estar logado para apoiar uma demanda." });
      return;
    }

    if (demand?.isConfirmedByMe) {
      unconfirmMutation.mutate({ id: demandId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDemandQueryKey(demandId) });
        }
      });
    } else {
      confirmMutation.mutate({ id: demandId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetDemandQueryKey(demandId) });
        }
      });
    }
  };

  const handleComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    commentMutation.mutate({ id: demandId, data: { content: newComment } }, {
      onSuccess: () => {
        setNewComment("");
        toast({ title: "Comentário enviado" });
        // Assume we have a getListCommentsQueryKey, invalidate it or refetch
        // Orval generated hooks don't always export list query keys cleanly without params
        queryClient.invalidateQueries({ queryKey: [`/api/demands/${demandId}/comments`] });
      }
    });
  };

  if (loadingDemand) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-6xl space-y-8">
          <Skeleton className="h-12 w-3/4" />
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8"><Skeleton className="h-[400px] w-full" /></div>
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!demand) return <Layout><div className="p-8 text-center">Demanda não encontrada</div></Layout>;

  return (
    <Layout>
      {/* Cover Photo Header */}
      {coverUrl(demand) && (
        <div className="w-full h-64 md:h-96 relative bg-muted">
          <img src={coverUrl(demand)!} alt={demand.title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
        </div>
      )}

      <div className="container mx-auto px-4 py-8 max-w-6xl -mt-20 relative z-10">
        <div className="grid lg:grid-cols-3 gap-8">
          
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            
            <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border">
              {isPendingModeration(demand) && (
                <div role="status" className="mb-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
                  <strong>Em análise.</strong> Só você e a moderação veem esta demanda. Ela aparece para o público depois de aprovada.
                </div>
              )}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <StatusBadge status={demand.status} pending={isPendingModeration(demand)} className="text-sm px-3 py-1" />
                {demand.category && (
                  <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                    <CategoryIcon name={demand.category.icon} className="w-4 h-4" />
                    {demand.category.name}
                  </span>
                )}
                {demand.priority && (
                  <span className={`text-xs font-bold uppercase tracking-wider px-2 py-1 rounded border ${
                    demand.priority === 'urgent' ? 'border-red-500 text-red-500' : 
                    demand.priority === 'high' ? 'border-orange-500 text-orange-500' : 'border-border text-muted-foreground'
                  }`}>
                    {demand.priority}
                  </span>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4 text-foreground">
                {demand.title}
              </h1>

              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-8 pb-6 border-b">
                <div className="flex items-center gap-1.5">
                  <Avatar className="w-6 h-6">
                    <AvatarFallback className="text-[10px]">{demand.authorName?.substring(0,2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <span>Por <strong>{demand.authorName}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(demand.createdAt), "dd 'de' MMMM, yyyy", { locale: ptBR })}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  <span>{demand.neighborhood?.name}</span>
                </div>
              </div>

              <div className="prose prose-gray dark:prose-invert max-w-none mb-8">
                <p className="text-base md:text-lg leading-relaxed">{demand.description}</p>
              </div>

              {((demand.attachments?.length ?? 0) > 0 || canEditPhotos) && (
                <div className="mb-8 space-y-4">
                  <h2 className="text-lg font-semibold">Fotos</h2>
                  <PhotoGallery
                    photos={demand.attachments ?? []}
                    alt={demand.title}
                    onDelete={canEditPhotos ? handleDeletePhoto : undefined}
                  />
                  {canEditPhotos && (demand.attachments?.length ?? 0) < MAX_PHOTOS && (
                    <div className="space-y-3">
                      <PhotoPicker
                        value={newPhotos}
                        onChange={setNewPhotos}
                        disabled={savingPhotos}
                        max={MAX_PHOTOS - (demand.attachments?.length ?? 0)}
                      />
                      {newPhotos.length > 0 && (
                        <Button type="button" size="sm" onClick={handleSavePhotos} disabled={savingPhotos}>
                          {savingPhotos ? "Enviando..." : `Enviar ${newPhotos.length} ${newPhotos.length === 1 ? "foto" : "fotos"}`}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="bg-muted/30 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 border border-border/50">
                <div>
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-primary" />
                    Localização da ocorrência
                  </h4>
                  <p className="text-sm text-muted-foreground mt-1">{demand.address}</p>
                </div>
                <Link href={`/mapa?search=${demand.title}`}>
                  <Button variant="outline" size="sm">Ver no Mapa</Button>
                </Link>
              </div>
            </div>

            {/* Official Response */}
            {demand.publicResponse && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 md:p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                  <ShieldAlert className="w-24 h-24 text-primary" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 text-primary font-bold mb-4">
                    <CheckCircle2 className="w-5 h-5" />
                    Resposta Oficial da Prefeitura
                  </div>
                  <p className="text-foreground leading-relaxed">{demand.publicResponse}</p>
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="bg-card p-6 md:p-8 rounded-2xl shadow-sm border border-border">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                Comentários ({demand.commentsCount})
              </h3>

              {isAuthenticated ? (
                <form onSubmit={handleComment} className="mb-8">
                  <Textarea 
                    placeholder="Adicione um comentário, informação útil ou atualização..." 
                    className="min-h-[100px] mb-3 bg-muted/30"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!newComment.trim() || commentMutation.isPending}>
                      {commentMutation.isPending ? "Enviando..." : "Enviar Comentário"}
                      {!commentMutation.isPending && <Send className="w-4 h-4 ml-2" />}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="bg-muted/50 rounded-lg p-6 text-center mb-8">
                  <p className="text-muted-foreground mb-4">Faça login para participar da discussão.</p>
                  <Link href="/login"><Button variant="outline">Fazer Login</Button></Link>
                </div>
              )}

              <div className="space-y-6">
                {loadingComments ? (
                  <Skeleton className="h-24 w-full" />
                ) : comments?.length ? (
                  comments.map(comment => (
                    <div key={comment.id} className={`flex gap-4 p-4 rounded-xl ${comment.isOfficial ? 'bg-primary/5 border border-primary/10' : 'bg-muted/20'}`}>
                      <Avatar className="w-10 h-10 border border-background">
                        {comment.authorAvatarUrl && <AvatarImage src={comment.authorAvatarUrl} />}
                        <AvatarFallback className={comment.isOfficial ? 'bg-primary text-primary-foreground' : ''}>
                          {comment.authorName.substring(0,2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{comment.authorName}</span>
                          {comment.isOfficial && <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Oficial</span>}
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-center text-muted-foreground py-4">Nenhum comentário ainda. Seja o primeiro a contribuir!</p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            
            {/* Action Card */}
            <Card className="border-primary/20 shadow-md">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <ThumbsUp className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-4xl font-bold tracking-tight text-foreground mb-1">{demand.confirmationsCount}</h3>
                <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-6">Pessoas apoiam isso</p>
                
                <Button 
                  size="lg" 
                  className={`w-full font-bold text-base transition-all ${demand.isConfirmedByMe ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-muted text-foreground hover:bg-muted-foreground/20'}`}
                  onClick={handleConfirmToggle}
                  disabled={confirmMutation.isPending || unconfirmMutation.isPending}
                >
                  <ThumbsUp className={`w-5 h-5 mr-2 ${demand.isConfirmedByMe ? 'fill-current' : ''}`} />
                  {demand.isConfirmedByMe ? "Apoio Registrado" : "Também me afeta"}
                </Button>

                <Button type="button" variant="outline" size="lg" className="w-full mt-3 font-semibold" onClick={handleShare}>
                  <Share2 className="w-5 h-5 mr-2" />
                  Compartilhar
                </Button>
              </CardContent>
            </Card>

            {/* Department Info */}
            {demand.department && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-primary" />
                    Encaminhado para
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Link href={`/secretarias/${demand.department.id}`} className="block hover:bg-muted p-3 -mx-3 rounded-lg transition-colors">
                    <div className="font-semibold text-foreground">{demand.department.name}</div>
                    <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{demand.department.description}</div>
                  </Link>
                </CardContent>
              </Card>
            )}

            {/* Service Orders */}
            {demand.serviceOrders && demand.serviceOrders.length > 0 && (
              <Card className="border-secondary/30">
                <CardHeader className="pb-3 bg-secondary/5">
                  <CardTitle className="text-base flex items-center gap-2">
                    <HardHat className="w-4 h-4 text-secondary-foreground" />
                    Ordens de Serviço
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {demand.serviceOrders.map(os => (
                    <div key={os.id} className="text-sm border-b pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium">{os.title || `OS #${os.id}`}</span>
                        <Badge variant="outline" className="text-[10px]">{os.status}</Badge>
                      </div>
                      {os.team && <div className="text-muted-foreground text-xs mt-1">Equipe: {os.team.name}</div>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Timeline */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Linha do Tempo
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4 relative before:absolute before:inset-y-0 before:left-[11px] before:w-[2px] before:bg-border/50">
                  {loadingTimeline ? (
                    <Skeleton className="h-40 w-full" />
                  ) : timeline?.map((event, idx) => (
                    <div key={event.id} className="relative flex gap-4 pl-8">
                      <div className={`absolute left-0 w-6 h-6 rounded-full border-2 z-10 flex items-center justify-center bg-background ${idx === 0 ? 'border-primary' : 'border-muted-foreground/30'}`}>
                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/30'}`} />
                      </div>
                      <div>
                        <p className={`text-sm ${idx === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                          {event.description || event.event}
                        </p>
                        <p className="text-[10px] text-muted-foreground/70 mt-0.5 uppercase tracking-wider font-semibold">
                          {format(new Date(event.createdAt), "dd MMM yyyy, HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </Layout>
  );
}

// Inline badge for the OS list just to keep it clean without importing massive dependencies
function Badge({ children, variant, className }: any) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${variant === 'outline' ? 'border' : 'bg-primary text-primary-foreground'} ${className}`}>
      {children}
    </span>
  )
}
