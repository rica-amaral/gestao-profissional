import { useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Bell, CalendarDays, Edit, MessageCircle, Pencil, Plus, RefreshCw, Repeat, Trash2, Unlock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useAdminData,
  formatDateBR,
  replaceMsg,
  slotsBetween,
  subtractMinutes,
  isEarlyBlocked,
  isLateBlocked,
  isLunchSlot,
  findAppointments,
  freeSlotsForDate,
  moveAppointment,
  MAX_PER_SLOT,
  isWeekend,
  getEffectiveSchedule,
  isWeekdayLocked,
} from "@/contexts/AdminDataContext";
import type { Appointment, AdherenceEvent, PersonalEvent } from "@/lib/admin-types";
import { whatsappClientHref } from "@/lib/contact";
import { toast } from "@/hooks/use-toast";
import { cn, formatBRL } from "@/lib/utils";

/** Adiciona `min` minutos a um time string "HH:MM". */
function addMinutes(time: string, min: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + min;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export const Schedule = () => {
  const { store, patch } = useAdminData();
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const dateKey = format(selectedDate, "yyyy-MM-dd");

  const [newOpen, setNewOpen] = useState(false);
  const [newTime, setNewTime] = useState<string | null>(null);
  const [newClientId, setNewClientId] = useState<string>("");
  const [newPrice, setNewPrice] = useState("0");
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<"M" | "F" | undefined>(undefined);
  // Modo compromisso pessoal
  const [newIsPersonal, setNewIsPersonal] = useState(false);
  const [newPersonalTitle, setNewPersonalTitle] = useState("");
  const [newPersonalEnd, setNewPersonalEnd] = useState<string>("");
  const [newPersonalAllDay, setNewPersonalAllDay] = useState(false);

  const [editApt, setEditApt] = useState<Appointment | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAbsent, setEditAbsent] = useState(false);

  // Edição inline do horário do grupo
  const [editTimeKey, setEditTimeKey] = useState<string | null>(null);
  const [editTimeInput, setEditTimeInput] = useState("");

  const [rescheduleApt, setRescheduleApt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);

  // Agendamento recorrente
  const [recurOpen, setRecurOpen] = useState(false);
  const [recurIsPersonal, setRecurIsPersonal] = useState(false);
  const [recurTitle, setRecurTitle] = useState("");
  const [recurClientId, setRecurClientId] = useState("");
  const [recurPrice, setRecurPrice] = useState("0");
  const [recurTime, setRecurTime] = useState("09:00");
  const [recurDayOfWeek, setRecurDayOfWeek] = useState("1");
  const [recurInterval, setRecurInterval] = useState("2");
  const [recurStartDate, setRecurStartDate] = useState("");
  const [recurCount, setRecurCount] = useState("8");

  const { settings } = store;

  // Mistura agendamentos reais com slots vazios da grade horária configurada
  const displayItems = useMemo(() => {
    if (isWeekend(dateKey)) return [];
    const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5) || "0");
    const { start: effScheduleStart, end: effScheduleEnd } = getEffectiveSchedule(settings, dateKey);
    const hourSlots = slotsBetween(effScheduleStart, effScheduleEnd, 60);

    // Agrupa agendamentos do dia por horário exato (mesmo horário = duplo)
    const aptGroups: { time: string; apts: Appointment[] }[] = [];
    const sorted = store.appointments
      .filter((a) => a.date === dateKey)
      .sort((a, b) => a.time.localeCompare(b.time));
    for (const apt of sorted) {
      const last = aptGroups[aptGroups.length - 1];
      if (last && last.time === apt.time) last.apts.push(apt);
      else aptGroups.push({ time: apt.time, apts: [apt] });
    }

    // Mapa: horário → nº de pacientes (para calcular duração real)
    const countByTime = new Map<string, number>();
    for (const a of store.appointments) {
      if (a.date === dateKey) countByTime.set(a.time, (countByTime.get(a.time) ?? 0) + 1);
    }

    // Retorna true se o slot T está coberto por agendamento em andamento ou compromisso pessoal
    const personalEvents = settings.personalEvents ?? [];
    const isCovered = (slotTime: string): boolean => {
      const slotMin = toMin(slotTime);
      // Agendamentos clínicos
      for (const [aptTime, count] of countByTime) {
        const aptMin = toMin(aptTime);
        const duration = count >= MAX_PER_SLOT ? 90 : 50;
        if (aptMin <= slotMin && slotMin < aptMin + duration) return true;
      }
      // Compromissos pessoais com horário: bloqueia de time até endTime (ou +60min se sem endTime)
      for (const ev of personalEvents) {
        if (ev.date !== dateKey || ev.allDay) continue;
        const evStart = toMin(ev.time);
        const evEnd = ev.endTime ? toMin(ev.endTime) : evStart + 60;
        if (evStart <= slotMin && slotMin < evEnd) return true;
      }
      return false;
    };

    // Quais horas têm algum agendamento começando nelas?
    const occupiedHours = new Set(
      hourSlots.filter((slot) => {
        const slotMin = toMin(slot);
        return store.appointments.some((a) => {
          if (a.date !== dateKey) return false;
          const m = toMin(a.time);
          return m >= slotMin && m < slotMin + 60;
        });
      })
    );

    type AptItem      = { kind: "apt";      time: string; apts: Appointment[] };
    type EmptyItem    = { kind: "empty";    time: string; status: "free" | "early" | "late" | "lunch" };
    type PersonalItem = { kind: "personal"; time: string; event: (typeof personalEvents)[number] };

    const items: (AptItem | EmptyItem | PersonalItem)[] = [
      // Agendamentos clínicos nos seus horários exatos
      ...aptGroups.map((g) => ({ kind: "apt" as const, time: g.time, apts: g.apts })),
      // Compromissos pessoais com horário
      ...personalEvents
        .filter((ev) => ev.date === dateKey && !ev.allDay)
        .map((ev) => ({ kind: "personal" as const, time: ev.time, event: ev })),
      // Slots vazios: horas sem agendamento, não cobertas e com espaço para 1h de sessão
      ...hourSlots
        .filter((slot) => {
          if (occupiedHours.has(slot) || isCovered(slot)) return false;
          // Só mostra se cabe 1h completa antes do fim da agenda (já considera override do dia)
          return toMin(slot) + 50 <= toMin(effScheduleEnd);
        })
        .map((slot): EmptyItem => {
          if (isEarlyBlocked(slot, settings.earlyBlockUntilHour, dateKey, settings.dayEarlyUnlocked))
            return { kind: "empty", time: slot, status: "early" };
          if (isLateBlocked(slot, dateKey, settings.dayEarlyUnlocked))
            return { kind: "empty", time: slot, status: "late" };
          if (isLunchSlot(slot, settings.lunchStart, settings.lunchEnd))
            return { kind: "empty", time: slot, status: "lunch" };
          return { kind: "empty", time: slot, status: "free" };
        }),
    ];

    return items.sort((a, b) => a.time.localeCompare(b.time));
  }, [store.appointments, dateKey, settings]);

  const allDayEvents = (settings.personalEvents ?? []).filter(
    (ev) => ev.date === dateKey && ev.allDay
  );

  const earlyLocked =
    isEarlyBlocked("07:00", settings.earlyBlockUntilHour, dateKey, settings.dayEarlyUnlocked) &&
    !settings.dayEarlyUnlocked[dateKey];

  const lateLocked = isLateBlocked("19:00", dateKey, settings.dayEarlyUnlocked);

  const toggleDayEarlyUnlock = () => {
    patch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        dayEarlyUnlocked: { ...s.settings.dayEarlyUnlocked, [dateKey]: true },
      },
    }));
    toast({ title: "Manhã liberada", description: "Horários antes das 8h ficam disponíveis neste dia." });
  };

  const toggleDayLateUnlock = () => {
    patch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        dayEarlyUnlocked: { ...s.settings.dayEarlyUnlocked, [dateKey + "_late"]: true },
      },
    }));
    toast({ title: "Noite liberada", description: "19h e 20h ficam disponíveis neste dia." });
  };

  // time=null → novo agendamento sem slot pré-definido (usuário digita o horário)
  // time=string → 2º paciente no mesmo horário
  const openNew = (time: string | null) => {
    if (time !== null) {
      if (isEarlyBlocked(time, settings.earlyBlockUntilHour, dateKey, settings.dayEarlyUnlocked)) {
        toast({
          variant: "destructive",
          title: "Horário bloqueado",
          description: "Libere a manhã deste dia no botão acima para agendar antes das 8h.",
        });
        return;
      }
      if (isLateBlocked(time, dateKey, settings.dayEarlyUnlocked)) {
        toast({
          variant: "destructive",
          title: "Horário bloqueado",
          description: "Libere a noite deste dia no botão acima para agendar às 19h ou 20h.",
        });
        return;
      }
      if (isWeekdayLocked(time, dateKey, settings)) {
        toast({
          variant: "destructive",
          title: "Horário bloqueado",
          description: "Você travou o atendimento fora do horário configurado para este dia da semana.",
        });
        return;
      }
    }
    setNewTime(time);
    setNewClientId("");
    setNewPrice("0");
    setNewName("");
    setNewGender(undefined);
    setNewIsPersonal(false);
    setNewPersonalTitle("");
    setNewPersonalEnd("");
    setNewPersonalAllDay(false);
    setNewOpen(true);
  };

  const onSelectRecurClient = (id: string) => {
    setRecurClientId(id);
    const lastApt = [...store.appointments]
      .filter((a) => a.clientId === id && a.price > 0)
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
      .at(0);
    if (lastApt) setRecurPrice(String(lastApt.price));
    else setRecurPrice("0");
  };

  const openRecur = () => {
    setRecurIsPersonal(false);
    setRecurTitle("");
    setRecurClientId("");
    setRecurPrice("0");
    setRecurTime("09:00");
    setRecurDayOfWeek("1");
    setRecurInterval("2");
    setRecurStartDate(dateKey);
    setRecurCount("8");
    setRecurOpen(true);
  };

  const confirmRecurring = () => {
    if (!recurTime || !recurStartDate) return;
    const intervalWeeks = parseInt(recurInterval) || 1;
    const count = Math.min(parseInt(recurCount) || 1, 52);
    const targetDow = parseInt(recurDayOfWeek); // 1=Seg...5=Sex

    // Avança a partir da data de início até cair no dia da semana escolhido
    const start = new Date(recurStartDate + "T12:00:00");
    let safety = 0;
    while (start.getDay() !== targetDow && safety < 7) {
      start.setDate(start.getDate() + 1);
      safety++;
    }

    // Trava por dia da semana — todas as ocorrências cairão no mesmo dia da semana
    if (isWeekdayLocked(recurTime, format(start, "yyyy-MM-dd"), settings)) {
      toast({
        variant: "destructive",
        title: "Horário bloqueado",
        description: "Você travou o atendimento fora do horário configurado para este dia da semana.",
      });
      return;
    }

    // ── Compromisso pessoal recorrente ──────────────────────────
    if (recurIsPersonal) {
      if (!recurTitle.trim()) return;
      const newEvents: PersonalEvent[] = [];
      const current = new Date(start);
      for (let i = 0; i < count; i++) {
        newEvents.push({
          id: crypto.randomUUID(),
          date: format(current, "yyyy-MM-dd"),
          time: recurTime,
          title: recurTitle.trim(),
        });
        current.setDate(current.getDate() + intervalWeeks * 7);
      }
      patch((s) => ({
        ...s,
        settings: {
          ...s.settings,
          personalEvents: [...(s.settings.personalEvents ?? []), ...newEvents],
        },
      }));
      setRecurOpen(false);
      toast({ title: `${newEvents.length} compromisso(s) "${recurTitle.trim()}" criados` });
      return;
    }

    // ── Agendamento clínico recorrente ──────────────────────────
    if (!recurClientId) return;
    const c = store.clients.find((x) => x.id === recurClientId);
    if (!c) return;
    const priceValue = parseFloat(recurPrice) || 0;

    const newApts: Appointment[] = [];
    const current = new Date(start);
    for (let i = 0; i < count; i++) {
      const dateK = format(current, "yyyy-MM-dd");
      newApts.push({
        id: crypto.randomUUID(),
        date: dateK,
        time: recurTime,
        clientId: c.id,
        clientName: c.name,
        clientPhone: c.phone,
        confirmed: false,
        paid: false,
        price: priceValue,
      });
      current.setDate(current.getDate() + intervalWeeks * 7);
    }

    patch((s) => ({ ...s, appointments: [...s.appointments, ...newApts] }));
    setRecurOpen(false);
    toast({ title: `${newApts.length} agendamentos criados para ${c.name}` });
  };

  const onSelectNewClient = (id: string) => {
    setNewClientId(id);
    if (id === "__new__") { setNewPrice("0"); return; }
    const lastApt = [...store.appointments]
      .filter((a) => a.clientId === id && a.price > 0)
      .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))
      .at(0);
    if (lastApt) setNewPrice(String(lastApt.price));
  };

  const confirmNew = () => {
    // Trava por dia da semana vale mesmo para horário digitado manualmente
    const timeToCheck = newIsPersonal && newPersonalAllDay ? null : newTime;
    if (timeToCheck && isWeekdayLocked(timeToCheck, dateKey, settings)) {
      toast({
        variant: "destructive",
        title: "Horário bloqueado",
        description: "Você travou o atendimento fora do horário configurado para este dia da semana.",
      });
      return;
    }

    // ── Compromisso pessoal ─────────────────────────────────────
    if (newIsPersonal) {
      if (!newPersonalTitle.trim()) return;
      const entry = {
        id: crypto.randomUUID(),
        date: dateKey,
        time: newPersonalAllDay ? "00:00" : (newTime ?? "00:00"),
        ...(newPersonalEnd && !newPersonalAllDay ? { endTime: newPersonalEnd } : {}),
        title: newPersonalTitle.trim(),
        ...(newPersonalAllDay ? { allDay: true } : {}),
      };
      patch((s) => ({
        ...s,
        settings: {
          ...s.settings,
          personalEvents: [...(s.settings.personalEvents ?? []), entry],
        },
      }));
      setNewOpen(false);
      setNewPersonalTitle("");
      toast({ title: "Compromisso adicionado" });
      return;
    }

    if (!newTime) return;
    const priceValue = parseFloat(newPrice) || 0;

    if (newClientId === "__new__") {
      if (!newName.trim()) return;
      const clientId = crypto.randomUUID();
      const aptId = crypto.randomUUID();
      patch((s) => ({
        ...s,
        clients: [...s.clients, { id: clientId, name: newName.trim(), phone: "", paymentPending: false, blocked: false, gender: newGender }],
        appointments: [
          ...s.appointments,
          { id: aptId, date: dateKey, time: newTime, clientId, clientName: newName.trim(), clientPhone: "", confirmed: false, paid: false, price: priceValue },
        ],
      }));
      setNewOpen(false);
      setNewTime(null);
      setNewName("");
      setNewPrice("0");
      setNewGender(undefined);
      toast({ title: `${newName.trim()} cadastrado(a) e agendado(a)` });
      return;
    }

    if (!newClientId) return;
    const c = store.clients.find((x) => x.id === newClientId);
    if (!c) return;
    const existing = findAppointments(store, dateKey, newTime);
    if (existing.length >= MAX_PER_SLOT) {
      toast({ variant: "destructive", title: "Horário lotado", description: `Máximo de ${MAX_PER_SLOT} pacientes por horário.` });
      return;
    }
    if (existing.some((a) => a.clientId === c.id)) {
      toast({ variant: "destructive", title: "Cliente já agendado neste horário" });
      return;
    }
    const id = crypto.randomUUID();
    patch((s) => ({
      ...s,
      appointments: [
        ...s.appointments,
        { id, date: dateKey, time: newTime, clientId: c.id, clientName: c.name, clientPhone: c.phone, confirmed: false, paid: false, price: priceValue },
      ],
    }));
    setNewOpen(false);
    setNewTime(null);
    setNewPrice("0");
    toast({ title: "Agendamento criado" });
  };

  const openEdit = (apt: Appointment) => {
    setEditApt(apt);
    setEditPrice(apt.price?.toString() ?? "0");
    setEditNotes(apt.notes ?? "");
    setEditAbsent(apt.absent ?? false);
  };

  const saveEdit = () => {
    if (!editApt) return;
    const priceValue = parseFloat(editPrice) || 0;
    const wasAbsent = editApt.absent ?? false;

    patch((s) => {
      // Auto-cria evento de aderência ao marcar falta pela primeira vez
      let adherenceEvents = s.adherenceEvents;
      if (editAbsent && !wasAbsent) {
        const ev: AdherenceEvent = {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          clientId: editApt.clientId,
          clientName: editApt.clientName,
          type: "falta",
          note: `Agendamento de ${formatDateBR(editApt.date)} às ${editApt.time}`,
        };
        adherenceEvents = [ev, ...adherenceEvents];
      }
      return {
        ...s,
        appointments: s.appointments.map((a) =>
          a.id === editApt.id
            ? { ...a, price: priceValue, notes: editNotes.trim() || undefined, absent: editAbsent }
            : a
        ),
        adherenceEvents,
      };
    });

    setEditApt(null);
    toast({ title: editAbsent ? "Falta registrada" : "Sessão atualizada" });
  };

  /** Move todos os agendamentos do grupo para o novo horário. */
  const saveTimeEdit = (oldTime: string) => {
    const trimmed = editTimeInput.trim();
    setEditTimeKey(null);
    if (!trimmed || trimmed === oldTime) return;
    patch((s) => ({
      ...s,
      appointments: s.appointments.map((a) =>
        a.date === dateKey && a.time === oldTime ? { ...a, time: trimmed } : a
      ),
    }));
    toast({ title: `Horário alterado para ${trimmed}` });
  };

  const setConfirmed = (id: string, v: boolean) => {
    patch((s) => ({
      ...s,
      appointments: s.appointments.map((a) => (a.id === id ? { ...a, confirmed: v } : a)),
    }));
  };

  const setPaymentMethod = (id: string, method: "pix" | "cartao" | "dinheiro" | "permuta" | undefined) => {
    patch((s) => ({
      ...s,
      appointments: s.appointments.map((a) =>
        a.id === id ? { ...a, paymentMethod: method, paid: !!method } : a
      ),
    }));
  };

  const removeAppointment = (id: string) => {
    patch((s) => ({ ...s, appointments: s.appointments.filter((a) => a.id !== id) }));
    setEditApt(null);
    toast({ title: "Agendamento removido" });
  };

  const openReschedule = (apt: Appointment) => {
    setRescheduleApt(apt);
    setRescheduleDate(undefined);
    setRescheduleTime(null);
  };

  const applyReschedule = () => {
    if (!rescheduleApt || !rescheduleDate || !rescheduleTime) return;
    const nk = format(rescheduleDate, "yyyy-MM-dd");
    const occupants = store.appointments.filter(
      (a) => a.date === nk && a.time === rescheduleTime && a.id !== rescheduleApt.id
    );
    if (occupants.length >= MAX_PER_SLOT) {
      toast({ variant: "destructive", title: "Horário lotado", description: `Máximo de ${MAX_PER_SLOT} pacientes por horário.` });
      return;
    }
    const oldLabel = `${formatDateBR(rescheduleApt.date)} ${rescheduleApt.time}`;
    const newLabel = `${formatDateBR(nk)} ${rescheduleTime}`;
    patch((s) => {
      const moved = moveAppointment(s, rescheduleApt.id, nk, rescheduleTime);
      return {
        ...moved,
        adherenceEvents: [
          ...moved.adherenceEvents,
          {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            clientId: rescheduleApt.clientId,
            clientName: rescheduleApt.clientName,
            type: "reagendamento",
            note: `${oldLabel} → ${newLabel}`,
          },
        ],
      };
    });
    setRescheduleApt(null);
    toast({ title: "Reagendado", description: `${rescheduleApt.clientName}: ${newLabel}` });
  };

  const removePersonalEvent = (id: string) => {
    patch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        personalEvents: (s.settings.personalEvents ?? []).filter((e) => e.id !== id),
      },
    }));
  };

  const freeForReschedule = rescheduleDate
    ? freeSlotsForDate(
        {
          ...store,
          appointments: store.appointments.filter((a) => a.id !== rescheduleApt?.id),
        },
        format(rescheduleDate, "yyyy-MM-dd"),
        {}
      )
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-1">Agenda</h2>
          <p className="text-muted-foreground text-sm">
            Horários reais do banco · simples = 1h · duplo = 1h30
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {earlyLocked && (
            <Button type="button" variant="outline" size="sm" onClick={toggleDayEarlyUnlock} className="shrink-0">
              <Unlock className="h-4 w-4 mr-2" />
              Liberar manhã (antes das 8h) neste dia
            </Button>
          )}
          {lateLocked && (
            <Button type="button" variant="outline" size="sm" onClick={toggleDayLateUnlock} className="shrink-0">
              <Unlock className="h-4 w-4 mr-2" />
              Liberar noite (19h–20h) neste dia
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-6">
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center justify-between gap-2">
              <span className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </span>
              {!isWeekend(dateKey) && (
                <div className="flex gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={openRecur}>
                    <Repeat className="h-4 w-4 mr-1" />
                    Recorrente
                  </Button>
                  <Button type="button" size="sm" onClick={() => openNew(null)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Agendar
                  </Button>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isWeekend(dateKey) ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Sem atendimento aos fins de semana.
              </p>
            ) : (
              <>
                {displayItems.length === 0 && (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    Nenhuma sessão agendada para hoje.
                  </p>
                )}

                {displayItems.map((item) => {
                  // ── Slot vazio ──────────────────────────────────────────
                  if (item.kind === "empty") {
                    const canBook = item.status === "free" || item.status === "lunch";
                    return (
                      <div
                        key={`empty-${item.time}`}
                        className={cn(
                          "rounded-lg border px-3 py-2 flex items-center justify-between gap-2",
                          item.status === "free"  && "border-border bg-muted/20",
                          item.status === "lunch" && "border-amber-500/30 bg-amber-500/5",
                          (item.status === "early" || item.status === "late") && "border-destructive/20 bg-destructive/5",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-semibold tabular-nums text-sm text-foreground">{item.time}</span>
                          <span className="text-xs text-muted-foreground">
                            {item.status === "free"  && "Disponível"}
                            {item.status === "lunch" && "Almoço — pode agendar"}
                            {item.status === "early" && "Manhã bloqueada"}
                            {item.status === "late"  && "Noite bloqueada"}
                          </span>
                        </div>
                        {canBook && (
                          <Button type="button" size="sm" variant="secondary" onClick={() => openNew(item.time)}>
                            Agendar
                          </Button>
                        )}
                      </div>
                    );
                  }

                  // ── Compromisso pessoal com horário ────────────────────
                  if (item.kind === "personal") {
                    const { event: ev } = item;
                    const label = ev.endTime ? `${ev.time} → ${ev.endTime}` : ev.time;
                    return (
                      <div key={`pe-${ev.id}`} className="rounded-lg border border-violet-500/30 bg-violet-500/5 px-3 py-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-sm font-semibold tabular-nums text-violet-700 shrink-0">{label}</span>
                          <span className="text-sm text-foreground truncate">{ev.title}</span>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={() => removePersonalEvent(ev.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  }

                  // ── Agendamento clínico ─────────────────────────────────
                  const { time, apts } = item;
                  const isDuplo = apts.length >= 2;
                  const endTime = addMinutes(time, isDuplo ? 90 : 50);

                  return (
                    <div key={time} className="rounded-lg border border-border bg-card p-3 space-y-2">
                      {/* Cabeçalho: intervalo real + badge + edição inline de horário + 2º paciente */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          {editTimeKey === time ? (
                            <>
                              <Input
                                type="time"
                                value={editTimeInput}
                                onChange={(e) => setEditTimeInput(e.target.value)}
                                className="w-28 h-7 text-sm font-bold text-primary"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") saveTimeEdit(time);
                                  if (e.key === "Escape") setEditTimeKey(null);
                                }}
                              />
                              <Button type="button" size="sm" className="h-7 px-2" onClick={() => saveTimeEdit(time)}>OK</Button>
                              <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditTimeKey(null)}>✕</Button>
                            </>
                          ) : (
                            <>
                              <span className="font-bold text-primary tabular-nums text-base">{time}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5 text-muted-foreground hover:text-foreground"
                                title="Editar horário"
                                onClick={() => { setEditTimeKey(time); setEditTimeInput(time); }}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <span className="text-sm text-muted-foreground tabular-nums">→ {endTime}</span>
                            </>
                          )}
                          {isDuplo && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-700 font-medium">
                              duplo
                            </span>
                          )}
                        </div>
                        {!isDuplo && (
                          <Button type="button" size="sm" variant="secondary" onClick={() => openNew(time)}>
                            + 2º paciente
                          </Button>
                        )}
                      </div>

                      {/* Um card por paciente no grupo */}
                      {apts.map((apt) => {
                        const msgBase = { nome: apt.clientName, data: formatDateBR(dateKey), hora: time };
                        const client = store.clients.find((c) => c.id === apt.clientId);
                        const age = client?.birthDate
                          ? Math.floor((Date.now() - new Date(client.birthDate + "T12:00:00").getTime()) / 31557600000)
                          : null;
                        const todayKey = format(new Date(Date.now() - 3 * 60 * 60 * 1000), "yyyy-MM-dd");
                        const isFuture = apt.date > todayKey;
                        return (
                          <div key={apt.id} className="pl-2 border-l-2 border-border space-y-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild title="Confirmação">
                                <a href={whatsappClientHref(apt.clientPhone, replaceMsg(settings.messageConfirmation, msgBase))} target="_blank" rel="noopener noreferrer">
                                  <MessageCircle className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" asChild title="Lembrete">
                                <a href={whatsappClientHref(apt.clientPhone, replaceMsg(settings.messageReminder, msgBase))} target="_blank" rel="noopener noreferrer">
                                  <Bell className="h-3.5 w-3.5" />
                                </a>
                              </Button>
                              <div className="flex items-baseline gap-1.5 min-w-0 flex-1">
                                <p className="font-semibold text-sm text-foreground truncate leading-tight">{apt.clientName}</p>
                                {age !== null && <span className="text-xs text-muted-foreground shrink-0">{age}a</span>}
                                {apt.price > 0 && <span className="text-xs font-medium text-green-700 shrink-0">· {formatBRL(apt.price)}</span>}
                              </div>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Editar" onClick={() => openEdit(apt)}>
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Reagendar" onClick={() => openReschedule(apt)}>
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap pl-1">
                              <div className="flex items-center gap-1.5">
                                <Switch id={`c-${apt.id}`} checked={apt.confirmed} onCheckedChange={(v) => setConfirmed(apt.id, v)} className="scale-90" />
                                <Label htmlFor={`c-${apt.id}`} className="text-xs cursor-pointer">Confirmado</Label>
                              </div>
                              {apt.absent ? (
                                <span className="text-xs font-semibold px-2 py-1 rounded border border-red-400/50 bg-red-500/10 text-red-600">
                                  Falta
                                </span>
                              ) : isFuture && !apt.paymentMethod ? (
                                <span className="text-xs text-muted-foreground px-2 py-1 rounded border border-border bg-muted/40">
                                  Planejado
                                </span>
                              ) : (
                                <Select
                                  value={apt.paymentMethod ?? "none"}
                                  onValueChange={(v) => setPaymentMethod(apt.id, v === "none" ? undefined : v as NonNullable<typeof apt.paymentMethod>)}
                                >
                                  <SelectTrigger className={cn("h-7 text-xs w-28", apt.paymentMethod ? "border-green-500/60 bg-green-500/10 text-green-700" : "")}>
                                    <SelectValue placeholder="Não pago" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="none">Não pago</SelectItem>
                                    <SelectItem value="pix">Pix</SelectItem>
                                    <SelectItem value="cartao">Cartão</SelectItem>
                                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                                    <SelectItem value="permuta">Permuta</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}

            {/* ── Tarefas do dia (sem horário) ── */}
            {!isWeekend(dateKey) && allDayEvents.length > 0 && (
              <div className="pt-3 border-t border-border space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tarefas do dia</p>
                {allDayEvents.map((ev) => (
                  <div key={ev.id} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-1.5">
                    <span className="text-sm text-foreground truncate">{ev.title}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-destructive hover:text-destructive" onClick={() => removePersonalEvent(ev.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border h-fit">
          <CardHeader>
            <CardTitle className="text-base">Calendário</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(d) => d && setSelectedDate(d)}
              locale={ptBR}
              disabled={(d) => [0, 6].includes(d.getDay())}
              className="rounded-md border pointer-events-auto"
            />
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: novo agendamento ── */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo agendamento</DialogTitle>
            <DialogDescription>{formatDateBR(dateKey)}</DialogDescription>
          </DialogHeader>
          {/* Toggle clínico / pessoal */}
          <div className="flex gap-2 pb-1">
            <Button type="button" size="sm" variant={!newIsPersonal ? "default" : "outline"} onClick={() => setNewIsPersonal(false)}>
              Clínico
            </Button>
            <Button type="button" size="sm" variant={newIsPersonal ? "default" : "outline"} onClick={() => setNewIsPersonal(true)}>
              Pessoal
            </Button>
          </div>

          {newIsPersonal ? (
            /* ── Campos pessoais ── */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Ex: Reunião, Academia, Médico..."
                  value={newPersonalTitle}
                  onChange={(e) => setNewPersonalTitle(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch id="allday" checked={newPersonalAllDay} onCheckedChange={setNewPersonalAllDay} />
                <Label htmlFor="allday" className="cursor-pointer">Sem horário específico (tarefa do dia)</Label>
              </div>
              {!newPersonalAllDay && (
                <div className="flex gap-3">
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input type="time" value={newTime ?? ""} onChange={(e) => setNewTime(e.target.value)} className="w-28" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input type="time" value={newPersonalEnd} onChange={(e) => setNewPersonalEnd(e.target.value)} className="w-28" />
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* ── Campos clínicos ── */
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={newTime ?? ""} onChange={(e) => setNewTime(e.target.value)} className="w-32" />
              </div>
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={newClientId} onValueChange={onSelectNewClient}>
                  <SelectTrigger><SelectValue placeholder="— selecione ou cadastre —" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__new__">✚ Cadastrar novo cliente</SelectItem>
                    {[...store.clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {newClientId === "__new__" && (
                <>
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input placeholder="Nome completo" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                  </div>
                  <div className="space-y-2">
                    <Label>Sexo</Label>
                    <div className="flex gap-2">
                      {(["M", "F"] as const).map((g) => (
                        <Button key={g} type="button" size="sm" variant={newGender === g ? "default" : "outline"} className="w-12"
                          onClick={() => setNewGender(newGender === g ? undefined : g)}>{g}</Button>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input type="number" min="0" step="10" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} placeholder="0" />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button
              onClick={confirmNew}
              disabled={
                newIsPersonal
                  ? !newPersonalTitle.trim() || (!newPersonalAllDay && !newTime)
                  : !newTime || !newClientId || (newClientId === "__new__" && !newName.trim())
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Sheet: editar agendamento ── */}
      <Sheet open={!!editApt} onOpenChange={(o) => !o && setEditApt(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar agendamento</SheetTitle>
            <SheetDescription>
              {editApt && <>{formatDateBR(editApt.date)} às {editApt.time}</>}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {editApt && (
              <p className="text-sm font-medium text-foreground">{editApt.clientName}</p>
            )}
            {/* Toggle de falta */}
            <div className={cn(
              "flex items-center gap-3 rounded-lg border px-4 py-3",
              editAbsent ? "border-red-400/50 bg-red-500/8" : "border-border bg-muted/30"
            )}>
              <Switch
                id="edit-absent"
                checked={editAbsent}
                onCheckedChange={setEditAbsent}
              />
              <div>
                <Label htmlFor="edit-absent" className="cursor-pointer font-medium">
                  {editAbsent ? "Falta registrada" : "Marcar como falta"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  Não gera pendência financeira. Multa (se houver) pode ser lançada no valor abaixo.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{editAbsent ? "Valor da multa (R$) — opcional" : "Valor desta sessão (R$)"}</Label>
              <Input type="number" step="0.01" min="0" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
              {!editAbsent && <p className="text-xs text-muted-foreground">Não altera o valor padrão do cadastro. Para editar dados do cliente use a aba Clientes.</p>}
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={4} />
            </div>
          </div>
          <SheetFooter className="flex-col gap-2 sm:flex-col">
            <Button type="button" onClick={saveEdit}>
              Salvar alterações
            </Button>
            <Button type="button" variant="destructive" onClick={() => editApt && removeAppointment(editApt.id)}>
              Excluir agendamento
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Dialog: agendamento recorrente ── */}
      <Dialog open={recurOpen} onOpenChange={setRecurOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendamento recorrente</DialogTitle>
            <DialogDescription>Cria múltiplos agendamentos com intervalo semanal fixo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Toggle clínico / pessoal */}
            <div className="flex gap-2">
              <Button type="button" size="sm" variant={!recurIsPersonal ? "default" : "outline"} onClick={() => setRecurIsPersonal(false)}>
                Clínico
              </Button>
              <Button type="button" size="sm" variant={recurIsPersonal ? "default" : "outline"} onClick={() => setRecurIsPersonal(true)}>
                Pessoal
              </Button>
            </div>

            {recurIsPersonal ? (
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  placeholder="Ex: Yoga, Academia, Médico..."
                  value={recurTitle}
                  onChange={(e) => setRecurTitle(e.target.value)}
                  autoFocus
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select value={recurClientId} onValueChange={onSelectRecurClient}>
                  <SelectTrigger><SelectValue placeholder="— selecione —" /></SelectTrigger>
                  <SelectContent>
                    {[...store.clients].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horário</Label>
                <Input type="time" value={recurTime} onChange={(e) => setRecurTime(e.target.value)} />
              </div>
              {!recurIsPersonal && (
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input type="number" min="0" step="10" value={recurPrice} onChange={(e) => setRecurPrice(e.target.value)} />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Dia da semana</Label>
                <Select value={recurDayOfWeek} onValueChange={setRecurDayOfWeek}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Segunda-feira</SelectItem>
                    <SelectItem value="2">Terça-feira</SelectItem>
                    <SelectItem value="3">Quarta-feira</SelectItem>
                    <SelectItem value="4">Quinta-feira</SelectItem>
                    <SelectItem value="5">Sexta-feira</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>A cada (semanas)</Label>
                <Select value={recurInterval} onValueChange={setRecurInterval}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 semana</SelectItem>
                    <SelectItem value="2">2 semanas</SelectItem>
                    <SelectItem value="3">3 semanas</SelectItem>
                    <SelectItem value="4">4 semanas</SelectItem>
                    <SelectItem value="6">6 semanas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Data de início</Label>
                <Input type="date" value={recurStartDate} onChange={(e) => setRecurStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Nº de sessões</Label>
                <Input type="number" min="1" max="52" value={recurCount} onChange={(e) => setRecurCount(e.target.value)} />
              </div>
            </div>
            {/* Preview das datas */}
            {(recurIsPersonal ? recurTitle.trim() : recurClientId) && recurTime && recurStartDate && (() => {
              const targetDow = parseInt(recurDayOfWeek);
              const cur = new Date(recurStartDate + "T12:00:00");
              let safety = 0;
              while (cur.getDay() !== targetDow && safety < 7) {
                cur.setDate(cur.getDate() + 1);
                safety++;
              }
              const iw = parseInt(recurInterval) || 1;
              const n = Math.min(parseInt(recurCount) || 0, 52);
              const dates: string[] = [];
              for (let i = 0; i < n; i++) {
                dates.push(format(new Date(cur), "dd/MM/yyyy", { locale: ptBR }));
                cur.setDate(cur.getDate() + iw * 7);
              }
              return (
                <div className="rounded-lg bg-muted/50 border border-border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {n} sessão(ões) às {recurTime}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {dates.map((d, i) => (
                      <span key={i} className="text-xs px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary font-medium">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecurOpen(false)}>Cancelar</Button>
            <Button
              onClick={confirmRecurring}
              disabled={
                (recurIsPersonal ? !recurTitle.trim() : !recurClientId) ||
                !recurTime || !recurStartDate || parseInt(recurCount) < 1
              }
            >
              Criar {recurCount} {recurIsPersonal ? "compromissos" : "agendamentos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: reagendar ── */}
      <Dialog open={!!rescheduleApt} onOpenChange={(o) => !o && setRescheduleApt(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reagendar</DialogTitle>
            <DialogDescription>
              {rescheduleApt?.clientName} — escolha a nova data e um horário vago.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-2">
            <Calendar
              mode="single"
              selected={rescheduleDate}
              onSelect={(d) => {
                setRescheduleDate(d);
                setRescheduleTime(null);
              }}
              locale={ptBR}
              disabled={(d) => [0, 6].includes(d.getDay())}
              className="rounded-md border"
            />
          </div>
          {rescheduleDate && (
            <div className="space-y-2">
              <Label>Horários vagos</Label>
              <div className="flex flex-wrap gap-2">
                {freeForReschedule.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    Nenhum horário livre nesta data (ajuste bloqueios ou outro dia).
                  </p>
                )}
                {freeForReschedule.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={rescheduleTime === t ? "default" : "outline"}
                    onClick={() => setRescheduleTime(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleApt(null)}>
              Cancelar
            </Button>
            <Button onClick={applyReschedule} disabled={!rescheduleDate || !rescheduleTime}>
              Confirmar mudança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
