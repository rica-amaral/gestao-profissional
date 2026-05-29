import type { AdminStore, Appointment, Client, EvaluationRecord } from "./admin-types";

/** Separador: vírgula ou ponto e vírgula (detectado na primeira linha). */
export function splitCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
    } else if ((c === "," || c === ";") && !inQ) {
      out.push(cur.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim().replace(/^"|"$/g, "").replace(/""/g, '"'));
  return out;
}

export function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  return lines.map(splitCSVLine);
}

export function parseBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "sim" || s === "s" || s === "yes" || s === "true" || s === "1";
}

function normPhone(p: string) {
  return p.replace(/\D/g, "");
}

function normTime(t: string): string {
  const s = t.trim();
  const parts = s.split(":");
  if (parts.length < 2) return s;
  const h = parts[0].padStart(2, "0");
  const m = (parts[1] || "00").replace(/\D/g, "").padStart(2, "0").slice(0, 2);
  return `${h}:${m}`;
}

function headerMap(header: string[]): Record<string, number> {
  const m: Record<string, number> = {};
  header.forEach((h, i) => {
    m[h.trim().toLowerCase()] = i;
  });
  return m;
}

function req(m: Record<string, number>, name: string, row: string[], rowNum: number): string {
  const i = m[name.toLowerCase()];
  if (i === undefined) throw new Error(`Coluna obrigatória ausente: ${name}`);
  const v = row[i]?.trim() ?? "";
  if (!v) throw new Error(`Linha ${rowNum}: ${name} vazio`);
  return v;
}

function opt(m: Record<string, number>, name: string, row: string[]): string {
  const i = m[name.toLowerCase()];
  if (i === undefined) return "";
  return row[i]?.trim() ?? "";
}

export const TEMPLATE_CLIENTS = `id,name,phone,birthDate,notes,paymentPending,blocked,lastVisitDate
,João Exemplo,5514999998888,1990-03-15,,nao,nao,2026-04-01`;

export const TEMPLATE_APPOINTMENTS = `id,date,time,clientId,clientName,clientPhone,confirmed,paid,notes
,2026-04-15,10:00,c1,Maria Silva,5514999991111,sim,nao,`;

export const TEMPLATE_EVALUATIONS = `clientId,clientName,date,notes,detailsJson
c1,Maria Silva,2026-04-10,Primeira avaliação importada,`;

export const TEMPLATE_PAYMENTS = `date,time,clientId,paid,confirmed
2026-04-10,09:00,c1,sim,sim`;

export const TEMPLATE_PAYMENTS_BY_ID = `appointment_id,paid,confirmed
a1,sim,`;

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const bom = "\uFEFF";
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export type ImportReport = { ok: number; errors: string[]; warnings: string[] };

export function importClientsFromRows(rows: string[][], store: AdminStore): { store: AdminStore; report: ImportReport } {
  const report: ImportReport = { ok: 0, errors: [], warnings: [] };
  if (rows.length < 2) {
    report.errors.push("Arquivo vazio ou só cabeçalho.");
    return { store, report };
  }
  const h = headerMap(rows[0]);
  let clients = [...store.clients];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c.trim())) continue;
    const rowNum = r + 1;
    try {
      const name = req(h, "name", row, rowNum);
      const phone = req(h, "phone", row, rowNum);
      const idIn = opt(h, "id", row);
      const birthDate = opt(h, "birthDate", row) || undefined;
      const notes = opt(h, "notes", row) || undefined;
      const paymentPending = parseBool(opt(h, "paymentPending", row) || "nao");
      const blocked = parseBool(opt(h, "blocked", row) || "nao");
      const lastVisitDate = opt(h, "lastVisitDate", row) || undefined;

      const pNorm = normPhone(phone);
      const payload = {
        name,
        phone,
        birthDate,
        notes,
        paymentPending,
        blocked,
        lastVisitDate,
      };

      const byId = idIn ? clients.find((c) => c.id === idIn) : undefined;
      const byPhone = pNorm.length >= 8 ? clients.find((c) => normPhone(c.phone) === pNorm) : undefined;

      if (byId) {
        clients = clients.map((c) => (c.id === byId.id ? { ...c, ...payload, id: c.id } : c));
      } else if (byPhone) {
        clients = clients.map((c) => (c.id === byPhone.id ? { ...c, ...payload, id: c.id } : c));
        report.warnings.push(`Linha ${rowNum}: cliente atualizado pelo telefone (${byPhone.id}).`);
      } else {
        const newId = crypto.randomUUID();
        clients.push({ id: newId, ...payload });
      }
      report.ok++;
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { store: { ...store, clients }, report };
}

