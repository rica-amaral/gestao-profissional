export type ClientHealthData = {
  peso?: string;       // kg
  altura?: string;     // cm
  pathologiaColuna?: string;
  demaisPatologias?: string;
  cirurgias?: string;
  cirurgiasQuando?: string;
  exercicioFisico?: string;
  // Condições (S/N)
  doencaRespiratoria?: boolean;
  osteoporose?: boolean;
  artrose?: boolean;
  diabetes?: boolean;
  hipertensao?: boolean;
  fumante?: boolean;
  ansiedade?: boolean;
  dorCabeca?: boolean;
  depressao?: boolean;
  maniaEstalar?: boolean;
  // Estilo de vida – notas 0-5
  notaSono?: string;
  notaAlimentacao?: string;
  notaAgua?: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  birthDate?: string;
  email?: string;
  profession?: string;
  city?: string;
  gender?: 'M' | 'F' | 'O';
  notes?: string;
  paymentPending: boolean;
  blocked: boolean;
  lastVisitDate?: string;
  healthData?: ClientHealthData;
};

export type Appointment = {
  id: string;
  date: string;
  time: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  confirmed: boolean;
  paid: boolean;
  paymentMethod?: "pix" | "cartao" | "dinheiro" | "permuta";
  price: number;
  notes?: string;
  absent?: boolean;   // true = cliente faltou; não gera pendência financeira
};

export type AdherenceEvent = {
  id: string;
  at: string;
  clientId: string;
  clientName: string;
  type: "falta" | "cancelamento" | "reagendamento";
  note?: string;
};

export type EvaluationRecord = {
  id: string;
  seq: number;
  clientId: string;
  clientName: string;
  date: string;
  createdAt: string;
  notes?: string;
  /** JSON serializado do questionário (anamneses + evolução) */
  detailsJson?: string;
};

export type ServicePlan = {
  id: string;
  name: string;
  durationLabel: string;
  price: number;
};

export type ClinicSettings = {
  /** Nome do consultório / clínica (aparece em mensagens como {clinica}) */
  clinicName: string;
  /** Nome do profissional responsável */
  professionalName: string;
  scheduleStart: string;
  scheduleEnd: string;
  earlyBlockUntilHour: number;
  lunchStart: string;
  lunchEnd: string;
  dayEarlyUnlocked: Record<string, boolean>;
  personalEvents: PersonalEvent[];
  expenses: Expense[];
  locationAddress: string;
  services: ServicePlan[];
  messageConfirmation: string;
  messageReminder: string;
  messageBirthday: string;
};

export type AdminAuth = {
  email: string;
  password: string;
};

export type PersonalEvent = {
  id: string;
  date: string;
  time: string;       // "HH:MM" — ignorado se allDay=true
  endTime?: string;   // "HH:MM" — fim da reserva (opcional)
  title: string;
  allDay?: boolean;   // Tarefa do dia sem horário específico
};

export type Expense = {
  id: string;
  date: string; // yyyy-MM-dd
  description: string;
  amount: number;
  category?: string;
};

export type WaitlistEntry = {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  notes?: string;
  requestedAt: string;    // ISO timestamp
  scheduledDate?: string; // preenchido ao agendar via fila
  scheduledTime?: string;
};

export type AdminStore = {
  clients: Client[];
  appointments: Appointment[];
  adherenceEvents: AdherenceEvent[];
  evaluations: EvaluationRecord[];
  waitlist: WaitlistEntry[];
  settings: ClinicSettings;
  nextEvalSeq: number;
};

const defaultServices: ServicePlan[] = [
  { id: "1", name: "Sessão individual", durationLabel: "~50 min", price: 180 },
];

export const defaultClinicSettings = (): ClinicSettings => ({
  clinicName: "",
  professionalName: "",
  scheduleStart: "06:00",
  scheduleEnd: "20:00",
  earlyBlockUntilHour: 8,
  lunchStart: "12:00",
  lunchEnd: "14:00",
  dayEarlyUnlocked: {},
  personalEvents: [],
  expenses: [],
  locationAddress: "",
  services: defaultServices,
  messageConfirmation:
    "Olá {nome}! Pode confirmar sua sessão no dia {data} às {hora}? Responda sim para confirmar. Obrigado!",
  messageReminder:
    "Olá {nome}! Lembrete: você tem sessão agendada para {data} às {hora}. Até lá!",
  messageBirthday:
    "Olá {nome}! Feliz aniversário! Desejamos um dia incrível e muita saúde. Um abraço da equipe {clinica}!",
});

export const defaultAdminStore = (): AdminStore => ({
  clients: [],
  appointments: [],
  adherenceEvents: [],
  evaluations: [],
  waitlist: [],
  settings: defaultClinicSettings(),
  nextEvalSeq: 1,
});
