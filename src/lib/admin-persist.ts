import { supabase } from "@/integrations/supabase/client";
import type {
  AdminStore,
  Client,
  ClientHealthData,
  Appointment,
  AdherenceEvent,
  EvaluationRecord,
  WaitlistEntry,
  ClinicSettings,
  ServicePlan,
  PersonalEvent,
  Expense,
} from "./admin-types";
import { defaultAdminStore, defaultClinicSettings } from "./admin-types";

// ===================================================================
// Mapeamento entre camelCase (frontend) e snake_case (Supabase)
// ===================================================================

type ClientRow = {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  birth_date: string | null;
  email: string | null;
  profession: string | null;
  city: string | null;
  gender: 'M' | 'F' | 'O' | null;
  notes: string | null;
  payment_pending: boolean;
  blocked: boolean;
  last_visit_date: string | null;
  health_data: unknown | null;
};

type AppointmentRow = {
  id: string;
  owner_id: string;
  client_id: string;
  date: string;
  time: string;
  confirmed: boolean;
  paid: boolean;
  payment_method: "pix" | "cartao" | "dinheiro" | "permuta" | null;
  price: number;
  notes: string | null;
  absent: boolean | null;
};

type EvaluationRow = {
  id: string;
  owner_id: string;
  client_id: string;
  seq: number;
  date: string;
  notes: string | null;
  details: unknown;
  created_at: string;
};

type AdherenceRow = {
  id: string;
  owner_id: string;
  client_id: string;
  type: "falta" | "cancelamento" | "reagendamento";
  at: string;
  note: string | null;
};

type WaitlistRow = {
  id: string;
  owner_id: string;
  client_id: string;
  notes: string | null;
  requested_at: string;
};

const waitlistFromRow = (r: WaitlistRow, clientName: string, clientPhone: string): WaitlistEntry => ({
  id: r.id,
  clientId: r.client_id,
  clientName,
  clientPhone,
  notes: r.notes ?? undefined,
  requestedAt: r.requested_at,
});

const waitlistToRow = (w: WaitlistEntry, ownerId: string) => ({
  id: w.id,
  owner_id: ownerId,
  client_id: w.clientId,
  notes: w.notes || null,
  requested_at: w.requestedAt,
});

type SettingsRow = {
  owner_id: string;
  clinic_name: string | null;
  professional_name: string | null;
  professional_type: string | null;
  appointment_label: string | null;
  schedule_start: string;
  schedule_end: string;
  early_block_until_hour: number;
  lunch_start: string;
  lunch_end: string;
  day_early_unlocked: Record<string, boolean>;
  weekday_overrides: Record<string, { start?: string; end?: string }> | null;
  personal_events: PersonalEvent[] | null;
  expenses: Expense[] | null;
  location_address: string;
  services: ServicePlan[];
  message_confirmation: string;
  message_reminder: string;
  message_birthday: string;
  next_eval_seq: number;
};

const clientFromRow = (r: ClientRow): Client => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  birthDate: r.birth_date ?? undefined,
  email: r.email ?? undefined,
  profession: r.profession ?? undefined,
  city: r.city ?? undefined,
  gender: r.gender ?? undefined,
  notes: r.notes ?? undefined,
  paymentPending: r.payment_pending,
  blocked: r.blocked,
  lastVisitDate: r.last_visit_date ?? undefined,
  healthData: r.health_data ? (r.health_data as ClientHealthData) : undefined,
});

const clientToRow = (c: Client, ownerId: string) => ({
  id: c.id,
  owner_id: ownerId,
  name: c.name,
  phone: c.phone,
  birth_date: c.birthDate || null,
  email: c.email || null,
  profession: c.profession || null,
  city: c.city || null,
  gender: c.gender || null,
  notes: c.notes || null,
  payment_pending: c.paymentPending,
  blocked: c.blocked,
  last_visit_date: c.lastVisitDate || null,
  health_data: c.healthData ?? null,
});

