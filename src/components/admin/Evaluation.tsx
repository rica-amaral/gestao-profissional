import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  hasEvaluation,
  appendEvaluation,
} from "@/contexts/AdminDataContext";
import type { Appointment, EvaluationRecord } from "@/lib/admin-types";
import { toast } from "@/hooks/use-toast";

const ANAMNESE_1_QUESTIONS = [
  "Doença respiratória",
  "Dor CONSTANTE durante o dia",
  "Dor que NÃO alivia com repouso",
  "Dor NOTURNA",
  "Dor ao ACORDAR",
  "Alteração de sensibilidade (formigamento, dormência ou pontada)",
  "Perda ou redução de FM em membros",
  "Trauma recente (quedas, pancadas ou acidentes)",
  "Está sob efeito de medicação analgésica?",
  "Osteoporose",
  "Artrose",
  "Diabetes",
  "Hipertensão",
  "Fumante",
  "Ansiedade",
  "Dor de cabeça / Enxaqueca",
  "Depressão",
  "Tem MANIA de 'estalar' a coluna?",
];

/// Perguntas movidas para o cadastro do paciente (aba Saúde):
// 0 = Doença respiratória; 9–17 = condições crônicas (osteoporose, artrose, etc.)
const HIDDEN_A1_INDICES = new Set([0, 9, 10, 11, 12, 13, 14, 15, 16, 17]);

const ANAMNESE_2_QUESTIONS = [
  "Qual nota você dá p/ seu sono? (0 a 5)",
  "Qual nota você dá p/ sua alimentação? (0 a 5)",
  "Qual nota você dá p/ sua ingestão de água? (0 a 5)",
];

type DetailPayload = {
  // Seção "Queixa principal" (aba ANAMNESE do Excel)
  painLocations: { local: string; eva: string }[];   // 4 linhas Local + EVA
  pathologiaColuna: string;
  demaisPatologias: string;
  cirurgias: string;
  cirurgiasQuando: string;
  anamneseObs: string;
  // Perguntas S/N (aba ANAMNESE 2 do Excel)
  a1: { answer?: "s" | "n"; obs: string }[];
  // Notas (aba ANAMNESE 2 do Excel, final)
  a2: { score: string; obs: string }[];
  // Evolução
  evo: { date: string; text: string }[];
};

function emptyDetails(evalDate?: string): DetailPayload {
  const d =
    evalDate && /^\d{4}-\d{2}-\d{2}$/.test(evalDate) ? evalDate : format(new Date(), "yyyy-MM-dd");
  return {
    painLocations: Array.from({ length: 4 }, () => ({ local: "", eva: "" })),
    pathologiaColuna: "",
    demaisPatologias: "",
    cirurgias: "",
    cirurgiasQuando: "",
    anamneseObs: "",
    a1: ANAMNESE_1_QUESTIONS.map(() => ({ obs: "" })),
    a2: ANAMNESE_2_QUESTIONS.map(() => ({ score: "", obs: "" })),
    evo: [{ date: d, text: "" }],
  };
}

function parseDetails(json?: string): DetailPayload {
  if (!json) return emptyDetails();
  try {
    const p = JSON.parse(json) as Partial<DetailPayload>;
    if (!p || !Array.isArray(p.a1)) return emptyDetails();
    return {
      painLocations: Array.from({ length: 4 }, (_, i) => ({
        local: p.painLocations?.[i]?.local ?? "",
        eva: p.painLocations?.[i]?.eva ?? "",
      })),
      pathologiaColuna: p.pathologiaColuna ?? "",
      demaisPatologias: p.demaisPatologias ?? "",
      cirurgias: p.cirurgias ?? "",
      cirurgiasQuando: p.cirurgiasQuando ?? "",
      anamneseObs: p.anamneseObs ?? "",
      a1: ANAMNESE_1_QUESTIONS.map((_, i) => ({
        answer: p.a1![i]?.answer,
        obs: p.a1![i]?.obs ?? "",
      })),
      a2: ANAMNESE_2_QUESTIONS.map((_, i) => ({
        score: p.a2?.[i]?.score ?? "",
        obs: p.a2?.[i]?.obs ?? "",
      })),
      evo:
        Array.isArray(p.evo) && p.evo.length
          ? p.evo.map((r) => ({ date: r.date ?? "", text: r.text ?? "" }))
          : [{ date: format(new Date(), "yyyy-MM-dd"), text: "" }],
    };
  } catch {
    return emptyDetails();
  }
}

function matchesSearch(row: EvaluationRecord, query: string, clients: { id: string; name: string }[]) {
  const t = query.trim().toLowerCase();
  if (!t) return true;
  const name = row.clientName.toLowerCase();
  if (name.includes(t)) return true;
  if (row.date.includes(t)) return true;
  if (formatDateBR(row.date).includes(t)) return true;
  const digits = t.replace(/\D/g, "");
  if (digits.length >= 3) {
    const c = clients.find((x) => x.id === row.clientId);
    if (c?.name && c.name.toLowerCase().includes(t)) return true;
  }
  return String(row.seq).includes(t);
}

