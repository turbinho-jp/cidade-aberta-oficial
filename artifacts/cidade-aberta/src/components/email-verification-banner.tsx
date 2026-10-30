import { useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { MailWarning } from "lucide-react";
import { getGetMeQueryKey, useResendVerification } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

/** Faixa no topo para quem tem conta mas ainda não confirmou o e-mail. A equipe da prefeitura não vê. */
export function EmailVerificationBanner() {
  const { user } = useAuth();
  const [location] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const resend = useResendVerification();

  if (!user || user.role !== "citizen" || user.emailVerified !== false) return null;
  // Na própria página de confirmação a faixa só atrapalha.
  if (location.startsWith("/verificar-email")) return null;

  const onResend = () => {
    resend.mutate(undefined, {
      onSuccess: (res) => {
        if (res.alreadyVerified) {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: "Seu e-mail já está confirmado" });
          return;
        }
        toast({ title: "E-mail enviado", description: `Abra a mensagem enviada para ${user.email} e clique no link. Veja também o spam.` });
      },
      onError: (err: any) => {
        toast({
          title: "Não foi possível enviar",
          description: err?.status === 429
            ? "Você já pediu o link várias vezes. Tente de novo em até 1 hora."
            : "Tente de novo em alguns minutos.",
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-950 dark:bg-amber-950/40 dark:border-amber-900 dark:text-amber-100">
      <div className="container mx-auto px-4 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
        <p className="flex items-start gap-2">
          <MailWarning className="w-4 h-4 mt-0.5 shrink-0" />
          <span>
            Confirme seu e-mail (<strong>{user.email}</strong>) para apoiar, comentar e validar resoluções.
          </span>
        </p>
        <Button size="sm" variant="outline" className="shrink-0 self-start sm:self-auto" onClick={onResend} disabled={resend.isPending}>
          {resend.isPending ? "Enviando..." : "Reenviar e-mail"}
        </Button>
      </div>
    </div>
  );
}
