import React, {
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
import { supabase } from "@/integrations/supabase/client";

type Ctx = {
  store: AdminStore;
  patch: (fn: (s: AdminStore) => AdminStore) => void;
  loading: boolean;
  reload: () => Promise<void>;
};

const AdminDataContext = createContext<Ctx | null>(null);

// Chave localStorage por usuário — backup de emergência
const localKey = (uid: string) => `gp_store_${uid}`;

async function saveWithRetry(
  confirmedRef: React.MutableRefObject<AdminStore>,
  next: AdminStore,
  attempts = 3,
): Promise<void> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      // Sempre diff a partir do último estado CONFIRMADO no Supabase
      await saveAdminStore(confirmedRef.current, next);
      confirmedRef.current = next; // marca como confirmado
      return;
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AdminStore>(() => defaultAdminStore());
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState(false);

  // Último estado confirmado no Supabase — base para diffs futuros
  const confirmedRef = useRef<AdminStore>(defaultAdminStore());
  // Fila serializada — evita concorrência entre saves
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const userIdRef = useRef<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);

    // CRÍTICO: o reload só pode rodar depois que TODAS as gravações
    // pendentes na fila tiverem sido confirmadas. Caso contrário ele
    // sobrescreve confirmedRef/store com um snapshot desatualizado do
    // servidor enquanto um save ainda está em trânsito — e o save em
    // trânsito, ao terminar, faz diff contra esse snapshot já obsoleto,
    // apagando ou duplicando agendamentos (inclusive futuros).
    const runLoad = async () => {
      try {
        const loaded = await loadAdminStore();
        confirmedRef.current = loaded;
        setSyncError(false);

        // Verifica backup localStorage: re-insere itens que faltam no Supabase
        const uid = userIdRef.current;
        if (uid) {
          try {
            const raw = localStorage.getItem(localKey(uid));
            if (raw) {
              const backup: AdminStore = JSON.parse(raw);
              const loadedIds = new Set(loaded.appointments.map((a) => a.id));
              const missing = backup.appointments.filter((a) => !loadedIds.has(a.id));
              if (missing.length > 0) {
                console.warn(`Recuperando ${missing.length} agendamento(s) do backup local...`);
                loaded.appointments = [...loaded.appointments, ...missing];
                // Re-salva e só então marca como confirmado — tudo dentro
                // do mesmo slot da fila, sem concorrência com outros saves.
                await saveWithRetry(confirmedRef, loaded);
                confirmedRef.current = loaded;
              } else {
                localStorage.removeItem(localKey(uid));
              }
            }
          } catch {}
        }

        setStore(loaded);
      } catch (e) {
        console.error("Falha ao carregar dados:", e);
        toast.error("Não foi possível carregar seus dados. Tente recarregar a página.");
      }
    };

    // Encadeia na mesma fila serializada usada pelos saves (patch/saveWithRetry).
    // Assim o reload espera o que já está pendente terminar, e qualquer save
    // disparado depois (por um patch concorrente) só roda após o reload —
    // sempre fazendo diff a partir do confirmedRef recém-atualizado.
    const chained = saveQueueRef.current.then(runLoad, runLoad);
    saveQueueRef.current = chained.catch(() => {});

    try {
      await chained;
    } finally {
      setLoading(false);
    }
  }, []);

  // Captura userId ao montar
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      userIdRef.current = data.user?.id ?? null;
    });
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const patch = useCallback((fn: (s: AdminStore) => AdminStore) => {
    setStore((prev) => {
      const next = fn(prev);

      // Salva snapshot no localStorage imediatamente (antes do async)
      const uid = userIdRef.current;
      if (uid) {
        try { localStorage.setItem(localKey(uid), JSON.stringify(next)); } catch {}
      }

      // Empurra na fila serializada com retry automático
      saveQueueRef.current = saveQueueRef.current
        .then(() => saveWithRetry(confirmedRef, next))
        .then(() => {
          setSyncError(false);
          if (uid) localStorage.removeItem(localKey(uid));
        })
        .catch((err) => {
          console.error("Falha ao salvar após retentativas:", err);
          setSyncError(true);
          toast.error("Sem conexão com o servidor. Dados salvos localmente — sincronizará quando reconectar.");
        });

      return next;
    });
  }, []);

  // Tenta re-sincronizar quando conexão volta
  useEffect(() => {
    if (!syncError) return;
    const onOnline = () => {
      setSyncError(false);
      void reload();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncError, reload]);

  const value = useMemo(
    () => ({ store, patch, loading, reload }),
    [store, patch, loading, reload],
  );

  return (
    <AdminDataContext.Provider value={value}>
      {syncError && (
        <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          <span className="h-2 w-2 animate-pulse rounded-full bg-white" />
          Dados salvos localmente — aguardando conexão
        </div>
      )}
      {children}
    </AdminDataContext.Provider>
  );
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

/**
 * Retorna o horário de início/fim efetivo para uma data, considerando
 * eventual override por dia da semana (settings.weekdayOverrides).
 * Quando não há override para o dia, cai no scheduleStart/scheduleEnd globais.
 */
export function getEffectiveSchedule(
  settings: { scheduleStart: string; scheduleEnd: string; weekdayOverrides?: Record<string, { start?: string; end?: string }> },
  dateKey: string
): { start: string; end: string } {
  const dow = new Date(dateKey + "T12:00:00").getDay();
  const ov = settings.weekdayOverrides?.[String(dow)];
  return {
    start: ov?.start || settings.scheduleStart,
    end: ov?.end || settings.scheduleEnd,
  };
}

/**
 * Verifica se um horário viola a trava configurada por dia da semana.
 * Diferente do scheduleStart/scheduleEnd globais (apenas indicativos),
 * quando há um weekdayOverride para o dia, ele é uma trava DURA — não
 * permite agendar (clínico, pessoal ou recorrente) fora do intervalo.
 */
export function isWeekdayLocked(
  time: string,
  dateKey: string,
  settings: { weekdayOverrides?: Record<string, { start?: string; end?: string }> }
): boolean {
  const dow = new Date(dateKey + "T12:00:00").getDay();
  const ov = settings.weekdayOverrides?.[String(dow)];
  if (!ov) return false;
  const toMin = (t: string) => parseInt(t.slice(0, 2)) * 60 + parseInt(t.slice(3, 5) || "0");
  const tMin = toMin(time);
  if (ov.start && tMin < toMin(ov.start)) return true;
  if (ov.end && tMin >= toMin(ov.end)) return true;
  return false;
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
  const { earlyBlockUntilHour, lunchStart, lunchEnd, dayEarlyUnlocked } = store.settings;
  const { start: scheduleStart, end: scheduleEnd } = getEffectiveSchedule(store.settings, dateKey);
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

/** Quantidade de meses sem consulta a partir da qual o cliente é considerado inativo. */
export const STALE_CLIENT_MONTHS = 6;

/**
 * Retorna true se o cliente já teve ao menos uma consulta registrada (manual
 * ou via agendamento) e essa última consulta foi há mais de `months` meses
 * em relação a `todayKey`. Clientes sem nenhuma consulta registrada não são
 * considerados "inativos" por este critério (não há referência de data).
 */
export function isStaleClient(
  client: Client,
  appointments: { clientId: string; date: string }[],
  todayKey: string = todayKeyBRT(),
  months: number = STALE_CLIENT_MONTHS
): boolean {
  const li = effectiveLastVisitDate(client, appointments, todayKey);
  if (!li) return false;
  const cutoff = new Date(todayKey + "T12:00:00");
  cutoff.setMonth(cutoff.getMonth() - months);
  return new Date(li + "T12:00:00") < cutoff;
}

/** Data de hoje no fuso America/Sao_Paulo via Intl API */
export function todayKeyBRT(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // retorna "YYYY-MM-DD" diretamente
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
