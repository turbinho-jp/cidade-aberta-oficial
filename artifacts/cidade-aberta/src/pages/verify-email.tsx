import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { getGetMeQueryKey, useResendVerification, useVerifyEmail } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type State = "loading" | "ok" | "expired" | "invalid" | "error";

export default function VerifyEmail() {
  const { user, isAuthenticated, isLoading: loadingUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const verify = useVerifyEmail();
  const resend = useResendVerification();
  const [state, setState] = useState<State>("loading");
  const started = useRef(false);

  useEffect(() => {
    // O token é de uso único: só chama a API uma vez, mesmo com o React remontando o componente.
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get("token");
    if (!token) { setState("invalid"); return; }
    verify.mutate({ data: { token } }, {
      onSuccess: () => {
        setState("ok");
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
      onError: (err: any) => {
        if (err?.status === 410) setState("expired");
        else if (err?.status === 400) setState("invalid");
        else setState("error");
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onResend = () => {
    resend.mutate(undefined, {
      onSuccess: (res) => toast(res.alreadyVerified
        ? { title: "Seu e-mail já está confirmado" }
        : { title: "E-mail enviado", description: "Abra a nova mensagem e clique no link. Veja também o spam." }),
      onError: (err: any) => toast({
        title: "Não foi possível enviar",
        description: err?.status === 429 ? "Muitos pedidos. Tente de novo em até 1 hora." : "Tente de novo em alguns minutos.",
        variant: "destructive",
      }),
    });
  };

  // Link já usado (ex.: a pessoa clicou duas vezes) mas a conta logada já está confirmada.
  const alreadyDone = state === "invalid" && !loadingUser && user?.emailVerified === true;

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center p-4 py-16 bg-muted/20">
        <Card className="w-full max-w-md shadow-lg border-primary/10 text-center">
          <CardHeader className="space-y-3">
            <div className="mx-auto">
              {state === "loading" && <Loader2 className="w-10 h-10 animate-spin text-primary" />}
              {(state === "ok" || alreadyDone) && <CheckCircle2 className="w-10 h-10 text-primary" />}
              {state !== "loading" && state !== "ok" && !alreadyDone && <XCircle className="w-10 h-10 text-destructive" />}
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">
              {state === "loading" && "Confirmando seu e-mail..."}
              {state === "ok" && "E-mail confirmado!"}
              {alreadyDone && "Seu e-mail já está confirmado"}
              {state === "expired" && "Este link expirou"}
              {state === "invalid" && !alreadyDone && "Link inválido ou já usado"}
              {state === "error" && "Não foi possível confirmar"}
            </CardTitle>
            <CardDescription className="text-base">
              {state === "ok" && "Agora você pode apoiar demandas, comentar e confirmar resoluções."}
              {alreadyDone && "Está tudo certo com a sua conta."}
              {state === "expired" && "Os links valem por 24 horas. Peça um novo abaixo."}
              {state === "invalid" && !alreadyDone && "Peça um novo link para o seu e-mail."}
              {state === "error" && "Tente abrir o link de novo em alguns instantes."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {(state === "ok" || alreadyDone) && (
              <Link href="/"><Button className="w-full">Ir para o mapa</Button></Link>
            )}
            {(state === "expired" || (state === "invalid" && !alreadyDone)) && (
              isAuthenticated ? (
                <Button className="w-full" onClick={onResend} disabled={resend.isPending}>
                  {resend.isPending ? "Enviando..." : "Enviar novo link"}
                </Button>
              ) : (
                <Link href="/login"><Button className="w-full">Entrar para pedir um novo link</Button></Link>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
