import { useRef, useState, type RefObject } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Upload, Download, FileSpreadsheet } from "lucide-react";
import { useAdminData } from "@/contexts/AdminDataContext";
import { toast } from "@/hooks/use-toast";
import {
  parseCSV,
  downloadTextFile,
  TEMPLATE_CLIENTS,
  TEMPLATE_APPOINTMENTS,
  TEMPLATE_EVALUATIONS,
  TEMPLATE_PAYMENTS,
  TEMPLATE_PAYMENTS_BY_ID,
  importClientsFromRows,
  importAppointmentsFromRows,
  importEvaluationsFromRows,
  importPaymentsFromRows,
} from "@/lib/csv-import";

type ImportKind = "clients" | "appointments" | "evaluations" | "payments";

export function DataImportSection() {
  const { patch } = useAdminData();
  const [busy, setBusy] = useState<ImportKind | null>(null);

  const refClients = useRef<HTMLInputElement>(null);
  const refApts = useRef<HTMLInputElement>(null);
  const refEvals = useRef<HTMLInputElement>(null);
  const refPay = useRef<HTMLInputElement>(null);

  const showReport = (label: string, ok: number, errors: string[], warnings: string[]) => {
    if (errors.length === 0) {
      toast({
        title: `${label}: importação concluída`,
        description: `${ok} linha(s) processada(s).${warnings.length ? ` Avisos: ${warnings.length}.` : ""}`,
      });
    } else {
      toast({
        variant: "destructive",
        title: `${label}: concluído com erros`,
        description: `${ok} ok · ${errors.length} erro(s). Veja o console para detalhes.`,
      });
    }
    if (errors.length) console.error(`[Import ${label}]`, errors);
    if (warnings.length) console.warn(`[Import ${label}]`, warnings);
  };

  const handleFile = async (file: File | null, kind: ImportKind) => {
    if (!file) return;
    setBusy(kind);
    try {
      const text = await file.text();
      const rows = parseCSV(text);

      let rep = { ok: 0, errors: [] as string[], warnings: [] as string[] };
      patch((s) => {
        switch (kind) {
          case "clients": {
            const r = importClientsFromRows(rows, s);
            rep = r.report;
            return r.store;
          }
          case "appointments": {
            const r = importAppointmentsFromRows(rows, s);
            rep = r.report;
            return r.store;
          }
          case "evaluations": {
            const r = importEvaluationsFromRows(rows, s);
            rep = r.report;
            return r.store;
          }
          case "payments": {
            const r = importPaymentsFromRows(rows, s);
            rep = r.report;
            return r.store;
          }
          default:
            return s;
        }
      });
      const titles: Record<ImportKind, string> = {
        clients: "Clientes",
        appointments: "Agendamentos",
        evaluations: "Avaliações",
        payments: "Pagamentos",
      };
      showReport(titles[kind], rep.ok, rep.errors, rep.warnings);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Falha ao ler arquivo",
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(null);
      if (kind === "clients" && refClients.current) refClients.current.value = "";
      if (kind === "appointments" && refApts.current) refApts.current.value = "";
      if (kind === "evaluations" && refEvals.current) refEvals.current.value = "";
      if (kind === "payments" && refPay.current) refPay.current.value = "";
    }
  };

  return (
    <Card className="border-border">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Upload className="h-5 w-5" />
          Importação de dados (CSV)
        </CardTitle>
        <CardDescription>
          Planilhas em formato <strong className="text-foreground">CSV</strong> (UTF-8). Use vírgula ou ponto e vírgula
          como separador. Valores <strong className="text-foreground">sim</strong> / <strong className="text-foreground">nao</strong>{" "}
          para campos lógicos. Baixe o modelo de cada tipo, preencha e envie. Os dados são <strong className="text-foreground">mesclados</strong>{" "}
          com o que já está no painel (atualiza por id, telefone ou data/hora conforme o tipo).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-sm font-medium text-foreground flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" />
            Planilhas modelo
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => downloadTextFile("modelo_clientes.csv", TEMPLATE_CLIENTS)}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Clientes
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadTextFile("modelo_agendamentos.csv", TEMPLATE_APPOINTMENTS)}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Agendamentos
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadTextFile("modelo_avaliacoes.csv", TEMPLATE_EVALUATIONS)}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Avaliações
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadTextFile("modelo_pagamentos_data.csv", TEMPLATE_PAYMENTS)}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Pagamentos (data/hora)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadTextFile("modelo_pagamentos_id.csv", TEMPLATE_PAYMENTS_BY_ID)}
            >
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Pagamentos (ID agendamento)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Datas no formato <code className="text-foreground">AAAA-MM-DD</code>. Horários <code className="text-foreground">HH:MM</code>.
            Em pagamentos: ou colunas <code className="text-foreground">date,time,clientId,paid</code> (e opcional{" "}
            <code className="text-foreground">confirmed</code>), ou só <code className="text-foreground">appointment_id,paid</code>.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <ImportRow
            title="Clientes"
            hint="Colunas: id, name, phone, birthDate, notes, paymentPending, blocked, lastVisitDate. id vazio cria novo; telefone repetido atualiza."
            inputRef={refClients}
            disabled={busy !== null}
            onPick={(f) => handleFile(f, "clients")}
          />
          <ImportRow
            title="Agendamentos"
            hint="Colunas: id, date, time, clientId, clientName, clientPhone, confirmed, paid, notes. clientId deve existir no cadastro (recomendado importar clientes antes)."
            inputRef={refApts}
            disabled={busy !== null}
            onPick={(f) => handleFile(f, "appointments")}
          />
          <ImportRow
            title="Avaliações"
            hint="Colunas: clientId, clientName, date, notes, detailsJson (opcional). Uma linha por cliente+data; repetido atualiza."
            inputRef={refEvals}
            disabled={busy !== null}
            onPick={(f) => handleFile(f, "evaluations")}
          />
          <ImportRow
            title="Pagamentos"
            hint="Atualiza pago/confirmado nos agendamentos. Use modelo por data/hora+clientId ou por appointment_id."
            inputRef={refPay}
            disabled={busy !== null}
            onPick={(f) => handleFile(f, "payments")}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ImportRow({
  title,
  hint,
  inputRef,
  disabled,
  onPick,
}: {
  title: string;
  hint: string;
  inputRef: RefObject<HTMLInputElement>;
  disabled: boolean;
  onPick: (file: File | null) => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-border p-4">
      <Label className="text-base font-semibold">{title}</Label>
      <p className="text-xs text-muted-foreground leading-relaxed">{hint}</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv,text/plain"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
      />
      <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={() => inputRef.current?.click()}>
        <Upload className="h-3.5 w-3.5 mr-1.5" />
        Carregar CSV
      </Button>
    </div>
  );
}