export const Evaluation = () => {
  const { store, patch } = useAdminData();
  const [q, setQ] = useState("");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [pickClientId, setPickClientId] = useState(store.clients[0]?.id ?? "");
  const [pickDate, setPickDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [editing, setEditing] = useState<EvaluationRecord | null>(null);

  const [details, setDetails] = useState<DetailPayload>(() => emptyDetails());
  const [summaryNotes, setSummaryNotes] = useState("");

  const sorted = useMemo(
    () => [...store.evaluations].sort((a, b) => b.date.localeCompare(a.date) || b.seq - a.seq),
    [store.evaluations]
  );

  const filtered = useMemo(
    () => sorted.filter((row) => matchesSearch(row, q, store.clients)),
    [sorted, q, store.clients]
  );

  const aptsOnPickDate = useMemo(
    () =>
      [...store.appointments]
        .filter((a) => a.date === pickDate)
        .sort((a, b) => a.time.localeCompare(b.time)),
    [store.appointments, pickDate]
  );

  const openNew = () => {
    const today = format(new Date(), "yyyy-MM-dd");
    setEditing(null);
    setStep(1);
    setPickClientId(store.clients[0]?.id ?? "");
    setPickDate(today);
    setDetails(emptyDetails(today));
    setSummaryNotes("");
    setWizardOpen(true);
  };

  const startFromAppointment = (apt: Appointment) => {
    const existing = store.evaluations.find((e) => e.clientId === apt.clientId && e.date === apt.date);
    if (existing) {
      openEdit(existing);
      return;
    }
    setEditing(null);
    setPickClientId(apt.clientId);
    setPickDate(apt.date);
    setDetails(emptyDetails(apt.date));
    setSummaryNotes("");
    setStep(2);
  };

  const goStep2 = () => {
    const c = store.clients.find((x) => x.id === pickClientId);
    if (!c) {
      toast({ variant: "destructive", title: "Selecione um cliente" });
      return;
    }
    if (hasEvaluation(store, pickClientId, pickDate) && !editing) {
      toast({
        variant: "destructive",
        title: "Já existe avaliação",
        description: "Só é permitida uma avaliação por cliente em cada data.",
      });
      return;
    }
    setEditing(null);
    setDetails(emptyDetails(pickDate));
    setSummaryNotes("");
    setStep(2);
  };

  const openEdit = (row: EvaluationRecord) => {
    setEditing(row);
    setStep(2);
    setPickClientId(row.clientId);
    setPickDate(row.date);
    setDetails(parseDetails(row.detailsJson));
    setSummaryNotes(row.notes ?? "");
    setWizardOpen(true);
  };

  const saveForm = () => {
    const c = store.clients.find((x) => x.id === pickClientId);
    if (!c) return;
    const dup = store.evaluations.some(
      (e) => e.clientId === pickClientId && e.date === pickDate && e.id !== editing?.id
    );
    if (dup) {
      toast({
        variant: "destructive",
        title: "Combinação já existe",
        description: "Já há avaliação para este cliente nesta data.",
      });
      return;
    }
    const detailsJson = JSON.stringify(details);
    if (editing) {
      patch((s) => ({
        ...s,
        evaluations: s.evaluations.map((e) =>
          e.id === editing.id
            ? {
                ...e,
                clientId: pickClientId,
                clientName: c.name,
                date: pickDate,
                notes: summaryNotes.trim() || undefined,
                detailsJson,
              }
            : e
        ),
      }));
      toast({ title: "Avaliação atualizada" });
    } else {
      patch((s) =>
        appendEvaluation(s, {
          clientId: pickClientId,
          clientName: c.name,
          date: pickDate,
          notes: summaryNotes.trim() || undefined,
          detailsJson,
        })
      );
      toast({ title: "Avaliação salva" });
    }
    setWizardOpen(false);
    setEditing(null);
  };

  const setPainLoc = (i: number, patchRow: Partial<DetailPayload["painLocations"][number]>) => {
    setDetails((d) => ({
      ...d,
      painLocations: d.painLocations.map((row, j) => (j === i ? { ...row, ...patchRow } : row)),
    }));
  };

  const setA1 = (i: number, patchRow: Partial<DetailPayload["a1"][number]>) => {
    setDetails((d) => ({
      ...d,
      a1: d.a1.map((row, j) => (j === i ? { ...row, ...patchRow } : row)),
    }));
  };

  const setA2 = (i: number, patchRow: Partial<DetailPayload["a2"][number]>) => {
    setDetails((d) => ({
      ...d,
      a2: d.a2.map((row, j) => (j === i ? { ...row, ...patchRow } : row)),
    }));
  };

  const setEvo = (i: number, patchRow: Partial<DetailPayload["evo"][number]>) => {
    setDetails((d) => ({
      ...d,
      evo: d.evo.map((row, j) => (j === i ? { ...row, ...patchRow } : row)),
    }));
  };

  const addEvoRow = () => {
    setDetails((d) => ({
      ...d,
      evo: [...d.evo, { date: format(new Date(), "yyyy-MM-dd"), text: "" }],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Avaliações</h2>
          <p className="text-muted-foreground">
            Uma ficha por combinação cliente + data. Em <strong className="font-medium text-foreground">Nova avaliação</strong>,
            escolha o dia e toque no horário do paciente na agenda para abrir a ficha mais rápido.
          </p>
        </div>
        <Button type="button" onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" />
          Nova avaliação
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Buscar por paciente, data (AAAA-MM-DD ou DD/MM/AAAA) ou nº..."
          className="pl-10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <Card className="border-border">
        <CardHeader>
          <CardTitle className="text-lg">Todas as avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma avaliação encontrada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Nº</th>
                    <th className="py-2 pr-3 font-medium">Cliente</th>
                    <th className="py-2 pr-3 font-medium">Data</th>
                    <th className="py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">#{row.seq}</td>
                      <td className="py-2 pr-3">{row.clientName}</td>
                      <td className="py-2 pr-3 whitespace-nowrap">{formatDateBR(row.date)}</td>
                      <td className="py-2 text-right">
                        <Button type="button" size="sm" variant="outline" onClick={() => openEdit(row)}>
                          Abrir
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

      <Dialog
        open={wizardOpen}
        onOpenChange={(o) => {
          setWizardOpen(o);
          if (!o) {
            setEditing(null);
            setStep(1);
          }
        }}
      >
        <DialogContent
          className="max-w-3xl max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editing ? `Editar avaliação #${editing.seq}` : "Nova avaliação"}</DialogTitle>
          </DialogHeader>

          {step === 1 && !editing && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="eval-pick-day">Dia</Label>
                <Input
                  id="eval-pick-day"
                  type="date"
                  value={pickDate}
                  onChange={(e) => setPickDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Lista abaixo: consultas da <strong className="font-medium text-foreground">agenda</strong> na data
                  escolhida (horário e paciente). Um clique abre a ficha.
                </p>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 overflow-hidden">
                <div className="border-b border-border bg-muted/50 px-3 py-2">
                  <p className="text-sm font-semibold text-foreground">Agendados neste dia</p>
                  <p className="text-xs text-muted-foreground">{formatDateBR(pickDate)}</p>
                </div>
                {aptsOnPickDate.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">
                    Nenhuma consulta na agenda para esta data. Use a opção “Outro cliente” abaixo ou agende antes na
                    aba Agenda.
                  </p>
                ) : (
                  <ul className="max-h-[min(50vh,340px)] divide-y divide-border overflow-y-auto">
                    {aptsOnPickDate.map((apt) => {
                      const done = store.evaluations.some(
                        (e) => e.clientId === apt.clientId && e.date === apt.date
                      );
                      return (
                        <li
                          key={apt.id}
                          className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                              <span className="text-base font-semibold tabular-nums text-primary">{apt.time}</span>
                              <span className="font-medium text-foreground truncate">{apt.clientName}</span>
                            </div>
                            <p className="text-xs text-muted-foreground truncate">{apt.clientPhone}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {done && (
                              <Badge variant="secondary" className="font-normal">
                                Já avaliado
                              </Badge>
                            )}
                            <Button type="button" size="sm" onClick={() => startFromAppointment(apt)}>
                              {done ? "Abrir ficha" : "Avaliar"}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <details className="group rounded-lg border border-border bg-card">
                <summary className="cursor-pointer list-none px-3 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden flex items-center justify-between gap-2">
                  <span>Outro cliente (sem consulta neste dia na lista)</span>
                  <span className="text-xs font-normal text-muted-foreground group-open:hidden">Expandir</span>
                  <span className="hidden text-xs font-normal text-muted-foreground group-open:inline">Recolher</span>
                </summary>
                <div className="space-y-3 border-t border-border px-3 pb-4 pt-2">
                  <p className="text-xs text-muted-foreground">
                    A data da avaliação continua sendo <strong className="text-foreground">{formatDateBR(pickDate)}</strong>{" "}
                    (campo “Dia” acima).
                  </p>
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select value={pickClientId} onValueChange={setPickClientId}>
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
                  <Button type="button" className="w-full sm:w-auto" onClick={goStep2}>
                    Continuar com este cliente
                  </Button>
                </div>
              </details>

              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setWizardOpen(false)}>
                  Cancelar
                </Button>
              </DialogFooter>
            </div>
          )}

          {(step === 2 || editing) && (
            <div className="space-y-6">
              {!editing && (
                <p className="text-sm text-muted-foreground">
                  {store.clients.find((c) => c.id === pickClientId)?.name} · {formatDateBR(pickDate)}
                </p>
              )}

              <div className="space-y-2">
                <Label>Resumo / observações gerais</Label>
                <Textarea value={summaryNotes} onChange={(e) => setSummaryNotes(e.target.value)} rows={2} />
              </div>

              {/* ── Locais de dor / EVA ── */}
              <Card className="border-border overflow-hidden">
                <CardHeader className="bg-primary/15 py-3">
                  <CardTitle className="text-base">Locais de dor e EVA</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left font-semibold p-2">Local</th>
                          <th className="text-left font-semibold p-2 w-28">EVA (0–10)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.painLocations.map((row, i) => (
                          <tr key={i} className="border-b border-border/60">
                            <td className="p-1">
                              <Input
                                className="h-8 text-sm"
                                placeholder={`Local ${i + 1}`}
                                value={row.local}
                                onChange={(e) => setPainLoc(i, { local: e.target.value })}
                              />
                            </td>
                            <td className="p-1">
                              <Input
                                type="number"
                                min={0}
                                max={10}
                                className="h-8 w-20 text-center"
                                placeholder="—"
                                value={row.eva}
                                onChange={(e) => setPainLoc(i, { eva: e.target.value })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              {/* ── Perguntas S/N (aba ANAMNESE 2 do Excel) ── */}
              <Card className="border-border overflow-hidden">
                <CardHeader className="bg-primary/15 py-3">
                  <CardTitle className="text-base">Anamnese 1</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left font-semibold p-2 w-[45%]">Perguntas</th>
                          <th className="text-center font-semibold p-2">S/N</th>
                          <th className="text-left font-semibold p-2">Obs.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ANAMNESE_1_QUESTIONS.map((question, index) => (
                          HIDDEN_A1_INDICES.has(index) ? null :
                          <tr key={index} className={`border-b border-border ${index % 2 === 1 ? "bg-muted/20" : ""}`}>
                            <td className="p-2 text-foreground">{question}</td>
                            <td className="p-2 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <Checkbox
                                  id={`a1-s-${index}`}
                                  checked={details.a1[index]?.answer === "s"}
                                  onCheckedChange={(v) => {
                                    if (v === true) setA1(index, { answer: "s" });
                                    else if (details.a1[index]?.answer === "s") setA1(index, { answer: undefined });
                                  }}
                                />
                                <Label htmlFor={`a1-s-${index}`} className="text-xs cursor-pointer">
                                  S
                                </Label>
                                <Checkbox
                                  id={`a1-n-${index}`}
                                  checked={details.a1[index]?.answer === "n"}
                                  onCheckedChange={(v) => {
                                    if (v === true) setA1(index, { answer: "n" });
                                    else if (details.a1[index]?.answer === "n") setA1(index, { answer: undefined });
                                  }}
                                />
                                <Label htmlFor={`a1-n-${index}`} className="text-xs cursor-pointer">
                                  N
                                </Label>
                              </div>
                            </td>
                            <td className="p-1">
                              <Input
                                className="h-8 text-xs"
                                value={details.a1[index]?.obs ?? ""}
                                onChange={(e) => setA1(index, { obs: e.target.value })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border overflow-hidden">
                <CardHeader className="bg-primary/15 py-3 flex flex-row items-center justify-between">
                  <CardTitle className="text-base">Evolução</CardTitle>
                  <Button type="button" size="sm" variant="secondary" onClick={addEvoRow}>
                    <Plus className="h-4 w-4 mr-1" />
                    Linha
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="text-left font-semibold p-2 w-36">Data</th>
                          <th className="text-left font-semibold p-2">Evolução</th>
                        </tr>
                      </thead>
                      <tbody>
                        {details.evo.map((row, index) => (
                          <tr key={index} className="border-b border-border">
                            <td className="p-2 align-top">
                              <Input
                                type="date"
                                className="h-9"
                                value={row.date}
                                onChange={(e) => setEvo(index, { date: e.target.value })}
                              />
                            </td>
                            <td className="p-2">
                              <Textarea
                                className="min-h-[72px] resize-y"
                                value={row.text}
                                onChange={(e) => setEvo(index, { text: e.target.value })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>

              <DialogFooter className="gap-2 sm:gap-0">
                {!editing && (
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Voltar
                  </Button>
                )}
                <Button type="button" variant="outline" onClick={() => setWizardOpen(false)}>
                  Fechar
                </Button>
                <Button type="button" onClick={saveForm}>
                  Salvar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
