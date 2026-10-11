import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateDemand, useListCategories, useListNeighborhoods } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Megaphone, MapPin, Camera, Loader2 } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { uploadAttachment } from "@/lib/attachments";
import { SERVICE_AREA } from "@/lib/geo";

const LOCATION_REQUIRED = "Marque o local do problema no mapa";
const OUT_OF_AREA = "O local deve estar na área de atendimento (João Pessoa e região)";

const demandSchema = z.object({
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres"),
  description: z.string().min(10, "Detalhe melhor o problema (mínimo 10 caracteres)"),
  categoryId: z.coerce.number().min(1, "Selecione uma categoria"),
  neighborhoodId: z.coerce.number().min(1, "Selecione um bairro"),
  address: z.string().min(5, "Informe o endereço ou referência"),
  lat: z
    .number({ required_error: LOCATION_REQUIRED, invalid_type_error: LOCATION_REQUIRED })
    .min(SERVICE_AREA.south, OUT_OF_AREA)
    .max(SERVICE_AREA.north, OUT_OF_AREA),
  lng: z
    .number({ required_error: LOCATION_REQUIRED, invalid_type_error: LOCATION_REQUIRED })
    .min(SERVICE_AREA.west, OUT_OF_AREA)
    .max(SERVICE_AREA.east, OUT_OF_AREA),
});

export default function DemandCreate() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const createMutation = useCreateDemand();
  const { data: categories } = useListCategories();
  const { data: neighborhoods } = useListNeighborhoods();

  // Redirect if not logged in (só depois que a sessão terminou de carregar)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) setLocation("/login");
  }, [authLoading, isAuthenticated, setLocation]);

  const form = useForm<z.infer<typeof demandSchema>>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      title: "",
      description: "",
      address: "",
    },
  });

  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const lat = form.watch("lat");
  const lng = form.watch("lng");
  const picked = typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;

  if (authLoading || !isAuthenticated) return null;

  const onSubmit = (data: z.infer<typeof demandSchema>) => {
    // lat/lng vêm do local marcado pelo usuário no mapa (LocationPicker).
    createMutation.mutate({ data }, {
      onSuccess: async (res) => {
        // As fotos sobem depois que a demanda existe; se alguma falhar, a demanda continua registrada.
        let failed = 0;
        if (photos.length > 0) {
          setUploading(true);
          for (const photo of photos) {
            try {
              await uploadAttachment("demand", res.id, photo.blob);
            } catch {
              failed++;
            }
          }
          setUploading(false);
        }
        if (failed > 0) {
          toast({
            title: "Demanda registrada, mas faltaram fotos",
            description: `${failed} ${failed === 1 ? "foto não foi enviada" : "fotos não foram enviadas"}. Você pode adicioná-las na página da demanda.`,
            variant: "destructive",
          });
        } else {
          toast({ title: "Demanda registrada!", description: "Sua solicitação foi enviada com sucesso." });
        }
        setLocation(`/demandas/${res.id}`);
      },
      onError: () => {
        toast({ title: "Erro", description: "Não foi possível registrar a demanda. Tente novamente.", variant: "destructive" });
      }
    });
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Megaphone className="w-8 h-8 text-primary" />
            Reportar Problema
          </h1>
          <p className="text-muted-foreground mt-2">
            Descreva a situação detalhadamente para que a prefeitura possa atuar o mais rápido possível.
          </p>
        </div>

        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-base">Título</FormLabel>
                      <CardDescription>Um resumo curto do problema. Ex: Buraco na via, Lâmpada queimada.</CardDescription>
                      <FormControl>
                        <Input placeholder="Ex: Buraco na Rua das Flores" {...field} className="text-lg py-6 bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-base">Descrição Detalhada</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descreva o problema, há quanto tempo está ocorrendo e como afeta a comunidade..." 
                          className="min-h-[150px] resize-none bg-muted/50" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid sm:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="categoryId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Categoria</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Selecione a categoria" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories?.map(c => (
                              <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="neighborhoodId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Bairro</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value?.toString()}>
                          <FormControl>
                            <SelectTrigger className="bg-muted/50">
                              <SelectValue placeholder="Selecione o bairro" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {neighborhoods?.map(n => (
                              <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Endereço / Referência
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Av. Epitácio Pessoa, próximo ao número 1000" {...field} className="bg-muted/50" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lat"
                  render={() => (
                    <FormItem>
                      <FormLabel className="font-semibold flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Local exato no mapa
                      </FormLabel>
                      <CardDescription>
                        Clique no mapa para marcar onde está o problema. Você pode arrastar o pino para ajustar.
                      </CardDescription>
                      <FormControl>
                        <div>
                          <LocationPicker
                            value={picked}
                            invalid={!!form.formState.errors.lat || !!form.formState.errors.lng}
                            onChange={(p) => {
                              form.setValue("lat", p ? p.lat : (undefined as unknown as number), { shouldDirty: true, shouldValidate: true });
                              form.setValue("lng", p ? p.lng : (undefined as unknown as number), { shouldDirty: true, shouldValidate: true });
                            }}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                      {!form.formState.errors.lat && form.formState.errors.lng?.message && (
                        <p className="text-sm font-medium text-destructive">{form.formState.errors.lng.message}</p>
                      )}
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <div className="font-semibold flex items-center gap-2 text-sm">
                    <Camera className="w-4 h-4" /> Fotos (Opcional)
                  </div>
                  <CardDescription>
                    Tire ou escolha até 5 fotos do problema. Elas são reduzidas no seu aparelho antes do envio.
                  </CardDescription>
                  <PhotoPicker value={photos} onChange={setPhotos} disabled={createMutation.isPending || uploading} />
                </div>

                <div className="pt-4 flex justify-end gap-4">
                  <Button variant="outline" type="button" onClick={() => setLocation("/demandas")}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="lg" className="font-semibold px-8" disabled={createMutation.isPending || uploading}>
                    {(createMutation.isPending || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Registrar Demanda
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
