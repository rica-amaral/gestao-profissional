import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAdminData } from "@/contexts/AdminDataContext";
import type { AdherenceEvent } from "@/lib/admin-types";
import { toast } from "@/hooks/use-toast";

const typeLabel: Record<AdherenceEvent["type"], string> = {
  falta: "Falta",
  cancelamento: "Cancelamento",
  reagendamento: "Reagendamento",
};

export const Adherence = () => {
  const { store, patch } = useAdminData();
  const [clientId, setClientId] = useState<string>(store.clients[0]?.id ?? "");
  const [type, setType] = useState<AdherenceEvent["type"]>("falta");
  const [note, setNote] = useState("");

  const sorted = useMemo(
    () => [...store.adherenceEvents].sort((a, b) => b.at.localeCompare(a.at)),
    [store.adherenceEvents]
  );

  const removeEvent = (id: string) => {
    patch((s) => ({ ...s, adherenceEvents: s.adherenceEvents.filter((e) => e.id !== id) }));
    toast({ title: "Registro removido" });
  };

  const addEvent = () => {
    const c = store.clients.find((x) => x.id === clientId);
    if (!c) {
      toast({ variant: "destructive", title: "Selecione um cliente" });
      return;
    }
    const ev: AdherenceEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      clientId: c.id,
      clientName: c.name,
      type,
      note: note.trim() || undefined,
    };
    patch((s) => ({ ...s, adherenceEvents: [ev, ...s.adherenceEvents] }));
    setNote("");
    toast({ title: "Registro adicionado" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Cancelamento / Reagendamento</h2>
        <p className="text-muted-foreground">
          Cada falta, cancelamento ou reagendamento entra na lista para acompanhar aderência ao horário.
          Reagendamentos feitos pela agenda também aparecem aqui automaticamente.
        </p>
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Registrar evento</CardTitle>
          <CardDescription>Use quando o paciente faltar, cancelar ou quando anotar um reagendamento manual.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 max-w-xl">
          <div className="space-y-2">
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Cliente" />
              </SelectTrigger>
              <SelectContent>
                {[...store.clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={(v) => setType(v as AdherenceEvent["type"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="falta">Falta</SelectItem>
                <SelectItem value="cancelamento">Cancelamento</SelectItem>
                <SelectItem value="reagendamento">Reagendamento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Ex.: avisou com 2h de antecedência" />
          </div>
          <Button type="button" onClick={addEvent}>
            Adicionar à lista
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Histórico</CardTitle>
          <CardDescription>Ordenado do mais recente para o mais antigo.</CardDescription>
        </CardHeader>
        <CardContent>
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Quando</th>
                    <th className="py-2 pr-4 font-medium">Cliente</th>
                    <th className="py-2 pr-4 font-medium">Tipo</th>
                    <th className="py-2 pr-4 font-medium">Obs.</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {format(new Date(row.at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </td>
                      <td className="py-2 pr-4">{row.clientName}</td>
                      <td className="py-2 pr-4">{typeLabel[row.type]}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{row.note ?? "—"}</td>
                      <td className="py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeEvent(row.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
