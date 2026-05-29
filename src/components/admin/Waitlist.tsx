import { useMemo, useState } from "react";
import { format, addDays, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarCheck, Clock, Copy, MessageCircle, Plus, Trash2, Users } from "lucide-react";
import { useAdminData, freeSlotsForDate, formatDateBR, todayKeyBRT, findAppointments, MAX_PER_SLOT } from "@/contexts/AdminDataContext";
import { whatsappHref } from "@/lib/contact";
import { toast } from "@/hooks/use-toast";
import type { WaitlistEntry } from "@/lib/admin-types";

// ─── helpers de semana ───────────────────────────────────────────────

function buildWeekDays(from: Date, to: Date): string[] {
  const days: string[] = [];
  const cur = new Date(from);
  cur.setHours(12, 0, 0, 0);
  const end = new Date(to);
  end.setHours(12, 0, 0, 0);
  while (cur <= end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function buildMessage(store: Parameters<typeof freeSlotsForDate>[0]): string {
  const todayKey = todayKeyBRT();
  const today = new Date(todayKey + "T12:00:00");
  const tomorrow = addDays(today, 1);
  const thisSunday = endOfWeek(today, { weekStartsOn: 1 });
  const nextMonday = addDays(thisSunday, 1);
  const nextSunday = endOfWeek(nextMonday, { weekStartsOn: 1 });

  const thisWeekDays = buildWeekDays(tomorrow, thisSunday);
  const nextWeekDays = buildWeekDays(nextMonday, nextSunday);

  function formatDay(dateKey: string): string | null {
    const slots = freeSlotsForDate(store, dateKey, { suggestOnly: true, emptyOnly: true });
    if (!slots.length) return null;
    const ddMM = dateKey.slice(8, 10) + "/" + dateKey.slice(5, 7);
    const hours = slots.map((s) => s.slice(0, 5).replace(":00", "h")).join(", ");
    return `${ddMM} - ${hours}`;
  }

  const thisWeekLines = thisWeekDays.map(formatDay).filter(Boolean) as string[];
  const nextWeekLines = nextWeekDays.map(formatDay).filter(Boolean) as string[];

  const parts: string[] = [];
  if (thisWeekLines.length) { parts.push("Essa semana"); parts.push(...thisWeekLines); }
  if (nextWeekLines.length) { if (parts.length) parts.push(""); parts.push("Semana que vem"); parts.push(...nextWeekLines); }
  if (!parts.length) return "Sem horários disponíveis no momento.";
  return parts.join("\n");
}

// ─── componente ──────────────────────────────────────────────────────

export const Waitlist = () => {
  const { store, patch } = useAdminData();

  // ── estado: adicionar à fila ──
  const [addOpen, setAddOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [notes, setNotes] = useState("");

  // ── estado: agendar da fila ──
  const [schedEntry, setSchedEntry] = useState<WaitlistEntry | null>(null);
  const [schedDate, setSchedDate] = useState<Date | undefined>(undefined);
  const [schedTime, setSchedTime] = useState<string | null>(null);

  const message = useMemo(() => buildMessage(store), [store]);

  const sortedClients = useMemo(
    () => [...store.clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")),
    [store.clients],
  );

  const waitlistClientIds = useMemo(() => new Set(store.waitlist.map((w) => w.clientId)), [store.waitlist]);
  const availableClients = useMemo(() => sortedClients.filter((c) => !waitlistClientIds.has(c.id)), [sortedClients, waitlistClientIds]);

  const waiting   = store.waitlist.filter((w) => !w.scheduledDate);
  const scheduled = store.waitlist.filter((w) =>  w.scheduledDate);

  // Slots livres para o dia selecionado no dialog de agendamento
  const freeSlots = useMemo(() => {
    if (!schedDate || !schedEntry) return [];
    const dk = format(schedDate, "yyyy-MM-dd");
    return freeSlotsForDate(store, dk);
  }, [schedDate, schedEntry, store]);

  function addToWaitlist() {
    if (!selectedClientId) return;
    const client = store.clients.find((c) => c.id === selectedClientId);
    if (!client) return;
    const entry: WaitlistEntry = {
      id: crypto.randomUUID(),
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      notes: notes.trim() || undefined,
      requestedAt: new Date().toISOString(),
    };
    patch((s) => ({ ...s, waitlist: [...s.waitlist, entry] }));
    setAddOpen(false);
    setSelectedClientId("");
    setNotes("");
    toast({ title: `${client.name} adicionado(a) à fila` });
  }

  function removeFromWaitlist(id: string, name: string) {
    patch((s) => ({ ...s, waitlist: s.waitlist.filter((w) => w.id !== id) }));
    toast({ title: `${name} removido(a) da fila` });
  }

  function openSchedule(entry: WaitlistEntry) {
    setSchedEntry(entry);
    setSchedDate(undefined);
    setSchedTime(null);
  }

  function confirmSchedule() {
    if (!schedEntry || !schedDate || !schedTime) return;
    const dk = format(schedDate, "yyyy-MM-dd");

    const existing = findAppointments(store, dk, schedTime);
    if (existing.length >= MAX_PER_SLOT) {
      toast({ variant: "destructive", title: "Horário lotado", description: `Máximo de ${MAX_PER_SLOT} pacientes por horário.` });
      return;
    }

    const aptId = crypto.randomUUID();
    const client = store.clients.find((c) => c.id === schedEntry.clientId);

    patch((s) => ({
      ...s,
      appointments: [
        ...s.appointments,
        {
          id: aptId,
          date: dk,
          time: schedTime,
          clientId: schedEntry.clientId,
          clientName: schedEntry.clientName,
          clientPhone: schedEntry.clientPhone,
          confirmed: false,
          paid: false,
          price: client
            ? ([...s.appointments].filter((a) => a.clientId === client.id && a.price > 0).sort((a, b) => b.date.localeCompare(a.date)).at(0)?.price ?? 0)
            : 0,
        },
      ],
      waitlist: s.waitlist.map((w) =>
        w.id === schedEntry.id ? { ...w, scheduledDate: dk, scheduledTime: schedTime } : w
      ),
    }));

    toast({ title: `${schedEntry.clientName} agendado(a) para ${formatDateBR(dk)} às ${schedTime}` });
    setSchedEntry(null);
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      toast({ title: "Texto copiado" });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar" });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-1">Fila de Espera</h2>
          <p className="text-muted-foreground">Clientes aguardando horário — em ordem de chegada.</p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Adicionar
        </Button>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-6">
        {/* ── Fila ── */}
        <div className="space-y-4">
          {/* Aguardando */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                {waiting.length === 0 ? "Fila vazia" : `${waiting.length} aguardando`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {waiting.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">Nenhum cliente aguardando.</p>
              )}
              {waiting.map((entry, idx) => (
                <div key={entry.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="text-2xl font-bold text-muted-foreground/40 tabular-nums w-8 shrink-0 mt-0.5">{idx + 1}</span>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{entry.clientName}</p>
                      <p className="text-xs text-muted-foreground">{entry.clientPhone}</p>
                      {entry.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</p>}
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Entrou: {format(new Date(entry.requestedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button type="button" size="sm" variant="secondary" onClick={() => openSchedule(entry)}>
                      <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                      Agendar
                    </Button>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => removeFromWaitlist(entry.id, entry.clientName)} title="Remover da fila">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Agendados da fila */}
          {scheduled.length > 0 && (
            <Card className="border-border">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base text-green-700">
                  <CalendarCheck className="h-4 w-4" />
                  {scheduled.length} agendado(s) da fila
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {scheduled.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{entry.clientName}</p>
                      <p className="text-xs text-green-700 font-medium">
                        {entry.scheduledDate && formatDateBR(entry.scheduledDate)} às {entry.scheduledTime}
                      </p>
                      {entry.notes && <p className="text-xs text-muted-foreground italic">{entry.notes}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary" className="text-green-700 bg-green-500/15 border-green-500/30">Agendado</Badge>
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => removeFromWaitlist(entry.id, entry.clientName)} title="Remover da fila">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Mensagem de horários ── */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-4 w-4" />
              Horários disponíveis
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <pre className="text-sm whitespace-pre-wrap font-sans bg-secondary/50 rounded-lg p-3 text-foreground leading-relaxed">{message}</pre>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={copyMessage} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />Copiar
              </Button>
              <Button type="button" size="sm" className="flex-1"
                onClick={() => window.open(whatsappHref(message), "_blank", "noopener,noreferrer")}>
                <MessageCircle className="h-4 w-4 mr-2" />WhatsApp
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: adicionar à fila ── */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Adicionar à fila de espera</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
              >
                <option value="">— selecione um cliente —</option>
                {availableClients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` · ${c.phone}` : ""}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Observação (opcional)</Label>
              <Textarea placeholder="Ex: prefere manhã, retorno após viagem..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancelar</Button>
            <Button onClick={addToWaitlist} disabled={!selectedClientId}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: agendar da fila ── */}
      <Dialog open={!!schedEntry} onOpenChange={(o) => !o && setSchedEntry(null)}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar — {schedEntry?.clientName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex justify-center">
              <Calendar
                mode="single"
                selected={schedDate}
                onSelect={(d) => { setSchedDate(d); setSchedTime(null); }}
                locale={ptBR}
                disabled={(d) => [0, 6].includes(d.getDay())}
                className="rounded-md border"
              />
            </div>
            {schedDate && (
              <div className="space-y-2">
                <Label>Horários livres — {format(schedDate, "dd/MM", { locale: ptBR })}</Label>
                {freeSlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum horário disponível neste dia.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {freeSlots.map((t) => (
                      <Button key={t} type="button" size="sm"
                        variant={schedTime === t ? "default" : "outline"}
                        onClick={() => setSchedTime(t)}>
                        {t}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSchedEntry(null)}>Cancelar</Button>
            <Button onClick={confirmSchedule} disabled={!schedDate || !schedTime}>
              <CalendarCheck className="h-4 w-4 mr-1" />
              Confirmar agendamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
