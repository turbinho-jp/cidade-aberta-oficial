import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Share2, MessageCircle, Link2 } from "lucide-react";

/** URL direta e limpa da demanda (sem query/hash), respeitando o base path do app. */
export function demandUrl(id: number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return `${window.location.origin}${base}/demandas/${id}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback para navegadores/contextos sem Clipboard API (ex.: http, webviews).
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareDemand({ id, title }: { id: number; title: string }) {
  const { toast } = useToast();

  const shareWhatsApp = () => {
    const message = `⚠️ Atenção moradores! Ajude a resolver a demanda: ${title}. Acesse o link para apoiar no Cidade Aberta: ${demandUrl(id)}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    const url = demandUrl(id);
    if (await copyText(url)) {
      toast({ title: "Link copiado!", description: "Agora é só colar onde quiser compartilhar." });
    } else {
      toast({ title: "Não foi possível copiar", description: url, variant: "destructive" });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="lg" className="w-full mt-3 font-semibold">
          <Share2 className="w-5 h-5 mr-2" />
          Compartilhar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-56">
        <DropdownMenuItem onSelect={shareWhatsApp} className="cursor-pointer py-2.5">
          <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copyLink} className="cursor-pointer py-2.5">
          <Link2 className="w-4 h-4 mr-2" /> Copiar link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
