import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MessageCircle, Clock, Copy } from "lucide-react";
import { useAdminData, freeSlotsForDate, isWeekend } from "@/contexts/AdminDataContext";
import { whatsappHref } from "@/lib/contact";
import { toast } from "@/hooks/use-toast";

const WEEKDAY_ABBR = ["Dom", "2ª", "3ª", "4ª", "5ª", "6ª", "Sáb"];

function shortDate(dateKey: string, d: Date): string {
  const ddMM = dateKey.slice(8, 10) + "/" + dateKey.slice(5, 7);
  return `${ddMM} (${WEEKDAY_ABBR[d.getDay()]})`;
}

function nextDays(from: Date, count: number): Date[] {
  const base = new Date(from);
  base.setHours(12, 0, 0, 0);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(base);
    d.setDate(d.getDate() + i);
    return d;
  });
}

export const AvailableSlots = () => {
  const { store } = useAdminData();
  const [includeLunch, setIncludeLunch] = useState(false);

  const days = useMemo(() => nextDays(new Date(), 14), []);

  const blocks = useMemo(() => {
    return days
      .filter((d) => !isWeekend(format(d, "yyyy-MM-dd")))
      .map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const suggested = freeSlotsForDate(store, key, { suggestOnly: true, emptyOnly: true });
        const all = freeSlotsForDate(store, key, { suggestOnly: false, emptyOnly: true });
        return {
          date: d,
          key,
          suggested,
          all,
          display: includeLunch ? all : suggested,
        };
      });
  }, [days, store, includeLunch]);

  const fullText = useMemo(() => {
    const lines: string[] = ["Horários disponíveis (próximos dias):", ""];
    for (const b of blocks) {
      if (b.display.length === 0) continue;
      lines.push(shortDate(b.key, b.date));
      lines.push(b.display.join(", "));
      lines.push("");
    }
    return lines.join("\n").trim();
  }, [blocks]);

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      toast({ title: "Texto copiado" });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar" });
    }
  };

  const sendWhatsApp = () => {
    window.open(whatsappHref(fullText), "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Horários disponíveis</h2>
        <p className="text-muted-foreground">
          Útil para responder quando perguntam a próxima data livre: copie o texto ou envie pelo WhatsApp da clínica.
          Por padrão, horários de almoço não entram na sugestão (apenas urgências).
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 flex-1">
          <Switch id="lunch" checked={includeLunch} onCheckedChange={setIncludeLunch} />
          <Label htmlFor="lunch" className="cursor-pointer text-sm">
            Incluir horários de almoço (urgências / exceções)
          </Label>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copyText}>
            <Copy className="h-4 w-4 mr-2" />
            Copiar texto
          </Button>
          <Button type="button" size="sm" onClick={sendWhatsApp}>
            <MessageCircle className="h-4 w-4 mr-2" />
            WhatsApp (clínica)
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {blocks.map((b) => (
          <Card key={b.key} className="border-border hover:shadow-soft transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <div>
                  <p className="capitalize">{format(b.date, "EEEE", { locale: ptBR })}</p>
                  <p className="text-sm font-normal text-muted-foreground">{shortDate(b.key, b.date)}</p>
                </div>
                <div className="p-2 rounded-lg bg-primary/10">
                  <Clock className="h-5 w-5 text-primary" />
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {b.display.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sem horários livres.</p>
              ) : (
                <>
                  <p className="text-sm font-semibold text-muted-foreground">{b.display.length} horário(s)</p>
                  <div className="flex flex-wrap gap-2">
                    {b.display.map((slot) => (
                      <span key={slot} className="px-3 py-1 bg-secondary rounded-md text-sm font-medium text-foreground">
                        {slot}
                      </span>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
