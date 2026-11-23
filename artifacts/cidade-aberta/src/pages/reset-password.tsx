import { useState } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertCircle } from "lucide-react";

const resetSchema = z
  .object({
    password: z.string().min(8, "A nova senha deve ter no mínimo 8 caracteres"),
    confirmPassword: z.string().min(8, "Confirme a nova senha"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const searchStr = useSearch();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const token = new URLSearchParams(searchStr).get("token") || "";

  const form = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = async (data: z.infer<typeof resetSchema>) => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: data.password }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 410 || json?.code === "TOKEN_EXPIRED") {
        toast({
          title: "Link expirado",
          description: "Este link já passou de 1 hora. Solicite um novo link de recuperação.",
          variant: "destructive",
        });
        return;
      }
      if (!res.ok) {
        toast({
          title: "Link inválido",
          description: "Esse link já foi usado ou é inválido. Solicite um novo.",
          variant: "destructive",
        });
        return;
      }
      setDone(true);
      toast({ title: "Senha alterada com sucesso!" });
      setTimeout(() => setLocation("/login"), 2500);
    } catch {
      toast({
        title: "Erro ao salvar nova senha",
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
          <CardTitle className="text-2xl font-bold tracking-tight">Criar nova senha</CardTitle>
          <CardDescription className="text-base">
            Escolha uma senha segura com pelo menos 8 caracteres
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <p className="text-sm text-muted-foreground">
                Link de recuperação incompleto ou inválido. Solicite um novo link na tela de recuperação.
              </p>
              <Link href="/esqueci-senha">
                <Button className="w-full">Solicitar novo link</Button>
              </Link>
            </div>
          ) : done ? (
            <div className="text-center space-y-4 py-2">
              <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-lg">Senha atualizada!</h3>
              <p className="text-sm text-muted-foreground">
                Redirecionando você para a tela de login...
              </p>
              <Link href="/login">
                <Button className="w-full">Ir para o login agora</Button>
              </Link>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Nova senha</FormLabel>
                      <FormControl>
                        <Input placeholder="Mínimo 8 caracteres" type="password" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Confirmar nova senha</FormLabel>
                      <FormControl>
                        <Input placeholder="Repita a nova senha" type="password" {...field} className="bg-background" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full py-6 text-base font-semibold" disabled={loading}>
                  {loading ? "Salvando..." : "Salvar nova senha"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}