export function importAppointmentsFromRows(rows: string[][], store: AdminStore): { store: AdminStore; report: ImportReport } {
  const report: ImportReport = { ok: 0, errors: [], warnings: [] };
  if (rows.length < 2) {
    report.errors.push("Arquivo vazio ou só cabeçalho.");
    return { store, report };
  }
  const h = headerMap(rows[0]);
  let appointments = [...store.appointments];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c.trim())) continue;
    const rowNum = r + 1;
    try {
      const date = req(h, "date", row, rowNum);
      const timeRaw = req(h, "time", row, rowNum);
      const time = normTime(timeRaw);
      const clientId = req(h, "clientId", row, rowNum);
      const clientName = req(h, "clientName", row, rowNum);
      const clientPhone = req(h, "clientPhone", row, rowNum);
      const confirmed = parseBool(opt(h, "confirmed", row) || "nao");
      const paid = parseBool(opt(h, "paid", row) || "nao");
      const notes = opt(h, "notes", row) || undefined;
      const idIn = opt(h, "id", row);

      if (!store.clients.some((c) => c.id === clientId)) {
        report.warnings.push(`Linha ${rowNum}: clientId "${clientId}" não existe no cadastro — agendamento criado mesmo assim.`);
      }

      if (idIn && appointments.some((a) => a.id === idIn)) {
        appointments = appointments.map((a) =>
          a.id === idIn
            ? { ...a, date, time, clientId, clientName, clientPhone, confirmed, paid, notes }
            : a
        );
      } else {
        const dup = appointments.find((a) => a.date === date && a.time === time && a.clientId === clientId);
        if (dup) {
          appointments = appointments.map((a) =>
            a.id === dup.id ? { ...a, clientName, clientPhone, confirmed, paid, notes } : a
          );
          report.warnings.push(`Linha ${rowNum}: atualizado agendamento existente ${dup.id} (mesma data/hora/cliente).`);
        } else {
          const id = crypto.randomUUID();
          appointments.push({
            id,
            date,
            time,
            clientId,
            clientName,
            clientPhone,
            confirmed,
            paid,
            notes,
          });
        }
      }
      report.ok++;
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { store: { ...store, appointments }, report };
}

export function importEvaluationsFromRows(rows: string[][], store: AdminStore): { store: AdminStore; report: ImportReport } {
  const report: ImportReport = { ok: 0, errors: [], warnings: [] };
  if (rows.length < 2) {
    report.errors.push("Arquivo vazio ou só cabeçalho.");
    return { store, report };
  }
  const h = headerMap(rows[0]);
  let evaluations = [...store.evaluations];
  let nextSeq = store.nextEvalSeq;

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c.trim())) continue;
    const rowNum = r + 1;
    try {
      const clientId = req(h, "clientId", row, rowNum);
      const clientName = req(h, "clientName", row, rowNum);
      const date = req(h, "date", row, rowNum);
      const notes = opt(h, "notes", row) || undefined;
      const detailsJson = opt(h, "detailsJson", row) || undefined;

      const idx = evaluations.findIndex((e) => e.clientId === clientId && e.date === date);
      if (idx >= 0) {
        evaluations = evaluations.map((e, i) =>
          i === idx ? { ...e, clientName, notes, detailsJson: detailsJson || e.detailsJson } : e
        );
        report.warnings.push(`Linha ${rowNum}: avaliação já existia para este cliente/data — atualizada.`);
      } else {
        const id = crypto.randomUUID();
        const seq = nextSeq++;
        evaluations.push({
          id,
          seq,
          clientId,
          clientName,
          date,
          createdAt: new Date().toISOString(),
          notes,
          detailsJson,
        });
      }
      report.ok++;
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { store: { ...store, evaluations, nextEvalSeq: nextSeq }, report };
}

export function importPaymentsFromRows(rows: string[][], store: AdminStore): { store: AdminStore; report: ImportReport } {
  const report: ImportReport = { ok: 0, errors: [], warnings: [] };
  if (rows.length < 2) {
    report.errors.push("Arquivo vazio ou só cabeçalho.");
    return { store, report };
  }
  const h = headerMap(rows[0]);
  const hasAppId = h["appointment_id"] !== undefined;
  let appointments = [...store.appointments];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (row.every((c) => !c.trim())) continue;
    const rowNum = r + 1;
    try {
      let apt: Appointment | undefined;
      if (hasAppId) {
        const aid = req(h, "appointment_id", row, rowNum);
        apt = appointments.find((a) => a.id === aid);
        if (!apt) throw new Error(`Linha ${rowNum}: agendamento "${aid}" não encontrado`);
      } else {
        const date = req(h, "date", row, rowNum);
        const time = normTime(req(h, "time", row, rowNum));
        const clientId = req(h, "clientId", row, rowNum);
        apt = appointments.find((a) => a.date === date && a.time === time && a.clientId === clientId);
        if (!apt) throw new Error(`Linha ${rowNum}: nenhum agendamento em ${date} ${time} para cliente ${clientId}`);
      }
      const paid = parseBool(req(h, "paid", row, rowNum));
      const confirmedOpt = opt(h, "confirmed", row);
      appointments = appointments.map((a) =>
        a.id === apt!.id
          ? {
              ...a,
              paid,
              ...(confirmedOpt !== "" ? { confirmed: parseBool(confirmedOpt) } : {}),
            }
          : a
      );
      report.ok++;
    } catch (e) {
      report.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return { store: { ...store, appointments }, report };
}
