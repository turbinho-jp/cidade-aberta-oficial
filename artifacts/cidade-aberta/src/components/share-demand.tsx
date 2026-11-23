import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Share2, MessageCircle, Link2, FileText, ImageDown, Loader2 } from "lucide-react";

/** URL de compartilhamento com Open Graph (foto e resumo no WhatsApp), que redireciona para /demandas/:id. */
export function demandUrl(id: number): string {
  return `${window.location.origin}/api/share/demands/${id}`;
}

export type ShareDemandProps = {
  id: number;
  title: string;
  description?: string;
  status?: string;
  neighborhood?: string;
  address?: string;
  category?: string;
  confirmationsCount?: number;
  createdAt?: string;
  photoUrl?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "EM ABERTO", color: "#dc2626" },
  under_review: { label: "EM ANÁLISE", color: "#d97706" },
  in_progress: { label: "EM ANDAMENTO", color: "#2563eb" },
  completed: { label: "RESOLVIDA", color: "#16a34a" },
  closed: { label: "ENCERRADA", color: "#52525b" },
  rejected: { label: "REJEITADA", color: "#71717a" },
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
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

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      if (current) lines.push(current);
      current = word;
      if (lines.length === maxLines) break;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && words.join(" ") !== lines.join(" ")) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s+\S*$/, "") + "...";
  }
  return lines;
}

