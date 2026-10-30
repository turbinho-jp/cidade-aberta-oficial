import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useRegister } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";

const registerSchema = z.object({
  name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres"),
  acceptTerms: z.boolean().refine((v) => v === true, "Para criar a conta, aceite os Termos e a Política de Privacidade"),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<z.infer<typeof registerSchema>>({
    resolver: zodResolver(registerSchema),
    defaultValues: { name: "", email: "", password: "", acceptTerms: false },
  });

  const onSubmit = (data: z.infer<typeof registerSchema>) => {
    // O aceite é só confirmação na tela: não vai para a API.
    const { acceptTerms: _accepted, ...payload } = data;
    registerMutation.mutate({ data: payload }, {
      onSuccess: () => {
        toast({ title: "Conta criada com sucesso!", description: "Enviamos um link de confirmação para o seu e-mail. Confirme para poder apoiar e comentar." });
        setLocation("/");
      },
      onError: (err: any) => {
        const tooMany = err?.status === 429;
        toast({
          title: "Erro ao criar conta",
          description: tooMany ? "Muitas tentativas. Tente de novo mais tarde." : "Verifique os dados ou se o email já existe.",
          variant: "destructive",
        });
      }
    });
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4 min-h-[calc(100vh-4rem)] bg-muted/20">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader className="space-y-2 text-center pb-8">
          <div className="w-12 h-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
            <span className="font-bold text-xl">CA</span>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Junte-se à Comunidade</CardTitle>
          <CardDescription className="text-base">
            Crie sua conta para reportar e apoiar demandas na sua cidade.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="João da Silva" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">E-mail</FormLabel>
                    <FormControl>
                      <Input placeholder="seu@email.com" type="email" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">Senha</FormLabel>
                    <FormControl>
                      <Input placeholder="******" type="password" {...field} className="bg-background" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acceptTerms"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox id="accept-terms" className="mt-1" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
                      </FormControl>
                      <label htmlFor="accept-terms" className="text-sm leading-snug text-muted-foreground">
                        Li e aceito os{" "}
                        <Link href="/termos" className="text-primary underline" target="_blank">Termos de Uso</Link> e a{" "}
                        <Link href="/privacidade" className="text-primary underline" target="_blank">Política de Privacidade</Link>.
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full py-6 text-base font-semibold mt-2" disabled={registerMutation.isPending}>
                {registerMutation.isPending ? "Criando conta..." : "Criar conta"}
              </Button>
            </form>
          </Form>
          <div className="mt-8 text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link href="/login" className="text-primary font-semibold hover:underline">
              Faça login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
