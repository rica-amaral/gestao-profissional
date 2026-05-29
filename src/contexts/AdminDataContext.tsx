import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import type {
  AdminStore,
  Appointment,
  Client,
  EvaluationRecord,
} from "@/lib/admin-types";
import { defaultAdminStore } from "@/lib/admin-types";
import { loadAdminStore, saveAdminStore } from "@/lib/admin-persist";

type Ctx = {
  store: AdminStore;
  patch: (fn: (s: AdminStore) => AdminStore) => void;
  loading: boolean;
  reload: () => Promise<void>;
};

const AdminDataContext = createContext<Ctx | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AdminStore>(() => defaultAdminStore());
  const [loading, setLoading] = useState(true);
  // Fila de saves serializada — evita race conditions quando o usuário faz
  // várias edições em sequência (cada save espera o anterior terminar).
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const next = await loadAdminStore();
      setStore(next);
    } catch (e) {
      console.error("Falha ao carregar dados:", e);
      toast.error("Não foi possível carregar seus dados. Tente recarregar a página.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback((fn: (s: AdminStore) => AdminStore) => {
    setStore((prev) => {
      const next = fn(prev);
      // Empurra o save pro final da fila (sequencial)
      saveQueueRef.current = saveQueueRef.current
        .then(() => saveAdminStore(prev, next))
        .catch((err) => {
          console.error("Falha ao salvar no Supabase:", err);
          toast.error(
            "Erro ao salvar no servidor. Sua alteração local foi mantida — recarregue a página para sincronizar."
          );
        });
      return next;
    });
  }, []);

  const value = useMemo(() => ({ store, patch, loading, reload }), [store, patch, loading, reload]);

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error("useAdminData must be used within AdminDataProvider");
  return ctx;
}

// ===================================================================
// Helpers puros (não interagem com Supabase) — usados pelos componentes
// ===================================================================

export function formatDateBR(isoDate: string) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function replaceMsg(
  tpl: string,
  vars: { nome: string; data: string; hora: string; clinica?: string }
) {
  return tpl
    .replaceAll("{nome}", vars.nome)
    .replaceAll("{data}", vars.data)
    .replaceAll("{hora}", vars.hora)
    .replaceAll("{clinica}", vars.clinica ?? "");
}

export function hoursBetween(start: string, end: string): string[] {
  return slotsBetween(start, end, 60);
}

/** Gera slots de `stepMin` em `stepMin` minutos entre start e end (inclusive). */
export function slotsBetween(start: string, end: string, stepMin = 30): string[] {
  const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5) || "0");
  const toTime = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  const out: string[] = [];
  for (let m = toMin(start); m <= toMin(end); m += stepMin) out.push(toTime(m));
  return out;
}

/** Subtrai `minBack` minutos de um time string "HH:MM". Retorna null se negativo. */
export function subtractMinutes(time: string, minBack: number): string | null {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m - minBack;
  if (total < 0) return null;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function hourNum(time: string) {
  return Number.parseInt(time.slice(0, 2), 10);
}

export function isLunchSlot(time: string, lunchStart: string, lunchEnd: string) {
  return time >= lunchStart && time < lunchEnd;
}

/** Horário mínimo a partir do qual os slots noturnos ficam bloqueados por padrão. */
export const LATE_BLOCK_FROM_HOUR = 19;

export function isEarlyBlocked(
  time: string,
  earlyUntil: number,
  dateKey: string,
  dayEarlyUnlocked: Record<string, boolean>
) {
  if (dayEarlyUnlocked[dateKey]) return false;
  return hourNum(time) < earlyUntil;
}

export function isLateBlocked(
  time: string,
  dateKey: string,
  dayEarlyUnlocked: Record<string, boolean>
) {
  if (dayEarlyUnlocked[dateKey + "_late"]) return false;
  return hourNum(time) >= LATE_BLOCK_FROM_HOUR;
}

/** Retorna o PRIMEIRO agendamento no slot (compat. legado). */
export function findAppointment(store: AdminStore, date: string, time: string) {
  return store.appointments.find((a) => a.date === date && a.time === time);
}

/** Retorna TODOS os agendamentos num slot (pode ter 0, 1 ou 2). */
export function findAppointments(store: AdminStore, date: string, time: string): Appointment[] {
  return store.appointments.filter((a) => a.date === date && a.time === time);
}

/** Retorna todos os agendamentos que COMEÇAM dentro do slot de 1h [slotTime, slotTime+60min). */
export function appointmentsInHour(store: AdminStore, date: string, slotTime: string): Appointment[] {
  const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5) || "0");
  const slotMin = toMin(slotTime);
  return store.appointments.filter((a) => {
    if (a.date !== date) return false;
    const aptMin = toMin(a.time);
    return aptMin >= slotMin && aptMin < slotMin + 60;
  });
}

/** Máximo de clientes permitidos por slot. */
export const MAX_PER_SLOT = 2;

/** Retorna true se a data (yyyy-MM-dd) cair num sábado ou domingo. */
export function isWeekend(dateKey: string): boolean {
  const day = new Date(dateKey + "T12:00:00").getDay();
  return day === 0 || day === 6;
}

