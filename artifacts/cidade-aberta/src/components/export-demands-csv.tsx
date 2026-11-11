import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { useListNeighborhoods } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

/** Baixa o histórico público de demandas em CSV, opcionalmente filtrado por período e bairro. */
export function ExportDemandsCsv() {
  const { toast } = useToast();
  const { data: neighborhoods } = useListNeighborhoods();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("all");
  const [busy, setBusy] = useState(false);

  const invalidRange = !!from && !!to && from > to;

  async function download() {
    if (invalidRange) return;
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (neighborhoodId !== "all") params.set("neighborhoodId", neighborhoodId);
    const qs = params.toString();

    setBusy(true);
    try {
      const res = await fetch(`${API_BASE}/api/dashboard/export.csv${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const total = Number(res.headers.get("X-Total-Rows") ?? "0");
      if (total === 0) {
        toast({ title: "Nada para exportar", description: "Nenhuma demanda pública encontrada com esses filtros." });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `demandas-cidade-aberta-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Download iniciado", description: `${total.toLocaleString("pt-BR")} demanda(s) exportada(s).` });
    } catch {
      toast({ title: "Não foi possível exportar", description: "Tente novamente em instantes.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Exportar dados (CSV)</CardTitle>
        <CardDescription>
          Baixe o histórico público de demandas para conferir e prestar contas. Não inclui dados pessoais dos autores.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="csv-from">De</Label>
            <Input id="csv-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="csv-to">Até</Label>
            <Input id="csv-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5 md:w-[220px]">
            <Label>Bairro</Label>
            <Select value={neighborhoodId} onValueChange={setNeighborhoodId}>
              <SelectTrigger><SelectValue placeholder="Bairro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os bairros</SelectItem>
                {neighborhoods?.map((n) => (
                  <SelectItem key={n.id} value={n.id.toString()}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={download} disabled={busy || invalidRange} className="gap-2 font-semibold">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Baixar CSV
          </Button>
        </div>
        {invalidRange && <p className="text-sm text-destructive mt-3">A data inicial deve ser anterior à data final.</p>}
        <p className="text-xs text-muted-foreground mt-3">
          Sem filtros, exporta todo o histórico (até 10.000 demandas). Arquivo em UTF-8 com separador ponto e vírgula, pronto para abrir no Excel.
        </p>
      </CardContent>
    </Card>
  );
}