const appointmentFromRow = (
  r: AppointmentRow,
  clientName: string,
  clientPhone: string,
): Appointment => ({
  id: r.id,
  date: r.date,
  // PostgreSQL retorna time como "HH:MM:SS"; o app espera "HH:MM"
  time: r.time.slice(0, 5),
  clientId: r.client_id,
  clientName,
  clientPhone,
  confirmed: r.confirmed,
  paid: r.paid || !!r.payment_method,
  paymentMethod: r.payment_method ?? undefined,
  price: r.price || 0,
  notes: r.notes ?? undefined,
  absent: r.absent ?? false,
});

const appointmentToRow = (a: Appointment, ownerId: string) => ({
  id: a.id,
  owner_id: ownerId,
  client_id: a.clientId,
  date: a.date,
  time: a.time.length === 5 ? `${a.time}:00` : a.time,
  confirmed: a.confirmed,
  paid: a.paid || !!a.paymentMethod,
  payment_method: a.paymentMethod ?? null,
  price: a.price || 0,
  notes: a.notes || null,
  absent: a.absent ?? false,
});

const evaluationFromRow = (
  r: EvaluationRow,
  clientName: string,
): EvaluationRecord => ({
  id: r.id,
  seq: r.seq,
  clientId: r.client_id,
  clientName,
  date: r.date,
  createdAt: r.created_at,
  notes: r.notes ?? undefined,
  detailsJson: r.details ? JSON.stringify(r.details) : undefined,
});

const evaluationToRow = (e: EvaluationRecord, ownerId: string) => ({
  id: e.id,
  owner_id: ownerId,
  client_id: e.clientId,
  seq: e.seq,
  date: e.date,
  notes: e.notes || null,
  details: e.detailsJson ? safeParseJson(e.detailsJson) : null,
});

const adherenceFromRow = (
  r: AdherenceRow,
  clientName: string,
): AdherenceEvent => ({
  id: r.id,
  at: r.at,
  clientId: r.client_id,
  clientName,
  type: r.type,
  note: r.note ?? undefined,
});

const adherenceToRow = (a: AdherenceEvent, ownerId: string) => ({
  id: a.id,
  owner_id: ownerId,
  client_id: a.clientId,
  type: a.type,
  at: a.at,
  note: a.note || null,
});

const settingsFromRow = (r: SettingsRow): ClinicSettings => ({
  scheduleStart: r.schedule_start.slice(0, 5),
  scheduleEnd: r.schedule_end.slice(0, 5),
  clinicName: r.clinic_name ?? "",
  professionalName: r.professional_name ?? "",
  professionalType: (r.professional_type ?? "outro") as ClinicSettings["professionalType"],
  appointmentLabel: r.appointment_label ?? "Atendimento",
  earlyBlockUntilHour: r.early_block_until_hour,
  lunchStart: r.lunch_start.slice(0, 5),
  lunchEnd: r.lunch_end.slice(0, 5),
  dayEarlyUnlocked: r.day_early_unlocked ?? {},
  weekdayOverrides: r.weekday_overrides ?? {},
  personalEvents: Array.isArray(r.personal_events) ? (r.personal_events as PersonalEvent[]) : [],
  expenses: Array.isArray(r.expenses) ? (r.expenses as Expense[]) : [],
  locationAddress: r.location_address,
  services: Array.isArray(r.services) ? r.services : [],
  messageConfirmation: r.message_confirmation,
  messageReminder: r.message_reminder,
  messageBirthday: r.message_birthday,
});

const settingsToRow = (s: ClinicSettings, nextEvalSeq: number, ownerId: string) => ({
  owner_id: ownerId,
  clinic_name: s.clinicName,
  professional_name: s.professionalName,
  professional_type: s.professionalType,
  appointment_label: s.appointmentLabel,
  schedule_start: s.scheduleStart.length === 5 ? `${s.scheduleStart}:00` : s.scheduleStart,
  schedule_end: s.scheduleEnd.length === 5 ? `${s.scheduleEnd}:00` : s.scheduleEnd,
  early_block_until_hour: s.earlyBlockUntilHour,
  lunch_start: s.lunchStart.length === 5 ? `${s.lunchStart}:00` : s.lunchStart,
  lunch_end: s.lunchEnd.length === 5 ? `${s.lunchEnd}:00` : s.lunchEnd,
  day_early_unlocked: s.dayEarlyUnlocked,
  weekday_overrides: s.weekdayOverrides ?? {},
  personal_events: s.personalEvents,
  expenses: s.expenses,
  location_address: s.locationAddress,
  services: s.services,
  message_confirmation: s.messageConfirmation,
  message_reminder: s.messageReminder,
  message_birthday: s.messageBirthday,
  next_eval_seq: nextEvalSeq,
});

function safeParseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// ===================================================================
// LOAD: busca tudo do Supabase e monta o AdminStore
// ===================================================================

// O Supabase/PostgREST limita cada resposta a no máximo ~1000 linhas por
// padrão. Tabelas que podem crescer além disso (ex: appointments,
// adherence_events) precisam ser buscadas em páginas com `.range()`,
// caso contrário registros mais antigos somem silenciosamente da consulta
// — sem erro, sem aviso — mesmo existindo no banco e com refresh/cache
// limpos. Esse helper busca todas as páginas até esgotar os resultados.
async function fetchAllRows<T>(
  table: string,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table as any)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const page = (data ?? []) as T[];
    all.push(...page);
    if (page.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export async function loadAdminStore(): Promise<AdminStore> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) {
    // Sem usuário autenticado: devolve store vazio. Não deveria acontecer
    // porque o admin é protegido, mas é defensivo.
    return defaultAdminStore();
  }

  const [
    clientsRaw,
    appointmentsRaw,
    evaluationsRaw,
    adherenceRaw,
    waitlistRes,
    settingsRes,
  ] = await Promise.all([
    fetchAllRows<ClientRow>("clients"),
    fetchAllRows<AppointmentRow>("appointments"),
    fetchAllRows<EvaluationRow>("evaluations"),
    fetchAllRows<AdherenceRow>("adherence_events"),
    supabase.from("waitlist").select("*").order("requested_at", { ascending: true }),
    supabase.from("clinic_settings").select("*").eq("owner_id", userId).maybeSingle(),
  ]);

  if (waitlistRes.error) throw waitlistRes.error;
  if (settingsRes.error) throw settingsRes.error;

  const clients = clientsRaw.map(clientFromRow);
  const clientById = new Map(clients.map((c) => [c.id, c]));

  const appointments = appointmentsRaw.map((a) =>
    appointmentFromRow(
      a,
      clientById.get(a.client_id)?.name ?? "(cliente removido)",
      clientById.get(a.client_id)?.phone ?? "",
    ),
  );

  const evaluations = evaluationsRaw.map((e) =>
    evaluationFromRow(e, clientById.get(e.client_id)?.name ?? "(cliente removido)"),
  );

  const adherenceEvents = adherenceRaw.map((ev) =>
    adherenceFromRow(ev, clientById.get(ev.client_id)?.name ?? "(cliente removido)"),
  );

  const waitlistRaw = (waitlistRes.data ?? []) as WaitlistRow[];
  const waitlist = waitlistRaw.map((w) =>
    waitlistFromRow(
      w,
      clientById.get(w.client_id)?.name ?? "(cliente removido)",
      clientById.get(w.client_id)?.phone ?? "",
    ),
  );

  let settings: ClinicSettings;
  let nextEvalSeq: number;
  if (settingsRes.data) {
    const row = settingsRes.data as SettingsRow;
    settings = settingsFromRow(row);
    nextEvalSeq = row.next_eval_seq;
  } else {
    // Primeira sessão e por algum motivo a linha de settings não existe
    settings = defaultClinicSettings();
    nextEvalSeq = 1;
  }

  return {
    clients,
    appointments,
    adherenceEvents,
    evaluations,
    waitlist,
    settings,
    nextEvalSeq,
  };
}

// ===================================================================
// SAVE: diff entre prev e next e sincroniza apenas o que mudou
// ===================================================================

type DiffResult<T extends { id: string }> = {
  inserted: T[];
  updated: T[];
  deletedIds: string[];
};

function diffById<T extends { id: string }>(prev: T[], next: T[]): DiffResult<T> {
  const prevById = new Map(prev.map((x) => [x.id, x]));
  const nextById = new Map(next.map((x) => [x.id, x]));

  const inserted: T[] = [];
  const updated: T[] = [];
  const deletedIds: string[] = [];

  for (const [id, item] of nextById) {
    const prevItem = prevById.get(id);
    if (!prevItem) inserted.push(item);
    else if (JSON.stringify(prevItem) !== JSON.stringify(item)) updated.push(item);
  }

  for (const id of prevById.keys()) {
    if (!nextById.has(id)) deletedIds.push(id);
  }

  return { inserted, updated, deletedIds };
}