async function loadCorsImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function generateDemandPng(props: ShareDemandProps): Promise<Blob | null> {
  const width = 1080;
  const height = 1350;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const statusMeta = STATUS_LABELS[props.status || "open"] || STATUS_LABELS.open;

  // Fundo escuro institucional
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, 0, width, height);

  // Faixa superior verde
  ctx.fillStyle = "#16a34a";
  ctx.fillRect(0, 0, width, 16);

  // Cabeçalho: Logo CA + Cidade Aberta + Protocolo
  ctx.fillStyle = "#16a34a";
  ctx.beginPath();
  ctx.roundRect(64, 56, 68, 68, 14);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 32px system-ui, -apple-system, sans-serif";
  ctx.textBaseline = "middle";
  ctx.fillText("CA", 76, 91);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 34px system-ui, -apple-system, sans-serif";
  ctx.fillText("Cidade Aberta", 150, 82);

  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 22px system-ui, -apple-system, sans-serif";
  ctx.fillText("CONTROLE SOCIAL E MOBILIZAÇÃO COMUNITÁRIA", 150, 114);

  // Badge de Status
  ctx.font = "bold 22px system-ui, -apple-system, sans-serif";
  const badgeText = `${statusMeta.label}  •  #${props.id}`;
  const badgeW = ctx.measureText(badgeText).width + 44;
  ctx.fillStyle = statusMeta.color;
  ctx.beginPath();
  ctx.roundRect(64, 164, badgeW, 48, 24);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.fillText(badgeText, 86, 189);

  // Área da Foto (ou bloco visual caso não tenha foto)
  let cursorY = 244;
  const photoImg = props.photoUrl ? await loadCorsImage(props.photoUrl) : null;
  if (photoImg) {
    const boxW = width - 128;
    const boxH = 440;
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(64, cursorY, boxW, boxH, 24);
    ctx.clip();

    const scale = Math.max(boxW / photoImg.width, boxH / photoImg.height);
    const drawW = photoImg.width * scale;
    const drawH = photoImg.height * scale;
    ctx.drawImage(photoImg, 64 + (boxW - drawW) / 2, cursorY + (boxH - drawH) / 2, drawW, drawH);
    ctx.restore();
    cursorY += boxH + 40;
  } else {
    cursorY += 16;
  }

  // Categoria
  if (props.category) {
    ctx.fillStyle = "#4ade80";
    ctx.font = "bold 24px system-ui, -apple-system, sans-serif";
    ctx.fillText(props.category.toUpperCase(), 64, cursorY);
    cursorY += 42;
  }

  // Título da demanda
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 46px system-ui, -apple-system, sans-serif";
  const titleLines = wrapLines(ctx, props.title, width - 128, photoImg ? 3 : 5);
  for (const line of titleLines) {
    ctx.fillText(line, 64, cursorY);
    cursorY += 58;
  }

  cursorY += 12;

  // Bairro e Endereço
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "500 28px system-ui, -apple-system, sans-serif";
  const locationText = [props.neighborhood, props.address].filter(Boolean).join(" — ");
  if (locationText) {
    const locLines = wrapLines(ctx, `📍 ${locationText}`, width - 128, 2);
    for (const line of locLines) {
      ctx.fillText(line, 64, cursorY);
      cursorY += 38;
    }
  }

  // Card de Prova Social (Apoios) no rodapé
  const footerY = height - 230;
  ctx.fillStyle = "#1e293b";
  ctx.beginPath();
  ctx.roundRect(64, footerY, width - 128, 116, 20);
  ctx.fill();

  const supports = props.confirmationsCount ?? 0;
  ctx.fillStyle = "#4ade80";
  ctx.font = "bold 44px system-ui, -apple-system, sans-serif";
  ctx.fillText(`${supports}`, 96, footerY + 46);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "600 26px system-ui, -apple-system, sans-serif";
  ctx.fillText(supports === 1 ? "morador já apoiou esta demanda" : "moradores já apoiaram esta demanda", 96, footerY + 86);

  // URL no rodapé final
  ctx.fillStyle = "#94a3b8";
  ctx.font = "500 23px system-ui, -apple-system, sans-serif";
  ctx.fillText(`Acompanhe e apoie: ${demandUrl(props.id)}`, 64, height - 64);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export function ShareDemand(props: ShareDemandProps) {
  const { id, title, status, neighborhood, address, confirmationsCount } = props;
  const { toast } = useToast();
  const [generating, setGenerating] = useState(false);

  const buildSummaryText = () => {
    const statusLabel = STATUS_LABELS[status || "open"]?.label || "EM ABERTO";
    const lines = [
      `📢 *CIDADE ABERTA — DEMANDA #${id}*`,
      `*${title}*`,
      neighborhood ? `📍 *Bairro:* ${neighborhood}` : null,
      address ? `🗺️ *Local:* ${address}` : null,
      `📌 *Status:* ${statusLabel}`,
      typeof confirmationsCount === "number" ? `👍 *Apoios:* ${confirmationsCount} morador(es)` : null,
      ``,
      `Apoie e acompanhe a cobrança no link:`,
      demandUrl(id),
    ].filter((line): line is string => line !== null);
    return lines.join("\n");
  };

  const shareWhatsApp = () => {
    const message = buildSummaryText();
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  };

  const copyDossier = async () => {
    const text = buildSummaryText();
    if (await copyText(text)) {
      toast({ title: "Resumo copiado!", description: "Pronto para colar no WhatsApp, Instagram ou ofício." });
    } else {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const downloadCard = async () => {
    setGenerating(true);
    try {
      const blob = await generateDemandPng(props);
      if (!blob) throw new Error();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cidade-aberta-demanda-${id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Card PNG gerado!", description: "Imagem salva para compartilhar nas redes ou Status." });
    } catch {
      toast({ title: "Não foi possível gerar a imagem", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
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
        <Button type="button" variant="outline" size="lg" className="w-full mt-3 font-semibold" disabled={generating}>
          {generating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Share2 className="w-5 h-5 mr-2" />}
          {generating ? "Gerando card..." : "Compartilhar / Cobrar"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="center" className="w-[var(--radix-dropdown-menu-trigger-width)] min-w-60">
        <DropdownMenuItem onSelect={shareWhatsApp} className="cursor-pointer py-2.5 font-medium">
          <MessageCircle className="w-4 h-4 mr-2 text-green-600" /> Enviar no WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadCard} className="cursor-pointer py-2.5 font-medium">
          <ImageDown className="w-4 h-4 mr-2 text-primary" /> Baixar Card PNG (Redes)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={copyDossier} className="cursor-pointer py-2.5">
          <FileText className="w-4 h-4 mr-2" /> Copiar resumo completo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={copyLink} className="cursor-pointer py-2.5">
          <Link2 className="w-4 h-4 mr-2" /> Copiar apenas o link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}