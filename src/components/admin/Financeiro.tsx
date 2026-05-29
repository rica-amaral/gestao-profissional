import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, TrendingUp, TrendingDown, Wallet, ChevronLeft, ChevronRight } from "lucide-react";
import { useAdminData, formatDateBR, todayKeyBRT } from "@/contexts/AdminDataContext";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Expense } from "@/lib/admin-types";

const EXPENSE_CATEGORIES = [
  "Aluguel",
  "Material clínico",
  "Equipamentos",
  "Marketing",
  "Contador",
  "Telefone / Internet",
  "Cursos / Formação",
  "Outros",
];

const METHOD_LABEL: Record<string, string> = {
  pix: "Pix",
  cartao: "Cartão",
  dinheiro: "Dinheiro",
  permuta: "Permuta",
};

function monthKey(date: Date) {
  return format(date, "yyyy-MM");
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return format(d, "MMMM 'de' yyyy", { locale: ptBR });
}

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatBRLShort(v: number) {
  if (v === 0) return "";
  return "R$ " + Math.round(v).toLocaleString("pt-BR");
}

export const Financeiro = () => {
  const { store, patch } = useAdminData();

  // todayKey — sempre derivado ao vivo; state garante re-render na virada do dia
  const [todayKey, setTodayKey] = useState(() => todayKeyBRT());
  useEffect(() => {
    // Força leitura fresca na montagem (resolve aba aberta desde outro mês)
    const fresh = todayKeyBRT();
    setTodayKey(fresh);
    setCurrentMonth((prev) => {
      const realMonth = fresh.slice(0, 7);
      return prev < realMonth ? realMonth : prev;
    });
    // Verifica virada de dia a cada 5 min
    const id = setInterval(() => {
      const next = todayKeyBRT();
      setTodayKey((prev) => (prev !== next ? next : prev));
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Mês selecionado — inicializa sempre pelo mês real BRT
  const [currentMonth, setCurrentMonth] = useState<string>(() => todayKeyBRT().slice(0, 7));

  const prevMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1);
    setCurrentMonth(monthKey(d));
  };
  const nextMonth = () => {
    const [y, m] = currentMonth.split("-").map(Number);
    const d = new Date(y, m, 1);
    setCurrentMonth(monthKey(d));
  };

  // ── Receitas do mês (consultas pagas, data <= hoje, exclui faltas) ──────────────
  const receitas = useMemo(() => {
    return store.appointments.filter(
      (a) =>
        a.date.startsWith(currentMonth) &&
        a.date <= todayKey &&
        (a.paid || !!a.paymentMethod) &&
        !a.absent
    );
  }, [store.appointments, currentMonth, todayKey]);

  const totalReceitas = receitas.reduce((s, a) => s + (a.price ?? 0), 0);

  const receitasByMethod = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {};
    receitas.forEach((a) => {
      const key = a.paymentMethod ?? "legado";
      if (!map[key]) map[key] = { count: 0, total: 0 };
      map[key].count++;
      map[key].total += a.price ?? 0;
    });
    return Object.entries(map).sort((a, b) => b[1].total - a[1].total);
  }, [receitas]);

  // ── Despesas do mês ──────────────────────────────────────────────
  const expenses: Expense[] = store.settings.expenses ?? [];
  const despesasMes = useMemo(
    () => expenses.filter((e) => e.date.startsWith(currentMonth)).sort((a, b) => b.date.localeCompare(a.date)),
    [expenses, currentMonth]
  );
  const totalDespesas = despesasMes.reduce((s, e) => s + e.amount, 0);
  const saldo = totalReceitas - totalDespesas;

  // ── Resumo últimos 6 meses — fixo na data real, não muda ao navegar ──
  const todayMonth = todayKey.slice(0, 7);
  const last6 = useMemo(() => {
    const months: string[] = [];
    const [cy, cm] = todayMonth.split("-").map(Number);
    for (let i = 5; i >= 0; i--) {
      const d = new Date(cy, cm - 1 - i, 1);
      months.push(monthKey(d));
    }
    return months.map((ym) => {
      const rec = store.appointments
        .filter((a) => a.date.startsWith(ym) && a.date <= todayKey && (a.paid || !!a.paymentMethod) && !a.absent)
        .reduce((s, a) => s + (a.price ?? 0), 0);
      const desp = (store.settings.expenses ?? [])
        .filter((e) => e.date.startsWith(ym))
        .reduce((s, e) => s + e.amount, 0);
      return { ym, rec, desp, saldo: rec - desp };
    });
  }, [store.appointments, store.settings.expenses, todayMonth, todayKey]);

  const maxBar = Math.max(...last6.map((m) => Math.max(m.rec, m.desp)), 1);

  // ── Projeção de receita (mês atual + próximos com agendamentos) ──
  const projection = useMemo(() => {
    // Descobre meses futuros que têm agendamentos
    const futureMonths = new Set<string>();
    store.appointments.forEach((a) => {
      if (a.date > todayKey) futureMonths.add(a.date.slice(0, 7));
    });
    // Meses a exibir: atual + futuros ordenados, limitado a 6
    const months = [todayMonth, ...[...futureMonths].filter((m) => m > todayMonth).sort()].slice(0, 6);
    return months.map((ym) => {
      const paid = store.appointments
        .filter((a) => a.date.startsWith(ym) && (a.paid || !!a.paymentMethod) && !a.absent)
        .reduce((s, a) => s + (a.price ?? 0), 0);
      const planned = store.appointments
        .filter((a) => a.date.startsWith(ym) && !a.paid && !a.paymentMethod && !a.absent)
        .reduce((s, a) => s + (a.price ?? 0), 0);
      return { ym, paid, planned, total: paid + planned };
    });
  }, [store.appointments, todayKey, todayMonth]);

  const maxProjection = Math.max(...projection.map((m) => m.total), 1);

  // ── Pagamentos pendentes (passado, não pago) ──────────────────────
  const pendingPayments = useMemo(() => {
    return store.appointments
      .filter((a) => a.date < todayKey && !a.paid && !a.paymentMethod && a.price > 0 && !a.absent)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [store.appointments, todayKey]);

  const totalPending = pendingPayments.reduce((s, a) => s + (a.price ?? 0), 0);

  const markPaid = (id: string, method: "pix" | "cartao" | "dinheiro" | "permuta") => {
    patch((s) => ({
      ...s,
      appointments: s.appointments.map((a) =>
        a.id === id ? { ...a, paid: true, paymentMethod: method } : a
      ),
    }));
  };

  // ── Formulário nova despesa ───────────────────────────────────────
  const [expDate, setExpDate] = useState(todayKey);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCat, setExpCat] = useState("Outros");

  const addExpense = () => {
    const amount = parseFloat(expAmount.replace(",", "."));
    if (!expDesc.trim() || isNaN(amount) || amount <= 0) {
      toast({ variant: "destructive", title: "Preencha descrição e valor válido" });
      return;
    }
    const entry: Expense = {
      id: crypto.randomUUID(),
      date: expDate,
      description: expDesc.trim(),
      amount,
      category: expCat,
    };
    patch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        expenses: [...(s.settings.expenses ?? []), entry],
      },
    }));
    setExpDesc("");
    setExpAmount("");
    toast({ title: "Despesa adicionada" });
  };

  const removeExpense = (id: string) => {
    patch((s) => ({
      ...s,
      settings: {
        ...s.settings,
        expenses: (s.settings.expenses ?? []).filter((e) => e.id !== id),
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com navegação de mês */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-1">Financeiro</h2>
          <p className="text-muted-foreground text-sm">Receitas de consultas pagas e despesas manuais.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium w-44 text-center capitalize">{monthLabel(currentMonth)}</span>
          <Button type="button" variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ── Pagamentos pendentes ── */}
      {pendingPayments.length > 0 && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-amber-700">
                <Wallet className="h-4 w-4" />
                {pendingPayments.length} sessão(ões) sem pagamento · {formatBRL(totalPending)}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-amber-500/20 bg-amber-500/10">
                    <th className="text-left font-semibold p-2">Cliente</th>
                    <th className="text-left font-semibold p-2 w-24">Data</th>
                    <th className="text-right font-semibold p-2 w-24">Valor</th>
                    <th className="text-right font-semibold p-2 w-48">Receber como</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingPayments.map((apt) => (
                    <tr key={apt.id} className="border-b border-amber-500/10">
                      <td className="p-2 font-medium">{apt.clientName}</td>
                      <td className="p-2 text-muted-foreground tabular-nums">{formatDateBR(apt.date)}</td>
                      <td className="p-2 text-right font-medium">{formatBRL(apt.price)}</td>
                      <td className="p-2 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          {(["pix", "cartao", "dinheiro", "permuta"] as const).map((m) => (
                            <Button key={m} type="button" size="sm" variant="outline"
                              className="h-7 text-xs px-2 border-amber-500/40 hover:bg-amber-500/10"
                              onClick={() => markPaid(apt.id, m)}>
                              {m === "cartao" ? "Cartão" : m.charAt(0).toUpperCase() + m.slice(1)}
                            </Button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Receitas</p>
                <p className="text-xl font-bold text-green-700">{formatBRL(totalReceitas)}</p>
                <p className="text-xs text-muted-foreground">{receitas.length} sessão(ões) pagas</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Despesas</p>
                <p className="text-xl font-bold text-red-700">{formatBRL(totalDespesas)}</p>
                <p className="text-xs text-muted-foreground">{despesasMes.length} lançamento(s)</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("border-border", saldo >= 0 ? "" : "border-red-300")}>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", saldo >= 0 ? "bg-primary/10" : "bg-red-500/10")}>
                <Wallet className={cn("h-5 w-5", saldo >= 0 ? "text-primary" : "text-red-600")} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold">Saldo</p>
                <p className={cn("text-xl font-bold", saldo >= 0 ? "text-foreground" : "text-red-700")}>
                  {formatBRL(saldo)}
                </p>
                <p className="text-xs text-muted-foreground">Receitas − Despesas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Projeção de receita */}
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Projeção de receita</CardTitle>
          <p className="text-xs text-muted-foreground">Mês atual e futuros com agendamentos. Verde = pago · Azul = planejado.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {projection.map((m) => {
            const paidPct = maxProjection > 0 ? (m.paid / maxProjection) * 100 : 0;
            const plannedPct = maxProjection > 0 ? (m.planned / maxProjection) * 100 : 0;
            const isCurrentMonth = m.ym === todayMonth;
            return (
              <div key={m.ym} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={cn("text-sm", isCurrentMonth ? "font-semibold text-foreground" : "text-muted-foreground capitalize")}>
                    {format(new Date(m.ym + "-01"), "MMMM", { locale: ptBR })}{isCurrentMonth && " (atual)"}
                  </span>
                  <div className="flex items-baseline gap-2 shrink-0">
                    {m.paid > 0 && <span className="text-xs text-green-700 font-medium">{formatBRLShort(m.paid)}</span>}
                    {m.planned > 0 && <span className="text-xs text-blue-600 font-medium">+ {formatBRLShort(m.planned)}</span>}
                    <span className="text-xs font-bold text-foreground">{formatBRLShort(m.total)}</span>
                  </div>
                </div>
                {/* Barra empilhada */}
                <div className="h-5 w-full rounded-full bg-muted overflow-hidden flex">
                  {m.paid > 0 && (
                    <div
                      className="h-full bg-green-500/80 transition-all"
                      style={{ width: `${paidPct}%` }}
                    />
                  )}
                  {m.planned > 0 && (
                    <div
                      className="h-full bg-blue-400/70 transition-all"
                      style={{ width: `${plannedPct}%` }}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {projection.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum agendamento com valor registrado.</p>
          )}
          <div className="flex gap-4 pt-1">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500/80" />
              <span className="text-xs text-muted-foreground">Pago</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-blue-400/70" />
              <span className="text-xs text-muted-foreground">Planejado</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gráfico últimos 6 meses — janela fixa nos 6 meses reais */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {last6.map((m) => (
              <div key={m.ym} className="flex-1 flex flex-col items-center gap-1">
                {/* Valores acima das barras */}
                <div className="text-center min-h-[2.5rem] flex flex-col justify-end">
                  {m.rec > 0 && (
                    <p className="text-[10px] font-medium text-green-700 leading-tight truncate">{formatBRLShort(m.rec)}</p>
                  )}
                  {m.desp > 0 && (
                    <p className="text-[10px] font-medium text-red-600 leading-tight truncate">{formatBRLShort(m.desp)}</p>
                  )}
                </div>
                {/* Barras */}
                <div className="w-full flex items-end gap-0.5 h-20">
                  <div
                    className="flex-1 rounded-t bg-green-500/70 min-h-[2px] transition-all"
                    style={{ height: `${(m.rec / maxBar) * 100}%` }}
                  />
                  <div
                    className="flex-1 rounded-t bg-red-400/70 min-h-[2px] transition-all"
                    style={{ height: `${(m.desp / maxBar) * 100}%` }}
                  />
                </div>
                {/* Mês */}
                <span className={cn(
                  "text-[10px] text-center leading-tight",
                  m.ym === todayMonth ? "font-bold text-foreground" : "text-muted-foreground"
                )}>
                  {format(new Date(m.ym + "-01"), "MMM", { locale: ptBR })}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-green-500/70" />
              <span className="text-xs text-muted-foreground">Receita</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-red-400/70" />
              <span className="text-xs text-muted-foreground">Despesa</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Receitas do mês */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Receitas — {monthLabel(currentMonth)}</span>
              <span className="text-green-700 font-bold">{formatBRL(totalReceitas)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Breakdown por método */}
            {receitasByMethod.length > 0 && (
              <div className="space-y-1.5">
                {receitasByMethod.map(([method, data]) => (
                  <div key={method} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{METHOD_LABEL[method] ?? "Pago"}</span>
                    <span className="font-medium">
                      {formatBRL(data.total)}
                      <span className="text-xs text-muted-foreground ml-1">({data.count}×)</span>
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Lista de receitas */}
            {receitas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma sessão paga neste mês.</p>
            ) : (
              <div className="overflow-x-auto rounded-md border border-border max-h-64 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-muted/80">
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Data</th>
                      <th className="px-3 py-2 font-medium">Cliente</th>
                      <th className="px-3 py-2 font-medium">Forma</th>
                      <th className="px-3 py-2 font-medium text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...receitas].sort((a, b) => b.date.localeCompare(a.date)).map((a) => (
                      <tr key={a.id} className="border-b border-border/60 last:border-0">
                        <td className="px-3 py-2 whitespace-nowrap">{formatDateBR(a.date)}</td>
                        <td className="px-3 py-2 max-w-[140px] truncate">{a.clientName}</td>
                        <td className="px-3 py-2">{METHOD_LABEL[a.paymentMethod ?? ""] ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium text-green-700">{formatBRL(a.price ?? 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Despesas do mês */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Despesas — {monthLabel(currentMonth)}</span>
              <span className="text-red-700 font-bold">{formatBRL(totalDespesas)}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Formulário */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Nova despesa</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="h-8 text-xs" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    placeholder="0,00"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descrição</Label>
                <Input
                  placeholder="Ex: aluguel da sala"
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addExpense()}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={expCat} onValueChange={setExpCat}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button type="button" size="sm" className="w-full h-8 text-xs" onClick={addExpense}>
                Adicionar despesa
              </Button>
            </div>

            {/* Lista de despesas */}
            {despesasMes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma despesa neste mês.</p>
            ) : (
              <div className="space-y-1.5 max-h-52 overflow-y-auto">
                {despesasMes.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDateBR(e.date)} · {e.category}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-semibold text-red-700">{formatBRL(e.amount)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        onClick={() => removeExpense(e.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