export function freeSlotsForDate(
  store: AdminStore,
  dateKey: string,
  opts?: { suggestOnly?: boolean; emptyOnly?: boolean }
): string[] {
  if (isWeekend(dateKey)) return [];
  const { scheduleStart, scheduleEnd, earlyBlockUntilHour, lunchStart, lunchEnd, dayEarlyUnlocked } =
    store.settings;
  const all = slotsBetween(scheduleStart, scheduleEnd, 60);
  const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5) || "0");

  // Contagem de pacientes por horário exato (define duração: duplo=90min, simples=50min)
  const countByTime = new Map<string, number>();
  for (const a of store.appointments) {
    if (a.date === dateKey) countByTime.set(a.time, (countByTime.get(a.time) ?? 0) + 1);
  }

  // Quantos pacientes COMEÇAM dentro do slot de 1h (para checar se está cheio)
  const countInHour = (slotTime: string): number => {
    const slotMin = toMin(slotTime);
    return store.appointments.filter((a) => {
      if (a.date !== dateKey) return false;
      const m = toMin(a.time);
      return m >= slotMin && m < slotMin + 60;
    }).length;
  };

  // Retorna true se T está dentro de uma sessão clínica ou compromisso pessoal em andamento
  const isCovered = (slotTime: string): boolean => {
    const slotMin = toMin(slotTime);
    // Sessões clínicas
    for (const [aptTime, count] of countByTime) {
      const aptMin = toMin(aptTime);
      const duration = count >= MAX_PER_SLOT ? 90 : 50;
      if (aptMin <= slotMin && slotMin < aptMin + duration) return true;
    }
    // Compromissos pessoais com horário
    for (const ev of store.settings.personalEvents ?? []) {
      if (ev.date !== dateKey || ev.allDay) continue;
      const evStart = toMin(ev.time);
      const evEnd = ev.endTime ? toMin(ev.endTime) : evStart + 60;
      if (evStart <= slotMin && slotMin < evEnd) return true;
    }
    return false;
  };

  return all.filter((t) => {
    const count = countInHour(t);
    if (count >= MAX_PER_SLOT) return false;
    if (opts?.emptyOnly && count > 0) return false;
    if (isCovered(t)) return false;
    if (isEarlyBlocked(t, earlyBlockUntilHour, dateKey, dayEarlyUnlocked)) return false;
    if (isLateBlocked(t, dateKey, dayEarlyUnlocked)) return false;
    if (opts?.suggestOnly && isLunchSlot(t, lunchStart, lunchEnd)) return false;
    // Só sugere se couber 50min antes do fim da agenda
    if (toMin(t) + 50 > toMin(scheduleEnd)) return false;
    return true;
  });
}

export function effectiveLastVisitDate(
  client: Client,
  appointments: { clientId: string; date: string }[],
  todayKey: string = todayKeyBRT()
): string | null {
  const manual = client.lastVisitDate?.trim() || null;
  const pastDates = appointments
    .filter((a) => a.clientId === client.id && a.date <= todayKey)
    .map((a) => a.date);
  const maxApt = pastDates.length ? [...pastDates].sort().pop()! : null;
  if (!maxApt && !manual) return null;
  if (!maxApt) return manual;
  if (!manual) return maxApt;
  return maxApt > manual ? maxApt : manual;
}

export function daysSinceLastVisit(
  client: Client,
  appointments: { clientId: string; date: string }[] = [],
  todayKey: string = todayKeyBRT()
): number | null {
  const iso = effectiveLastVisitDate(client, appointments, todayKey);
  if (!iso) return null;
  const a = new Date(iso + "T12:00:00");
  const b = new Date();
  const diff = Math.floor((b.getTime() - a.getTime()) / 86400000);
  return diff < 0 ? 0 : diff;
}

/** Data de hoje no fuso local do browser (BRT no Brasil) */
export function todayKeyBRT(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function birthdaysToday(clients: Client[]): Client[] {
  const today = todayKeyBRT();
  const m = today.slice(5, 7);
  const d = today.slice(8, 10);
  return clients.filter((c) => c.birthDate?.endsWith(`-${m}-${d}`));
}

/** Retorna clientes com aniversário nos próximos `days` dias (excluindo hoje). */
export function birthdaysUpcoming(clients: Client[], days = 7): { client: Client; dateKey: string; daysUntil: number }[] {
  const today = todayKeyBRT();
  const results: { client: Client; dateKey: string; daysUntil: number }[] = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(today + "T12:00:00");
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const m = key.slice(5, 7);
    const day = key.slice(8, 10);
    clients.forEach((c) => {
      if (c.birthDate?.endsWith(`-${m}-${day}`)) {
        results.push({ client: c, dateKey: key, daysUntil: i });
      }
    });
  }
  return results;
}

export function evaluationKey(clientId: string, date: string) {
  return `${clientId}__${date}`;
}

export function hasEvaluation(store: AdminStore, clientId: string, date: string) {
  return store.evaluations.some((e) => e.clientId === clientId && e.date === date);
}

export function nextEvalSeq(store: AdminStore) {
  return store.nextEvalSeq;
}

export function appendEvaluation(
  store: AdminStore,
  rec: Omit<EvaluationRecord, "id" | "seq" | "createdAt">
): AdminStore {
  const seq = store.nextEvalSeq;
  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  return {
    ...store,
    nextEvalSeq: seq + 1,
    evaluations: [...store.evaluations, { ...rec, id, seq, createdAt }],
  };
}

/** Move o horário e sempre zera a confirmação (nova data exige confirmar de novo). */
export function moveAppointment(
  store: AdminStore,
  id: string,
  newDate: string,
  newTime: string
): AdminStore {
  return {
    ...store,
    appointments: store.appointments.map((a) =>
      a.id === id ? { ...a, date: newDate, time: newTime, confirmed: false } : a
    ),
  };
}

export type { Appointment, Client };
