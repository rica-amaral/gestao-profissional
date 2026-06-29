import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Search, Edit, Plus, ClipboardList, FileText, UserCircle, ChevronLeft, ChevronRight, BarChart2, ChevronDown, Heart, Paperclip, Upload, Trash2, ExternalLink, Loader2 } from "lucide-react";
import {
  useAdminData,
  formatDateBR,
  effectiveLastVisitDate,
  daysSinceLastVisit,
  isStaleClient,
  STALE_CLIENT_MONTHS,
  todayKeyBRT,
} from "@/contexts/AdminDataContext";
import type { Client, ClientHealthData } from "@/lib/admin-types";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

function maxPastAppointmentDate(
  clientId: string,
  appointments: { clientId: string; date: string }[],
  todayKey: string
) {
  const past = appointments
    .filter((a) => a.clientId === clientId && a.date <= todayKey)
    .map((a) => a.date);
  return past.length ? [...past].sort().pop()! : null;
}

export const Clients = () => {
  const { store, patch } = useAdminData();
  const todayKey = todayKeyBRT();
  const [q, setQ] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newBirth, setNewBirth] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [draft, setDraft] = useState<Partial<Client>>({});
  const [sortMode, setSortMode] = useState<"name" | "lastVisit" | "appointments">("name");
  const [genderFilter, setGenderFilter] = useState<"M" | "F" | "O" | null>(null);
  const [priceFilter, setPriceFilter] = useState<number | null>(null);
  const [staleOnly, setStaleOnly] = useState(false);
  const [analyticsOpen, setAnalyticsOpen] = useState(false);

  // ── Exames / Anexos ──────────────────────────────────────────────
  type Attachment = { name: string; path: string; createdAt: string };
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loadingAttachments, setLoadingAttachments] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAttachments = async (clientId: string) => {
    setLoadingAttachments(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoadingAttachments(false); return; }
    const folder = `${user.id}/${clientId}`;
    const { data, error } = await supabase.storage.from("client-files").list(folder, { sortBy: { column: "created_at", order: "desc" } });
    if (!error && data) {
      setAttachments(data.map((f) => ({ name: f.name, path: `${folder}/${f.name}`, createdAt: f.created_at ?? "" })));
    }
    setLoadingAttachments(false);
  };

  const uploadAttachment = async (file: File, clientId: string) => {
    if (file.size > 20 * 1024 * 1024) { toast({ variant: "destructive", title: "Arquivo muito grande (máx 20 MB)" }); return; }
    setUploading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ variant: "destructive", title: "Sessão inválida" }); return; }
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${session.user.id}/${clientId}/${Date.now()}_${safeName}`;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;

      // FormData + fetch com ArrayBuffer para compatibilidade total com Safari
      const buffer = await file.arrayBuffer();
      const blob = new Blob([buffer], { type: file.type || "application/octet-stream" });
      const formData = new FormData();
      formData.append("", blob, file.name);
      const res = await fetch(`${supabaseUrl}/storage/v1/object/client-files/${path}`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "x-upsert": "false",
        },
        body: formData,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
      }

      toast({ title: "Arquivo enviado" });
      await fetchAttachments(clientId);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro ao enviar arquivo", description: e?.message ?? "Erro desconhecido" });
    } finally {
      setUploading(false);
    }
  };

  const deleteAttachment = async (path: string, clientId: string) => {
    const { error } = await supabase.storage.from("client-files").remove([path]);
    if (error) { toast({ variant: "destructive", title: "Erro ao excluir", description: error.message }); }
    else { toast({ title: "Arquivo excluído" }); await fetchAttachments(clientId); }
  };

  const openAttachment = async (path: string) => {
    const { data, error } = await supabase.storage.from("client-files").createSignedUrl(path, 60);
    if (error || !data) { toast({ variant: "destructive", title: "Erro ao abrir arquivo" }); return; }
    window.open(data.signedUrl, "_blank");
  };

  const toggleGender = (g: "M" | "F" | "O") =>
    setGenderFilter((prev) => (prev === g ? null : g));

  // Valores distintos de sessão (baseado no último agendamento pago de cada cliente)
  const distinctPrices = useMemo(() => {
    const prices = new Set<number>();
    store.clients.forEach((c) => {
      const lastPaid = [...store.appointments]
        .filter((a) => a.clientId === c.id && a.date <= todayKey && a.price > 0)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (lastPaid) prices.add(lastPaid.price);
    });
    return [...prices].sort((a, b) => a - b);
  }, [store.clients, store.appointments, todayKey]);

  // Mapa: clientId → preço da última sessão paga
  const clientLastPrice = useMemo(() => {
    const map = new Map<string, number>();
    store.clients.forEach((c) => {
      const last = [...store.appointments]
        .filter((a) => a.clientId === c.id && a.date <= todayKey && a.price > 0)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      if (last) map.set(c.id, last.price);
    });
    return map;
  }, [store.clients, store.appointments, todayKey]);

  // Total de clientes inativos (+6 meses sem consulta), independente dos filtros ativos.
  const staleCount = useMemo(
    () => store.clients.filter((c) => isStaleClient(c, store.appointments, todayKey)).length,
    [store.clients, store.appointments, todayKey]
  );

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    const digits = t.replace(/\D/g, "");
    const list = store.clients.filter((c) => {
      if (t) {
        const nameMatch = c.name.toLowerCase().includes(t);
        const phoneMatch = digits.length >= 3 && c.phone.replace(/\D/g, "").includes(digits);
        if (!nameMatch && !phoneMatch) return false;
      }
      if (genderFilter) {
        const cg = c.gender ?? "O";
        if (cg !== genderFilter) return false;
      }
      if (priceFilter !== null) {
        if (clientLastPrice.get(c.id) !== priceFilter) return false;
      }
      if (staleOnly) {
        if (!isStaleClient(c, store.appointments, todayKey)) return false;
      }
      return true;
    });

    if (sortMode === "name") {
      return list.sort((a, b) => a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" }));
    }
    if (sortMode === "lastVisit") {
      return list.sort((a, b) => {
        const da = effectiveLastVisitDate(a, store.appointments, todayKey) ?? "";
        const db = effectiveLastVisitDate(b, store.appointments, todayKey) ?? "";
        return db.localeCompare(da);
      });
    }
    if (sortMode === "appointments") {
      return list.sort((a, b) => {
        const ca = store.appointments.filter((x) => x.clientId === a.id && x.date <= todayKey).length;
        const cb = store.appointments.filter((x) => x.clientId === b.id && x.date <= todayKey).length;
        return cb - ca;
      });
    }
    return list;
  }, [store.clients, store.appointments, q, sortMode, genderFilter, priceFilter, staleOnly, clientLastPrice, todayKey]);

  const openClientDetail = (c: Client) => {
    setDetailClient(c);
    setDraft({ ...c });
  };

  const currentIdx = detailClient ? filtered.findIndex((c) => c.id === detailClient.id) : -1;

  const goToClient = (c: Client) => {
    setDetailClient(c);
    setDraft({ ...c });
  };

  const goPrev = () => {
    if (currentIdx > 0) goToClient(filtered[currentIdx - 1]);
  };

  const goNext = () => {
    if (currentIdx < filtered.length - 1) goToClient(filtered[currentIdx + 1]);
  };

  const saveClient = () => {
    if (!detailClient) return;
    patch((s) => ({
      ...s,
      clients: s.clients.map((c) =>
        c.id === detailClient.id
          ? {
              ...c,
              name: (draft.name ?? c.name).trim(),
              phone: (draft.phone ?? c.phone).trim(),
              birthDate: draft.birthDate?.trim() || undefined,
              email: draft.email?.trim() || undefined,
              profession: draft.profession?.trim() || undefined,
              city: draft.city?.trim().toUpperCase() || undefined,
              gender: draft.gender,
              notes: draft.notes?.trim() || undefined,
              paymentPending: draft.paymentPending ?? c.paymentPending,
              blocked: draft.blocked ?? c.blocked,
              lastVisitDate: draft.lastVisitDate?.trim() || undefined,
              healthData: draft.healthData ?? c.healthData,
            }
          : c
      ),
      appointments: s.appointments.map((a) =>
        a.clientId === detailClient.id
          ? {
              ...a,
              clientName: (draft.name ?? a.clientName).trim(),
              clientPhone: (draft.phone ?? a.clientPhone).trim(),
            }
          : a
      ),
    }));
    setDetailClient(null);
    toast({ title: "Cliente atualizado" });
  };

  const addClient = () => {
    const name = newName.trim();
    const phone = newPhone.trim();
    if (name.length < 2) {
      toast({ variant: "destructive", title: "Preencha o nome do cliente" });
      return;
    }
    const id = crypto.randomUUID();
    patch((s) => ({
      ...s,
      clients: [
        ...s.clients,
        {
          id,
          name,
          phone,
          birthDate: newBirth.trim() || undefined,
          notes: newNotes.trim() || undefined,
          paymentPending: false,
          blocked: false,
        },
      ],
    }));
    setAddOpen(false);
    setNewName("");
    setNewPhone("");
    setNewBirth("");
    setNewNotes("");
    toast({ title: "Cliente adicionado" });
  };

  // ── Analytics ────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const clients = store.clients;
    const total = clients.length;
    if (total === 0) return null;

    // Gênero
    const gCount = { M: 0, F: 0, O: 0, N: 0 };
    clients.forEach((c) => {
      if (c.gender === "M") gCount.M++;
      else if (c.gender === "F") gCount.F++;
      else if (c.gender === "O") gCount.O++;
      else gCount.N++;
    });

    // Faixa etária
    const ageBuckets = [
      { label: "< 20", min: 0, max: 19, count: 0 },
      { label: "20–29", min: 20, max: 29, count: 0 },
      { label: "30–39", min: 30, max: 39, count: 0 },
      { label: "40–49", min: 40, max: 49, count: 0 },
      { label: "50–59", min: 50, max: 59, count: 0 },
      { label: "60+", min: 60, max: 999, count: 0 },
    ];
    let withAge = 0;
    clients.forEach((c) => {
      if (!c.birthDate) return;
      const age = Math.floor((Date.now() - new Date(c.birthDate + "T12:00:00").getTime()) / 31557600000);
      const b = ageBuckets.find((b) => age >= b.min && age <= b.max);
      if (b) { b.count++; withAge++; }
    });

    // Cidades
    const cityMap: Record<string, number> = {};
    clients.forEach((c) => {
      if (!c.city?.trim()) return;
      const k = c.city.trim();
      cityMap[k] = (cityMap[k] ?? 0) + 1;
    });
    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Mais frequente (passadas)
    const pastApts = store.appointments.filter((a) => a.date <= todayKey);
    const freqMap: Record<string, number> = {};
    pastApts.forEach((a) => { freqMap[a.clientId] = (freqMap[a.clientId] ?? 0) + 1; });
    const topFreqId = Object.entries(freqMap).sort((a, b) => b[1] - a[1])[0];
    const topFreqClient = topFreqId ? clients.find((c) => c.id === topFreqId[0]) : null;

    // Mais lucrativo (soma de pagas)
    const revenueMap: Record<string, number> = {};
    pastApts.filter((a) => a.paid || a.paymentMethod).forEach((a) => {
      revenueMap[a.clientId] = (revenueMap[a.clientId] ?? 0) + (a.price ?? 0);
    });
    const topRevId = Object.entries(revenueMap).sort((a, b) => b[1] - a[1])[0];
    const topRevClient = topRevId ? clients.find((c) => c.id === topRevId[0]) : null;

    return { total, gCount, ageBuckets, withAge, topCities, topFreqClient, topFreqCount: topFreqId?.[1] ?? 0, topRevClient, topRevTotal: topRevId?.[1] ?? 0 };
  }, [store.clients, store.appointments, todayKey]);

  // Mapa clientId → nº de faltas
  const faltaCountMap = useMemo(() => {
    const map = new Map<string, number>();
    store.appointments.forEach((a) => {
      if (a.absent) map.set(a.clientId, (map.get(a.clientId) ?? 0) + 1);
    });
    return map;
  }, [store.appointments]);

  const aptsFor = (id: string) =>
    [...store.appointments].filter((a) => a.clientId === id).sort((a, b) => b.date.localeCompare(a.date));

  const evalsFor = (id: string) =>
    [...store.evaluations].filter((e) => e.clientId === id).sort((a, b) => b.date.localeCompare(a.date));

  const mergedForLastVisit: Client | null = detailClient
    ? {
        ...detailClient,
        ...draft,
        lastVisitDate:
          draft.lastVisitDate !== undefined
            ? draft.lastVisitDate?.trim() || undefined
            : detailClient.lastVisitDate,
      }
    : null;

  const lastIso =
    mergedForLastVisit && effectiveLastVisitDate(mergedForLastVisit, store.appointments, todayKey);
  const daysLabel = mergedForLastVisit ? daysSinceLastVisit(mergedForLastVisit, store.appointments, todayKey) : null;

  const maxPastApt = detailClient
    ? maxPastAppointmentDate(detailClient.id, store.appointments, todayKey)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-foreground mb-2">Clientes</h2>
          <p className="text-muted-foreground">Cadastro e histórico</p>
        </div>
        <Button type="button" onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Adicionar cliente
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou telefone..."
          className="pl-10"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Ordenar:</span>
        <Button
          type="button" size="sm"
          variant={sortMode === "name" ? "default" : "outline"}
          onClick={() => setSortMode("name")}
        >
          Nome A–Z
        </Button>
        <Button
          type="button" size="sm"
          variant={sortMode === "lastVisit" ? "default" : "outline"}
          onClick={() => setSortMode("lastVisit")}
        >
          Última consulta
        </Button>
        <Button
          type="button" size="sm"
          variant={sortMode === "appointments" ? "default" : "outline"}
          onClick={() => setSortMode("appointments")}
        >
          Nº de consultas
        </Button>

        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide ml-2">Sexo:</span>
        <Button
          type="button" size="sm"
          variant={genderFilter === "M" ? "default" : "outline"}
          className={genderFilter === "M" ? "" : "text-blue-600 border-blue-300 hover:bg-blue-50"}
          onClick={() => toggleGender("M")}
        >
          M
        </Button>
        <Button
          type="button" size="sm"
          variant={genderFilter === "F" ? "default" : "outline"}
          className={genderFilter === "F" ? "" : "text-pink-600 border-pink-300 hover:bg-pink-50"}
          onClick={() => toggleGender("F")}
        >
          F
        </Button>
        <Button
          type="button" size="sm"
          variant={genderFilter === "O" ? "default" : "outline"}
          className={genderFilter === "O" ? "" : "text-green-600 border-green-300 hover:bg-green-50"}
          onClick={() => toggleGender("O")}
        >
          Outro
        </Button>
        {distinctPrices.length > 0 && (
          <>
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide ml-2">Valor:</span>
            <Select
              value={priceFilter !== null ? String(priceFilter) : "all"}
              onValueChange={(v) => setPriceFilter(v === "all" ? null : Number(v))}
            >
              <SelectTrigger className={cn("h-8 text-xs w-28", priceFilter !== null && "border-primary bg-primary/5")}>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {distinctPrices.map((p) => (
                  <SelectItem key={p} value={String(p)}>R$ {p.toLocaleString("pt-BR")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide ml-2">Atividade:</span>
        <Button
          type="button" size="sm"
          variant={staleOnly ? "default" : "outline"}
          className={staleOnly ? "" : "text-amber-600 border-amber-300 hover:bg-amber-50"}
          onClick={() => setStaleOnly((v) => !v)}
        >
          Inativos (+{STALE_CLIENT_MONTHS}m){staleCount > 0 ? ` · ${staleCount}` : ""}
        </Button>
        {(sortMode !== "name" || genderFilter || priceFilter !== null || staleOnly) && (
          <Button
            type="button" size="sm" variant="ghost"
            className="text-muted-foreground text-xs"
            onClick={() => { setSortMode("name"); setGenderFilter(null); setPriceFilter(null); setStaleOnly(false); }}
          >
            Limpar
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} cliente(s)</span>
      </div>

      {/* ── Analytics ── */}
      {analytics && (
        <Card className="border-border">
          <CardHeader className="pb-2 cursor-pointer select-none" onClick={() => setAnalyticsOpen((o) => !o)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart2 className="h-4 w-4" />
                Visão geral da base ({analytics.total} clientes)
              </CardTitle>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", analyticsOpen && "rotate-180")} />
            </div>
          </CardHeader>
          {analyticsOpen && (
            <CardContent className="space-y-5 pt-0">
              {/* Gênero */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sexo</p>
                <div className="space-y-1.5">
                  {[
                    { label: "Masculino", count: analytics.gCount.M, color: "bg-blue-500" },
                    { label: "Feminino", count: analytics.gCount.F, color: "bg-pink-500" },
                    { label: "Outro", count: analytics.gCount.O, color: "bg-green-500" },
                    { label: "Não informado", count: analytics.gCount.N, color: "bg-muted-foreground/40" },
                  ].filter((r) => r.count > 0).map((r) => (
                    <div key={r.label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-28 shrink-0">{r.label}</span>
                      <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                        <div
                          className={cn("h-2 rounded-full", r.color)}
                          style={{ width: `${(r.count / analytics.total) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs tabular-nums w-16 text-right text-muted-foreground">
                        {r.count} ({Math.round((r.count / analytics.total) * 100)}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Faixa etária */}
              {analytics.withAge > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Faixa etária ({analytics.withAge} com data de nascimento)
                  </p>
                  <div className="space-y-1.5">
                    {analytics.ageBuckets.filter((b) => b.count > 0).map((b) => (
                      <div key={b.label} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-12 shrink-0">{b.label}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-primary/70"
                            style={{ width: `${(b.count / analytics.withAge) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-16 text-right text-muted-foreground">
                          {b.count} ({Math.round((b.count / analytics.withAge) * 100)}%)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cidades */}
              {analytics.topCities.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Top cidades</p>
                  <div className="space-y-1.5">
                    {analytics.topCities.map(([city, count]) => (
                      <div key={city} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-36 shrink-0 truncate">{city}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-2 rounded-full bg-amber-500/70"
                            style={{ width: `${(count / analytics.topCities[0][1]) * 100}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums w-8 text-right text-muted-foreground">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Distribuição por valor de sessão */}
              {distinctPrices.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Valor de sessão</p>
                  <div className="space-y-1.5">
                    {distinctPrices.map((price) => {
                      const count = [...clientLastPrice.values()].filter((p) => p === price).length;
                      const total = analytics.total;
                      return (
                        <div key={price} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-16 shrink-0">R$ {price.toLocaleString("pt-BR")}</span>
                          <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                            <div
                              className="h-2 rounded-full bg-primary/60"
                              style={{ width: `${(count / total) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs tabular-nums w-20 text-right text-muted-foreground">
                            {count} ({Math.round((count / total) * 100)}%)
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Destaques */}
              <div className="grid sm:grid-cols-2 gap-3">
                {analytics.topFreqClient && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Mais frequente</p>
                    <p className="font-semibold text-foreground text-sm truncate">{analytics.topFreqClient.name}</p>
                    <p className="text-xs text-muted-foreground">{analytics.topFreqCount} consultas realizadas</p>
                  </div>
                )}
                {analytics.topRevClient && (
                  <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <p className="text-xs text-muted-foreground uppercase tracking-wide font-semibold mb-1">Mais lucrativo</p>
                    <p className="font-semibold text-foreground text-sm truncate">{analytics.topRevClient.name}</p>
                    <p className="text-xs text-muted-foreground">R$ {analytics.topRevTotal.toLocaleString("pt-BR")}</p>
                  </div>
                )}
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-border">
        <CardHeader>
          <CardTitle>Lista</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filtered.length === 0 && <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>}
            {filtered.map((client) => {
              const li = effectiveLastVisitDate(client, store.appointments, todayKey);
              const d = daysSinceLastVisit(client, store.appointments, todayKey);
              return (
                <div
                  key={client.id}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 rounded-lg border border-border bg-card"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      client.gender === "M" ? "bg-blue-200/70" : client.gender === "F" ? "bg-pink-200/70" : "bg-green-200/70"
                    )}>
                      <User className={cn(
                        "h-5 w-5",
                        client.gender === "M" ? "text-blue-600" : client.gender === "F" ? "text-pink-600" : "text-green-600"
                      )} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <p className="font-semibold text-foreground truncate">{client.name}</p>
                        {client.birthDate && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {Math.floor((Date.now() - new Date(client.birthDate + "T12:00:00").getTime()) / 31557600000)} anos
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{client.phone}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {(() => {
                          const nextApt = store.appointments
                            .filter((a) => a.clientId === client.id && a.date > todayKey)
                            .sort((a, b) => a.date.localeCompare(b.date))[0];
                          if (nextApt) {
                            const daysUntil = Math.ceil((new Date(nextApt.date + "T12:00:00").getTime() - new Date(todayKey + "T12:00:00").getTime()) / 86400000);
                            return `Próxima em ${daysUntil} dia(s) · ${formatDateBR(nextApt.date)}`;
                          }
                          if (d === null) return "Sem consultas registradas";
                          return `${d} dia(s) desde a última consulta · ref. ${formatDateBR(li!)}`;
                        })()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {store.appointments.filter((a) => a.clientId === client.id && a.date <= todayKey).length} consulta(s) realizadas
                      </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {client.paymentPending && <Badge variant="destructive">Pagamento pendente</Badge>}
                        {client.blocked && <Badge variant="secondary">Bloqueio</Badge>}
                        {(faltaCountMap.get(client.id) ?? 0) > 0 && (
                          <Badge variant="outline" className="font-normal text-red-600 border-red-400/50">
                            {faltaCountMap.get(client.id)} falta{(faltaCountMap.get(client.id) ?? 0) > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {isStaleClient(client, store.appointments, todayKey) && (
                          <Badge variant="outline" className="font-normal text-amber-600 border-amber-400/50">
                            +{STALE_CLIENT_MONTHS} meses sem consulta
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button type="button" size="sm" variant="outline" onClick={() => openClientDetail(client)}>
                      <Edit className="h-4 w-4 sm:mr-1" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Telefone (WhatsApp)</Label>
              <Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="5514..." />
            </div>
            <div className="space-y-2">
              <Label>Nascimento (opcional)</Label>
              <Input type="date" value={newBirth} onChange={(e) => setNewBirth(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" onClick={addClient}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailClient}
        onOpenChange={(open) => {
          if (!open) setDetailClient(null);
        }}
      >
        <DialogContent
          className={cn(
            "flex flex-col gap-0 p-0 max-h-[min(92vh,880px)] w-[calc(100vw-1.5rem)] max-w-5xl overflow-hidden sm:rounded-xl"
          )}
        >
          {detailClient && (
            <>
              <div className="shrink-0 border-b border-border bg-muted/40 px-6 py-5 pr-14">
                <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                    <UserCircle className="h-8 w-8" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <DialogTitle className="text-2xl font-bold leading-tight flex-1">
                        {draft.name || detailClient.name}
                      </DialogTitle>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={goPrev}
                          disabled={currentIdx <= 0}
                          title="Cliente anterior"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {currentIdx + 1}/{filtered.length}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={goNext}
                          disabled={currentIdx >= filtered.length - 1}
                          title="Próximo cliente"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <DialogDescription className="text-base text-muted-foreground">
                      {draft.phone || detailClient.phone}
                    </DialogDescription>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {daysLabel !== null && lastIso && (
                        <Badge variant="outline" className="font-normal">
                          Última consulta há {daysLabel} dia(s) · {formatDateBR(lastIso)}
                        </Badge>
                      )}
                      {(draft.paymentPending ?? detailClient.paymentPending) && (
                        <Badge variant="destructive">Pagamento pendente</Badge>
                      )}
                      {(draft.blocked ?? detailClient.blocked) && <Badge variant="secondary">Bloqueio</Badge>}
                      {(() => {
                        const fc = faltaCountMap.get(detailClient.id) ?? 0;
                        return fc > 0 ? (
                          <Badge variant="outline" className="font-normal text-red-600 border-red-400/50">
                            {fc} falta{fc > 1 ? "s" : ""}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </div>

              <Tabs key={detailClient.id} defaultValue="cadastro" onValueChange={(v) => { if (v === "exames") fetchAttachments(detailClient.id); }} className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-border px-6 pt-4">
                  <TabsList className="grid h-auto w-full grid-cols-5 gap-1 bg-muted/60 p-1 sm:w-auto sm:inline-flex">
                    <TabsTrigger value="cadastro" className="gap-1.5 text-xs sm:text-sm">
                      <User className="h-3.5 w-3.5 shrink-0" />
                      Cadastro
                    </TabsTrigger>
                    <TabsTrigger value="saude" className="gap-1.5 text-xs sm:text-sm">
                      <Heart className="h-3.5 w-3.5 shrink-0" />
                      Saúde
                    </TabsTrigger>
                    <TabsTrigger value="consultas" className="gap-1.5 text-xs sm:text-sm">
                      <ClipboardList className="h-3.5 w-3.5 shrink-0" />
                      Consultas
                    </TabsTrigger>
                    <TabsTrigger value="avaliacoes" className="gap-1.5 text-xs sm:text-sm">
                      <FileText className="h-3.5 w-3.5 shrink-0" />
                      Avaliações
                    </TabsTrigger>
                    <TabsTrigger value="exames" className="gap-1.5 text-xs sm:text-sm">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                      Exames
                    </TabsTrigger>
                  </TabsList>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
                  <TabsContent value="cadastro" className="m-0 focus-visible:outline-none">
                    <div className="space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div className="space-y-1.5 sm:col-span-2">
                          <Label htmlFor="cli-name">Nome</Label>
                          <Input
                            id="cli-name"
                            value={draft.name ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cli-gender">Sexo</Label>
                          <Select
                            value={draft.gender ?? "none"}
                            onValueChange={(v) => setDraft((d) => ({ ...d, gender: (v === "none" ? undefined : v) as Client["gender"] }))}
                          >
                            <SelectTrigger id="cli-gender">
                              <SelectValue placeholder="Não especificado" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Não especificado</SelectItem>
                              <SelectItem value="M">Masculino</SelectItem>
                              <SelectItem value="F">Feminino</SelectItem>
                              <SelectItem value="O">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cli-phone">Telefone (WhatsApp)</Label>
                          <Input
                            id="cli-phone"
                            value={draft.phone ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cli-birth">Nascimento</Label>
                          <Input
                            id="cli-birth"
                            type="date"
                            value={draft.birthDate ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, birthDate: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cli-last">Última consulta (manual)</Label>
                          <Input
                            id="cli-last"
                            type="date"
                            value={draft.lastVisitDate ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, lastVisitDate: e.target.value }))}
                          />
                          {lastIso && (
                            <p className="text-xs text-muted-foreground">
                              Efetiva: {formatDateBR(lastIso)}{daysLabel !== null ? ` · ${daysLabel}d atrás` : ""}
                            </p>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cli-email">E-mail</Label>
                          <Input
                            id="cli-email"
                            type="email"
                            value={draft.email ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cli-profession">Profissão</Label>
                          <Input
                            id="cli-profession"
                            value={draft.profession ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, profession: e.target.value }))}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor="cli-city">Cidade</Label>
                          <Input
                            id="cli-city"
                            value={draft.city ?? ""}
                            onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value.toUpperCase() }))}
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="cli-notes">Observações</Label>
                        <Textarea
                          id="cli-notes"
                          value={draft.notes ?? ""}
                          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-6 rounded-lg border border-border bg-muted/30 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Switch
                            id="cli-pay"
                            checked={draft.paymentPending ?? false}
                            onCheckedChange={(v) => setDraft((d) => ({ ...d, paymentPending: v }))}
                          />
                          <Label htmlFor="cli-pay" className="cursor-pointer font-normal">Pagamento pendente</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            id="cli-block"
                            checked={draft.blocked ?? false}
                            onCheckedChange={(v) => setDraft((d) => ({ ...d, blocked: v }))}
                          />
                          <Label htmlFor="cli-block" className="cursor-pointer font-normal">Bloqueio</Label>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 border-t border-border pt-3">
                        <Button type="button" variant="outline" onClick={() => setDetailClient(null)}>
                          Cancelar
                        </Button>
                        <Button type="button" onClick={saveClient}>
                          Salvar alterações
                        </Button>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="saude" className="m-0 focus-visible:outline-none">
                    {(() => {
                      const hd: ClientHealthData = draft.healthData ?? {};
                      const setHd = (changes: Partial<ClientHealthData>) =>
                        setDraft((d) => ({ ...d, healthData: { ...(d.healthData ?? {}), ...changes } }));
                      const conditions: { key: keyof ClientHealthData; label: string }[] = [
                        { key: "doencaRespiratoria", label: "Doença respiratória" },
                        { key: "osteoporose",        label: "Osteoporose" },
                        { key: "artrose",            label: "Artrose" },
                        { key: "diabetes",           label: "Diabetes" },
                        { key: "hipertensao",        label: "Hipertensão" },
                        { key: "fumante",            label: "Fumante" },
                        { key: "ansiedade",          label: "Ansiedade" },
                        { key: "dorCabeca",          label: "Dor de cabeça / Enxaqueca" },
                        { key: "depressao",          label: "Depressão" },
                        { key: "maniaEstalar",       label: "Mania de 'estalar' a coluna" },
                      ];
                      return (
                        <div className="space-y-5">
                          {/* Medidas */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label>Peso (kg)</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.1"
                                value={hd.peso ?? ""}
                                onChange={(e) => setHd({ peso: e.target.value })}
                                placeholder="Ex: 72.5"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label>Altura (cm)</Label>
                              <Input
                                type="number"
                                min={0}
                                step="1"
                                value={hd.altura ?? ""}
                                onChange={(e) => setHd({ altura: e.target.value })}
                                placeholder="Ex: 170"
                              />
                            </div>
                          </div>

                          {/* Patologias */}
                          <Card className="border-border overflow-hidden">
                            <CardHeader className="bg-primary/10 py-3">
                              <CardTitle className="text-sm font-semibold">Patologias</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-4">
                              <div className="space-y-1.5">
                                <Label>Patologia na coluna</Label>
                                <Textarea
                                  rows={2}
                                  value={hd.pathologiaColuna ?? ""}
                                  onChange={(e) => setHd({ pathologiaColuna: e.target.value })}
                                  placeholder="Ex: hérnia L4-L5, escoliose..."
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label>Demais patologias</Label>
                                <Textarea
                                  rows={2}
                                  value={hd.demaisPatologias ?? ""}
                                  onChange={(e) => setHd({ demaisPatologias: e.target.value })}
                                  placeholder="Outras condições relevantes..."
                                />
                              </div>
                            </CardContent>
                          </Card>

                          {/* Cirurgias + Exercício */}
                          <Card className="border-border overflow-hidden">
                            <CardHeader className="bg-primary/10 py-3">
                              <CardTitle className="text-sm font-semibold">Cirurgias e atividade física</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-4">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1.5">
                                  <Label>Cirurgias</Label>
                                  <Input
                                    value={hd.cirurgias ?? ""}
                                    onChange={(e) => setHd({ cirurgias: e.target.value })}
                                    placeholder="Ex: coluna, joelho..."
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label>Quando?</Label>
                                  <Input
                                    value={hd.cirurgiasQuando ?? ""}
                                    onChange={(e) => setHd({ cirurgiasQuando: e.target.value })}
                                    placeholder="Ex: 2019, há 3 anos..."
                                  />
                                </div>
                              </div>
                              <div className="space-y-1.5">
                                <Label>Exercício físico</Label>
                                <Input
                                  value={hd.exercicioFisico ?? ""}
                                  onChange={(e) => setHd({ exercicioFisico: e.target.value })}
                                  placeholder="Ex: musculação 3x/sem, caminhada..."
                                />
                              </div>
                            </CardContent>
                          </Card>

                          {/* Condições S/N */}
                          <Card className="border-border overflow-hidden">
                            <CardHeader className="bg-primary/10 py-3">
                              <CardTitle className="text-sm font-semibold">Condições de saúde</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                                {conditions.map(({ key, label }) => (
                                  <div key={key} className="flex items-center gap-2">
                                    <Checkbox
                                      id={`hd-${key}`}
                                      checked={!!(hd[key] as boolean | undefined)}
                                      onCheckedChange={(v) => setHd({ [key]: v === true })}
                                    />
                                    <Label htmlFor={`hd-${key}`} className="cursor-pointer font-normal text-sm">
                                      {label}
                                    </Label>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          {/* Estilo de vida */}
                          <Card className="border-border overflow-hidden">
                            <CardHeader className="bg-primary/10 py-3">
                              <CardTitle className="text-sm font-semibold">Estilo de vida (nota 0–5)</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-4">
                              <div className="grid grid-cols-3 gap-4">
                                {(
                                  [
                                    { key: "notaSono" as keyof ClientHealthData, label: "Sono" },
                                    { key: "notaAlimentacao" as keyof ClientHealthData, label: "Alimentação" },
                                    { key: "notaAgua" as keyof ClientHealthData, label: "Ingestão de água" },
                                  ] as { key: keyof ClientHealthData; label: string }[]
                                ).map(({ key, label }) => (
                                  <div key={key} className="space-y-1.5">
                                    <Label className="text-xs">{label}</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      max={5}
                                      className="h-9 text-center"
                                      value={(hd[key] as string | undefined) ?? ""}
                                      onChange={(e) => setHd({ [key]: e.target.value })}
                                      placeholder="—"
                                    />
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                          </Card>

                          <div className="flex justify-end gap-2 border-t border-border pt-3">
                            <Button type="button" variant="outline" onClick={() => setDetailClient(null)}>
                              Cancelar
                            </Button>
                            <Button type="button" onClick={saveClient}>
                              Salvar alterações
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </TabsContent>

                  <TabsContent value="consultas" className="m-0 focus-visible:outline-none">
                    <Card className="border-border shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Atendimentos e pagamento</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Consultas agendadas, confirmação e situação de pagamento por sessão.
                        </p>
                      </CardHeader>
                      <CardContent>
                        {aptsFor(detailClient.id).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhum agendamento para este paciente.</p>
                        ) : (
                          <div className="overflow-x-auto rounded-md border border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                                  <th className="px-3 py-2 font-medium">Data / hora</th>
                                  <th className="px-3 py-2 font-medium">Valor</th>
                                  <th className="px-3 py-2 font-medium">Pagamento</th>
                                  <th className="px-3 py-2 font-medium">Obs.</th>
                                </tr>
                              </thead>
                              <tbody>
                                {aptsFor(detailClient.id).map((a) => {
                                  const isFuture = a.date > todayKey;
                                  const methodLabel: Record<string, string> = {
                                    pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro", permuta: "Permuta",
                                  };
                                  return (
                                  <tr key={a.id} className="border-b border-border/80 last:border-0">
                                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-foreground">
                                      {formatDateBR(a.date)} · {a.time}
                                    </td>
                                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                                      {a.price > 0 ? `R$ ${a.price.toFixed(0)}` : "—"}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {a.absent ? (
                                        <Badge variant="outline" className="font-normal text-red-600 border-red-400/50 bg-red-500/8">
                                          Falta
                                        </Badge>
                                      ) : a.paymentMethod ? (
                                        <Badge className="font-normal bg-green-600/90 hover:bg-green-600">
                                          {methodLabel[a.paymentMethod] ?? a.paymentMethod}
                                        </Badge>
                                      ) : isFuture ? (
                                        <span className="text-xs text-muted-foreground">Planejado</span>
                                      ) : a.paid ? (
                                        <Badge className="font-normal">Pago</Badge>
                                      ) : (
                                        <Badge variant="outline" className="font-normal text-destructive border-destructive/40">
                                          Não pago
                                        </Badge>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate" title={a.notes}>
                                      {a.notes ?? "—"}
                                    </td>
                                  </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="avaliacoes" className="m-0 focus-visible:outline-none">
                    <Card className="border-border shadow-none">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Avaliações</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Fichas registradas na aba Avaliações do painel.
                        </p>
                      </CardHeader>
                      <CardContent>
                        {evalsFor(detailClient.id).length === 0 ? (
                          <p className="text-sm text-muted-foreground">Nenhuma avaliação para este paciente.</p>
                        ) : (
                          <ul className="space-y-3">
                            {evalsFor(detailClient.id).map((e) => (
                              <li
                                key={e.id}
                                className="rounded-lg border border-border bg-card px-4 py-3 text-sm"
                              >
                                <div className="flex flex-wrap items-baseline gap-2">
                                  <span className="font-semibold text-foreground">#{e.seq}</span>
                                  <span className="text-muted-foreground">{formatDateBR(e.date)}</span>
                                </div>
                                {e.notes && <p className="mt-2 text-muted-foreground">{e.notes}</p>}
                              </li>
                            ))}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>

                  <TabsContent value="exames" className="m-0 focus-visible:outline-none">
                    <Card className="border-border shadow-none">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base font-semibold">Exames e anexos</CardTitle>
                            <p className="text-sm text-muted-foreground mt-1">PDF, JPG ou PNG · máx 20 MB por arquivo</p>
                          </div>
                          <label className={cn("cursor-pointer", uploading && "pointer-events-none opacity-50")}>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              disabled={uploading}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadAttachment(file, detailClient.id);
                                e.target.value = "";
                              }}
                            />
                            <Button type="button" size="sm" asChild>
                              <span>
                                {uploading ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Upload className="h-4 w-4 mr-1.5" />}
                                {uploading ? "Enviando..." : "Enviar arquivo"}
                              </span>
                            </Button>
                          </label>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {loadingAttachments ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                          </div>
                        ) : attachments.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4 text-center">Nenhum arquivo anexado.</p>
                        ) : (
                          <ul className="space-y-2">
                            {attachments.map((att) => {
                              const displayName = att.name.replace(/^\d+_/, "");
                              const isPdf = att.name.toLowerCase().endsWith(".pdf");
                              return (
                                <li key={att.path} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                                  <FileText className={cn("h-5 w-5 shrink-0", isPdf ? "text-red-500" : "text-blue-500")} />
                                  <span className="flex-1 text-sm font-medium text-foreground truncate" title={displayName}>
                                    {displayName}
                                  </span>
                                  <div className="flex gap-1 shrink-0">
                                    <Button
                                      type="button" size="icon" variant="ghost" className="h-8 w-8"
                                      title="Abrir"
                                      onClick={() => openAttachment(att.path)}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      type="button" size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
                                      title="Excluir"
                                      onClick={() => deleteAttachment(att.path, detailClient.id)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </CardContent>
                    </Card>
                  </TabsContent>
                </div>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>

    </div>
  );
};
