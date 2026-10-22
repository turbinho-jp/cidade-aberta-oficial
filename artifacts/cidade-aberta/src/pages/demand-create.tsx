import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Sparkles, Loader2, ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

const demandSchema = z.object({
  title: z.string().min(5, "O título deve ter pelo menos 5 caracteres"),
  description: z.string().min(10, "A descrição deve ter pelo menos 10 caracteres"),
  category: z.string().min(1, "Selecione ou confirme uma categoria"),
  address: z.string().min(5, "Informe a localização ou endereço"),
});

type DemandFormData = z.infer<typeof demandSchema>;

export default function CreateDemand() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<DemandFormData>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      address: "",
    },
  });

  const descriptionValue = watch("description");

  // Função para chamar a API do Gemini e sugerir a categoria automaticamente
  const handleCategorizarComIA = async (descricaoTexto: string) => {
    if (!descricaoTexto || descricaoTexto.length < 10) return;

    setIsAiLoading(true);
    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `Com base na seguinte descrição de problema urbano em um bairro, retorne APENAS o nome exato da categoria mais adequada (Escolha estritamente uma entre: Pavimentação, Iluminação Pública, Limpeza / Lixo, Saneamento / Esgoto, Trânsito, Outros):\n\n"${descricaoTexto}"`,
        }),
      });

      const data = await res.json();
      if (data.result) {
        const categoriaSugerida = data.result.trim();
        setValue("category", categoriaSugerida, { shouldValidate: true });
        toast({
          title: "IA do Cidade Aberta",
          description: `Categoria definida automaticamente como "${categoriaSugerida}".`,
        });
      }
    } catch (err) {
      console.error("Erro ao sugerir categoria com Gemini:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const onSubmit = async (data: DemandFormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/demands", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Erro ao salvar demanda");

      toast({
        title: "Demanda Criada!",
        description: "A sua solicitação foi registrada com sucesso.",
      });
      setLocation("/demands");
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Erro no envio",
        description: err.message || "Não foi possível enviar a demanda.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="container max-w-2xl mx-auto py-6 px-4">
      <Button
        variant="ghost"
        className="mb-4 flex items-center gap-2"
        onClick={() => setLocation("/demands")}
      >
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-bold">Criar Nova Demanda</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <Label htmlFor="title">Título da Demanda</Label>
              <Input
                id="title"
                placeholder="Ex: Buraco na rua principal"
                {...register("title")}
              />
              {errors.title && (
                <p className="text-sm text-red-500 mt-1">{errors.title.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="description">Descrição do Problema</Label>
              <Textarea
                id="description"
                placeholder="Descreva o problema com detalhes..."
                rows={4}
                {...register("description")}
                onBlur={(e) => handleCategorizarComIA(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Ao terminar de digitar a descrição, a IA sugere a categoria automaticamente.
              </p>
              {errors.description && (
                <p className="text-sm text-red-500 mt-1">{errors.description.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <Label htmlFor="category">Categoria</Label>
                {isAiLoading && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" /> Analisando com Gemini...
                  </span>
                )}
              </div>
              <Input
                id="category"
                placeholder="A categoria será preenchida pela IA"
                {...register("category")}
              />
              {errors.category && (
                <p className="text-sm text-red-500 mt-1">{errors.category.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="address">Localização / Endereço</Label>
              <Input
                id="address"
                placeholder="Rua, número ou ponto de referência"
                {...register("address")}
              />
              {errors.address && (
                <p className="text-sm text-red-500 mt-1">{errors.address.message}</p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Registrando...
                </>
              ) : (
                "Enviar Demanda"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