export async function saveAdminStore(prev: AdminStore, next: AdminStore): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Usuário não autenticado");

  // ------- clients -------
  const cDiff = diffById(prev.clients, next.clients);
  if (cDiff.inserted.length) {
    const { error } = await supabase
      .from("clients")
      .insert(cDiff.inserted.map((c) => clientToRow(c, userId)));
    if (error) throw error;
  }
  for (const c of cDiff.updated) {
    const { error } = await supabase
      .from("clients")
      .update(clientToRow(c, userId))
      .eq("id", c.id);
    if (error) throw error;
  }
  if (cDiff.deletedIds.length) {
    const { error } = await supabase.from("clients").delete().in("id", cDiff.deletedIds);
    if (error) throw error;
  }

  // ------- appointments -------
  const aDiff = diffById(prev.appointments, next.appointments);
  if (aDiff.inserted.length) {
    const { error } = await supabase
      .from("appointments")
      .insert(aDiff.inserted.map((a) => appointmentToRow(a, userId)));
    if (error) throw error;
  }
  for (const a of aDiff.updated) {
    const { error } = await supabase
      .from("appointments")
      .update(appointmentToRow(a, userId))
      .eq("id", a.id);
    if (error) throw error;
  }
  if (aDiff.deletedIds.length) {
    const { error } = await supabase
      .from("appointments")
      .delete()
      .in("id", aDiff.deletedIds);
    if (error) throw error;
  }

  // ------- evaluations -------
  const eDiff = diffById(prev.evaluations, next.evaluations);
  if (eDiff.inserted.length) {
    const { error } = await supabase
      .from("evaluations")
      .insert(eDiff.inserted.map((e) => evaluationToRow(e, userId)));
    if (error) throw error;
  }
  for (const e of eDiff.updated) {
    const { error } = await supabase
      .from("evaluations")
      .update(evaluationToRow(e, userId))
      .eq("id", e.id);
    if (error) throw error;
  }
  if (eDiff.deletedIds.length) {
    const { error } = await supabase
      .from("evaluations")
      .delete()
      .in("id", eDiff.deletedIds);
    if (error) throw error;
  }

  // ------- adherence_events -------
  const adDiff = diffById(prev.adherenceEvents, next.adherenceEvents);
  if (adDiff.inserted.length) {
    const { error } = await supabase
      .from("adherence_events")
      .insert(adDiff.inserted.map((ev) => adherenceToRow(ev, userId)));
    if (error) throw error;
  }
  for (const ev of adDiff.updated) {
    const { error } = await supabase
      .from("adherence_events")
      .update(adherenceToRow(ev, userId))
      .eq("id", ev.id);
    if (error) throw error;
  }
  if (adDiff.deletedIds.length) {
    const { error } = await supabase
      .from("adherence_events")
      .delete()
      .in("id", adDiff.deletedIds);
    if (error) throw error;
  }

  // ------- waitlist -------
  const wDiff = diffById(prev.waitlist, next.waitlist);
  if (wDiff.inserted.length) {
    const { error } = await supabase
      .from("waitlist")
      .insert(wDiff.inserted.map((w) => waitlistToRow(w, userId)));
    if (error) throw error;
  }
  if (wDiff.deletedIds.length) {
    const { error } = await supabase.from("waitlist").delete().in("id", wDiff.deletedIds);
    if (error) throw error;
  }

  // ------- clinic_settings (single row upsert) -------
  const settingsChanged =
    JSON.stringify(prev.settings) !== JSON.stringify(next.settings) ||
    prev.nextEvalSeq !== next.nextEvalSeq;
  if (settingsChanged) {
    const { error } = await supabase
      .from("clinic_settings")
      .upsert(settingsToRow(next.settings, next.nextEvalSeq, userId), {
        onConflict: "owner_id",
      });
    if (error) throw error;
  }
}
