import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MailCheck } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Digite um e-mail válido"),
});

export default function ForgotPassword() {
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: z.infer<typeof forgotSchema>) => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.status === 429) {
        toast({
          title: "Muitas tentativas",
          description: "Aguarde alguns minutos antes de solicitar outro link.",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        throw new Error("Falha ao enviar");
      }
      setSubmitted(true);
    } catch {
      toast({
        title: "Erro ao processar solicitação",
        description: "Tente novamente em instantes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-4rem)] bg-muted/20">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-2 text-center pb-6">
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <span className="font-bold text-xl">CA</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Recuperar senha</CardTitle>
          <CardDescription className="text-base">
            Informe o e-mail da sua conta para receber o link de criação de uma nova senha
          </CardDescription>
        </CardHeader>
        <CardContent>
          {submitted ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
                <MailCheck className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h3 className="font-semibold text-lg">Verifique sua caixa de entrada</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Se o e-mail informado estiver cadastrado no <strong>Cidade Aberta</strong>, enviamos um link válido por{" "}
                  <strong>1 hora</strong> para você definir uma nova senha. Confira também a pasta de Spam.
                </p>
              </div>
              <div className="pt-4">
                <Link href="/login">
                  <Button variant="outline" className="w-full gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para o login
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="font-semibold">E-mail cadastrado</FormLabel>
                        <FormControl>
                          <Input placeholder="seu@email.com" type="email" {...field} className="bg-background" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full py-6 text-base font-semibold" disabled={loading}>
                    {loading ? "Enviando..." : "Enviar link de recuperação"}
                  </Button>
                </form>
              </Form>
              <div className="mt-6 text-center text-sm">
                <Link href="/login" className="text-primary font-semibold hover:underline inline-flex items-center gap-1.5">
                  <ArrowLeft className="w-4 h-4" />
                  Voltar para o login
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}