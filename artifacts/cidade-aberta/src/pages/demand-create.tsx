import { useEffect, useRef, useState } from "react";
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
import { Card, CardContent, CardDescription } from "@/components/ui/card";
import { Megaphone, MapPin, Camera, Loader2 } from "lucide-react";
import { LocationPicker } from "@/components/location-picker";
import { PhotoPicker, type PickedPhoto } from "@/components/photo-picker";
import { uploadAttachment } from "@/lib/attachments";
import { SERVICE_AREA } from "@/lib/geo";

const LOCATION_REQUIRED = "Marque o local do problema no mapa";
const OUT_OF_AREA = "O local deve estar na área de atendimento (João Pessoa e região)";

const demandSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
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

type GeoResult = { display_name?: string; address?: Record<string, string> };

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&zoom=18&accept-language=pt-BR&lat=${lat}&lon=${lng}`,
  );
  if (!res.ok) throw new Error("geocode");
  return (await res.json()) as GeoResult;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^bairro\s+/, "")
    .trim();

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
  const [locating, setLocating] = useState(false);
  const addressTouched = useRef(false);
  const neighborhoodTouched = useRef(false);

  const lat = form.watch("lat");
  const lng = form.watch("lng");
  const picked = typeof lat === "number" && typeof lng === "number" ? { lat, lng } : null;

  // Ao marcar o pino, tenta preencher endereço e bairro sozinho.
  useEffect(() => {
    if (typeof lat !== "number" || typeof lng !== "number") return;
    let cancelled = false;
    setLocating(true);
    const timer = setTimeout(async () => {
      try {
        const geo = await reverseGeocode(lat, lng);
        if (cancelled) return;
        const a = geo.address ?? {};

        const street = [a.road, a.house_number].filter(Boolean).join(", ");
        const address = street || (geo.display_name ? geo.display_name.split(",").slice(0, 3).join(",") : "");
        if (!addressTouched.current && address.length >= 5) {
          form.setValue("address", address, { shouldDirty: true, shouldValidate: true });
        }

        if (!neighborhoodTouched.current && neighborhoods) {
          const candidates = [a.suburb, a.neighbourhood, a.quarter, a.city_district]
            .filter((x): x is string => !!x)
            .map(norm);
          const found = neighborhoods.find((n) => {
            const nn = norm(n.name);
            return candidates.some((c) => c === nn || (c.length >= 4 && nn.length >= 4 && (c.includes(nn) || nn.includes(c))));
          });
          if (found) form.setValue("neighborhoodId", found.id, { shouldDirty: true, shouldValidate: true });
        }
      } catch {
        // sem internet ou limite do serviço: a pessoa preenche manualmente
      } finally {
        if (!cancelled) setLocating(false);
      }
    }, 700);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      setLocating(false);
    };
  }, [lat, lng, neighborhoods, form]);

  if (authLoading || !isAuthenticated) return null;

  const onSubmit = (data: z.infer<typeof demandSchema>) => {
    const category = categories?.find((c) => c.id === data.categoryId);
    const neighborhood = neighborhoods?.find((n) => n.id === data.neighborhoodId);
    const categoryName = category?.name ?? "Problema urbano";

    const title = data.title?.trim() || `${categoryName}${neighborhood ? ` - ${neighborhood.name}` : ""}`;
    const description = data.description?.trim() || `${categoryName} reportado em ${data.address}.`;

    const payload = { ...data, title, description };

    // lat/lng vêm do local marcado pelo usuário no mapa (LocationPicker).
    createMutation.mutate({ data: payload }, {
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
            Marque o local, escolha a categoria e, se puder, envie uma foto. É rápido.
          </p>
        </div>

        <Card className="border-border shadow-sm">
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                <FormField
                  control={form.control}
                  name="lat"
                  render={() => (
                    <FormItem>
                      <FormLabel className="font-semibold text-base flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> 1. Onde está o problema?
                      </FormLabel>
                      <CardDescription>
                        Clique no mapa para marcar o local. Você pode arrastar o pino para ajustar.
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
                  <div className="font-semibold flex items-center gap-2 text-base">
                    <Camera className="w-4 h-4" /> 2. Foto (opcional)
                  </div>
                  <CardDescription>
                    Tire ou escolha até 5 fotos. Elas são reduzidas no seu aparelho antes do envio.
                  </CardDescription>
                  <PhotoPicker value={photos} onChange={setPhotos} disabled={createMutation.isPending || uploading} />
                </div>

                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold text-base">3. Que tipo de problema é?</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value ? field.value.toString() : ""}
                      >
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
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">O que está acontecendo? (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Se quiser, conte há quanto tempo ocorre e como afeta a vizinhança..."
                          className="min-h-[100px] resize-none bg-muted/50"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Confirme o local</p>
                    {locating && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" /> Buscando endereço...
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Preenchido automaticamente ao marcar o pino. Corrija se estiver errado.
                  </p>

                  <FormField
                    control={form.control}
                    name="neighborhoodId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Bairro</FormLabel>
                        <Select
                          onValueChange={(v) => {
                            neighborhoodTouched.current = true;
                            field.onChange(v);
                          }}
                          value={field.value ? field.value.toString() : ""}
                        >
                          <FormControl>
                            <SelectTrigger className="bg-background">
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

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">Endereço / Referência</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: Av. Epitácio Pessoa, próximo ao número 1000"
                            {...field}
                            onChange={(e) => {
                              addressTouched.current = true;
                              field.onChange(e);
                            }}
                            className="bg-background"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="pt-2 flex justify-end gap-4">
                  <Button variant="outline" type="button" onClick={() => setLocation("/")}>
                    Cancelar
                  </Button>
                  <Button type="submit" size="lg" className="font-semibold px-8" disabled={createMutation.isPending || uploading}>
                    {(createMutation.isPending || uploading) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Enviar
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
