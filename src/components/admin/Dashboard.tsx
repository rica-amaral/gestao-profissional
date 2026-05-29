import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, Calendar, CalendarClock, DollarSign, Gift, MessageCircle, UserCheck } from "lucide-react";
import { useAdminData, birthdaysToday, birthdaysUpcoming, formatDateBR, replaceMsg } from "@/contexts/AdminDataContext";
import { whatsappClientHref } from "@/lib/contact";
import { formatBRL } from "@/lib/utils";

/** Retorna a data atual no fuso BRT (UTC-3) no formato yyyy-MM-dd */
function todayBRT(): string {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 60 * 60 * 1000);
  return brt.toISOString().slice(0, 10);
}

type Props = { onOpenSchedule: () => void };

export const Dashboard = ({ onOpenSchedule }: Props) => {
  const { store } = useAdminData();
  const todayKey = todayBRT();

  const todayApts = store.appointments
    .filter((a) => a.date === todayKey)
    .sort((a, b) => a.time.localeCompare(b.time));

  // Próximos 7 dias a partir de hoje (BRT)
  const weekKeys = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(todayKey + "T12:00:00");
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const weekCount = store.appointments.filter((a) => weekKeys.includes(a.date)).length;

  const bdays = birthdaysToday(store.clients);
  const upcoming = birthdaysUpcoming(store.clients, 7);

  // Receita de hoje (exclui faltas)
  const todayRevenue = todayApts
    .filter((a) => !a.absent)
    .reduce((sum, a) => sum + (a.price || 0), 0);

  // Receita do mês corrente (exclui faltas)
  const monthPrefix = todayKey.slice(0, 7); // "yyyy-MM"
  const monthRevenue = store.appointments
    .filter((a) => a.date.startsWith(monthPrefix) && !a.absent)
    .reduce((sum, a) => sum + (a.price || 0), 0);

  const stats = [
    {
      title: "Sessões hoje",
      value: String(todayApts.length),
      icon: CalendarClock,
      color: "text-primary",
    },
    {
      title: "Sessões (7 dias)",
      value: String(weekCount),
      icon: Calendar,
      color: "text-primary",
    },
    {
      title: "Clientes ativos",
      value: String(store.clients.length),
      icon: UserCheck,
      color: "text-primary",
    },
    {
      title: "Receita hoje",
      value: formatBRL(todayRevenue),
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Receita (este mês)",
      value: formatBRL(monthRevenue),
      icon: DollarSign,
      color: "text-green-600",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-foreground mb-2">Dashboard</h2>
        <p className="text-muted-foreground">Visão geral do consultório</p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map((stat, index) => (
          <Card key={index} className="border-border hover:shadow-soft transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {(bdays.length > 0 || upcoming.length > 0) && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Gift className="h-5 w-5 text-primary" />
              Aniversários
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Hoje */}
            {bdays.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-primary uppercase tracking-wide">Hoje 🎂</p>
                {bdays.map((c) => {
                  const age = c.birthDate
                    ? new Date(todayKey + "T12:00:00").getFullYear() - new Date(c.birthDate + "T12:00:00").getFullYear()
                    : null;
                  const msg = replaceMsg(store.settings.messageBirthday, {
                    nome: c.name,
                    data: formatDateBR(todayKey),
                    hora: "",
                    clinica: store.settings.clinicName,
                  });
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-card border border-primary/30"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {c.name}
                          {age !== null && <span className="text-sm text-muted-foreground ml-2">({age} anos)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">{c.phone}</p>
                      </div>
                      <Button size="sm" asChild>
                        <a href={whatsappClientHref(c.phone, msg)} target="_blank" rel="noopener noreferrer">
                          <Gift className="h-3.5 w-3.5 mr-1.5" />
                          Enviar parabéns
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Próximos 7 dias */}
            {upcoming.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Próximos 7 dias</p>
                {upcoming.map(({ client: c, dateKey, daysUntil }) => {
                  const age = c.birthDate
                    ? new Date(dateKey + "T12:00:00").getFullYear() - new Date(c.birthDate + "T12:00:00").getFullYear()
                    : null;
                  const msg = replaceMsg(store.settings.messageBirthday, {
                    nome: c.name,
                    data: formatDateBR(dateKey),
                    hora: "",
                    clinica: store.settings.clinicName,
                  });
                  return (
                    <div
                      key={c.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-3 rounded-lg bg-card border border-border"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {c.name}
                          {age !== null && <span className="text-sm text-muted-foreground ml-2">({age} anos)</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateBR(dateKey)} · em {daysUntil} dia{daysUntil > 1 ? "s" : ""}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" asChild>
                        <a href={whatsappClientHref(c.phone, msg)} target="_blank" rel="noopener noreferrer">
                          <Gift className="h-3.5 w-3.5 mr-1.5" />
                          Enviar parabéns
                        </a>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Agenda de hoje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {todayApts.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma sessão agendada para hoje.</p>
            )}
            {(() => {
              const countByTime = todayApts.reduce<Record<string, number>>((acc, a) => {
                acc[a.time] = (acc[a.time] ?? 0) + 1;
                return acc;
              }, {});
              return todayApts.map((session) => {
              const isDuplo = countByTime[session.time] === 2;
              const msgBase = {
                nome: session.clientName,
                data: formatDateBR(todayKey),
                hora: session.time,
              };
              return (
                <div
                  key={session.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors"
                >
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="font-bold text-primary text-lg tabular-nums w-[52px] shrink-0">
                      {session.time}
                    </span>
                    {isDuplo && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-700 font-medium">
                        duplo
                      </span>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild title="Mensagem de confirmação">
                      <a
                        href={whatsappClientHref(
                          session.clientPhone,
                          replaceMsg(store.settings.messageConfirmation, msgBase)
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </a>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild title="Mensagem de lembrete">
                      <a
                        href={whatsappClientHref(
                          session.clientPhone,
                          replaceMsg(store.settings.messageReminder, msgBase)
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Bell className="h-4 w-4" />
                      </a>
                    </Button>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{session.clientName}</p>
                      <p className="text-xs text-muted-foreground truncate">{session.clientPhone}</p>
                      {session.absent ? (
                        <Badge variant="destructive" className="mt-1 text-xs">Falta</Badge>
                      ) : (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {session.confirmed ? "Confirmado" : "Não confirmado"} ·{" "}
                          {session.paid ? "Pago" : "Não pago"}
                          {session.price > 0 && ` · ${formatBRL(session.price)}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            });
            })()}
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-4">
        <Button size="lg" className="h-auto py-4" onClick={onOpenSchedule}>
          <Calendar className="mr-2 h-5 w-5" />
          Ir para a agenda
        </Button>
      </div>
    </div>
  );
};
