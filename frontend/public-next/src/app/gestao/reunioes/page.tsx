"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle, Plus, Sparkles, Users, Clock, X } from "lucide-react";
import GestaoGuard, { useGestaoSession } from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Status = "RASCUNHO" | "FINALIZADA";

type Meeting = {
  id: string;
  title: string;
  type: string;
  date: string;
  time: string | null;
  participants: string[] | null;
  agenda: string | null;
  notes: string | null;
  decisions: { decision: string; responsible?: string; dueDate?: string }[] | null;
  status: Status;
  createdByName: string;
};

type DirectoryUser = { name: string; email: string; role: string };
type AgendaSuggestion = { origin: string; reason: string; priority: "BAIXA" | "NORMAL" | "ALTA" | "CRITICA"; responsible: string | null; link: string; refId: string };
type TimeSuggestion = { date: string; time: string; availableCount: number; totalCount: number; unavailable: { email: string; reason: string }[] };
type Conflict = { email: string; reason: string };

const emptyForm = { title: "", type: "Ordinária", date: "", time: "", participants: "", agenda: "", notes: "" };
const PRIORITY_COLOR: Record<string, string> = { CRITICA: "bg-red-100 text-red-700", ALTA: "bg-orange-100 text-orange-700", NORMAL: "bg-slate-100 text-slate-600", BAIXA: "bg-slate-100 text-slate-500" };

function ReunioesContent() {
  const session = useGestaoSession();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formParticipantEmails, setFormParticipantEmails] = useState<Set<string>>(new Set());
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);

  const [preparing, setPreparing] = useState(false);
  const [directory, setDirectory] = useState<DirectoryUser[]>([]);
  const [suggestions, setSuggestions] = useState<AgendaSuggestion[]>([]);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [timeSuggestions, setTimeSuggestions] = useState<TimeSuggestion[] | null>(null);
  const [loadingTimes, setLoadingTimes] = useState(false);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  useEffect(() => {
    compexApi<DirectoryUser[]>("/meetings/directory").then(setDirectory).catch(() => setDirectory([]));
  }, []);

  // Vem do banner "Existem N assuntos relevantes..." da Central da Presidência
  // (/gestao/reunioes?prepare=1) — abre direto no fluxo de preparação, já com as pautas sugeridas.
  useEffect(() => {
    if (searchParams.get("prepare") === "1") startPreparing();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = async () => {
    try {
      const result = await compexApi<Meeting[]>("/meetings");
      setItems(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as reuniões.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const createMeeting = async () => {
    try {
      await compexApi("/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          date: form.date,
          time: form.time || undefined,
          participants: form.participants.split(",").map((p) => p.trim()).filter(Boolean),
          participantEmails: formParticipantEmails.size ? Array.from(formParticipantEmails) : undefined,
          agenda: form.agenda.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      setForm(emptyForm);
      setFormParticipantEmails(new Set());
      setConflicts(null);
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar a reunião.");
    }
  };

  const submit = async () => {
    if (!form.title.trim() || !form.date) { setError("Informe título e data."); return; }
    setConflicts(null);
    // Só dá pra checar conflito quando há participantes internos marcados e horário definido —
    // participantes digitados em texto livre não têm e-mail pra cruzar com a agenda de ninguém.
    if (formParticipantEmails.size > 0 && form.time) {
      setCheckingConflicts(true);
      try {
        const result = await compexApi<{ conflicts: Conflict[] }>("/meetings/check-conflicts", {
          method: "POST",
          body: JSON.stringify({ participantEmails: Array.from(formParticipantEmails), date: form.date, time: form.time, durationMinutes: 60 }),
        });
        if (result.conflicts.length > 0) { setConflicts(result.conflicts); setCheckingConflicts(false); return; }
      } catch {
        // se a checagem falhar, não bloqueia o registro da reunião
      } finally {
        setCheckingConflicts(false);
      }
    }
    await createMeeting();
  };

  const finalize = async (id: string) => {
    if (!window.confirm("Finalizar esta reunião como ata oficial? Depois de finalizada não pode mais ser editada.")) return;
    try {
      await compexApi("/meetings", { method: "PUT", body: JSON.stringify({ id, action: "finalize" }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível finalizar a ata.");
    }
  };

  const startPreparing = async () => {
    setPreparing(true);
    setTimeSuggestions(null);
    try {
      setSuggestions(await compexApi<AgendaSuggestion[]>("/meetings/suggested-agenda"));
    } catch {
      setSuggestions([]);
    }
  };

  const toggleSuggestion = (index: number) => setSelectedSuggestions((prev) => { const next = new Set(prev); next.has(index) ? next.delete(index) : next.add(index); return next; });
  const toggleParticipant = (email: string) => setSelectedParticipants((prev) => { const next = new Set(prev); next.has(email) ? next.delete(email) : next.add(email); return next; });
  const toggleFormParticipant = (email: string) => { setConflicts(null); setFormParticipantEmails((prev) => { const next = new Set(prev); next.has(email) ? next.delete(email) : next.add(email); return next; }); };

  const findTimes = async () => {
    if (selectedParticipants.size === 0) { setError("Selecione ao menos um participante."); return; }
    setLoadingTimes(true);
    setError("");
    try {
      const result = await compexApi<TimeSuggestion[]>("/meetings/suggest-times", {
        method: "POST",
        body: JSON.stringify({ participantEmails: Array.from(selectedParticipants), durationMinutes: 60, windowDays: 14 }),
      });
      setTimeSuggestions(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível sugerir horários.");
    } finally {
      setLoadingTimes(false);
    }
  };

  const applySuggestionsToForm = (slot?: TimeSuggestion) => {
    const agendaText = Array.from(selectedSuggestions).map((i) => `• ${suggestions[i].reason}`).join("\n");
    const participantNames = directory.filter((d) => selectedParticipants.has(d.email)).map((d) => d.name).join(", ");
    setForm((prev) => ({
      ...prev,
      agenda: agendaText || prev.agenda,
      participants: participantNames || prev.participants,
      date: slot?.date || prev.date,
      time: slot?.time || prev.time,
    }));
    setFormParticipantEmails(new Set(selectedParticipants));
    setConflicts(null);
    setPreparing(false);
    setSelectedSuggestions(new Set());
    setSelectedParticipants(new Set());
    setTimeSuggestions(null);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 sm:px-9">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Reuniões e Atas</h1>
          <p className="text-sm text-slate-500">Pauta, decisões e responsáveis registrados — atas finalizadas nunca são apagadas.</p>
        </div>
        <button type="button" onClick={startPreparing} className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-100">
          <Sparkles size={16} /> Preparar reunião
        </button>
      </header>

      {preparing && (
        <div className="compex-card mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Preparar reunião</h2>
            <button type="button" onClick={() => setPreparing(false)} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>

          <div className="mb-5">
            <h3 className="mb-2 text-sm font-bold text-slate-700">Pautas sugeridas ({suggestions.length})</h3>
            {suggestions.length === 0 ? (
              <p className="text-xs text-slate-400">Nenhuma pendência relevante encontrada no momento.</p>
            ) : (
              <div className="space-y-1.5">
                {suggestions.map((s, index) => (
                  <label key={index} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                    <input type="checkbox" checked={selectedSuggestions.has(index)} onChange={() => toggleSuggestion(index)} className="mt-0.5" />
                    <span className="flex-1">
                      <span className={`mr-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${PRIORITY_COLOR[s.priority]}`}>{s.origin}</span>
                      {s.reason}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="mb-5">
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700"><Users size={14} /> Participantes</h3>
            <div className="flex flex-wrap gap-2">
              {directory.map((user) => (
                <label key={user.email} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${selectedParticipants.has(user.email) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>
                  <input type="checkbox" checked={selectedParticipants.has(user.email)} onChange={() => toggleParticipant(user.email)} className="hidden" />
                  {user.name} <span className="text-[10px] font-normal text-slate-400">({user.role})</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <button type="button" disabled={loadingTimes} onClick={findTimes} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-xs font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Clock size={14} /> {loadingTimes ? "Consultando..." : "Sugerir horários"}
            </button>
          </div>

          {timeSuggestions && (
            <div className="mb-4 space-y-2">
              {timeSuggestions.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum horário com participantes disponíveis foi encontrado nos próximos 14 dias.</p>
              ) : (
                timeSuggestions.map((slot, index) => (
                  <div key={index} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                    <span className="font-bold text-slate-800">
                      {new Date(`${slot.date}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })} · {slot.time} — {slot.availableCount} de {slot.totalCount} disponíveis
                    </span>
                    <button type="button" onClick={() => applySuggestionsToForm(slot)} className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100">Usar este horário</button>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="flex justify-end">
            <button type="button" onClick={() => applySuggestionsToForm()} className="text-xs font-bold text-blue-700 hover:underline">Preencher formulário sem escolher horário →</button>
          </div>
        </div>
      )}

      <div className="compex-card mb-6 p-5">
        <h2 className="mb-4 text-lg font-black text-slate-900">Nova reunião</h2>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700">
            Título
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Tipo
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
              <option value="Ordinária">Ordinária</option>
              <option value="Extraordinária">Extraordinária</option>
              <option value="Departamento">Departamento</option>
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Data
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Horário
            <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Participantes (separados por vírgula)
            <input value={form.participants} onChange={(event) => setForm({ ...form, participants: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Nome 1, Nome 2..." />
          </label>
          <div className="md:col-span-2">
            <span className="mb-1.5 block text-sm font-bold text-slate-700">Participantes internos (opcional — ativa o alerta de conflito de agenda)</span>
            <div className="flex flex-wrap gap-2">
              {directory.map((user) => (
                <label key={user.email} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-bold ${formParticipantEmails.has(user.email) ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600"}`}>
                  <input type="checkbox" checked={formParticipantEmails.has(user.email)} onChange={() => toggleFormParticipant(user.email)} className="hidden" />
                  {user.name}
                </label>
              ))}
            </div>
            {conflicts && conflicts.length > 0 && (
              <div className="mt-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <p className="font-bold">⚠ Conflito de agenda detectado:</p>
                <ul className="mt-1 list-disc pl-4">
                  {conflicts.map((c, i) => {
                    const name = directory.find((d) => d.email === c.email)?.name || c.email;
                    return <li key={i}>{name}: {c.reason}</li>;
                  })}
                </ul>
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setConflicts(null)} className="rounded-lg border border-red-300 bg-white px-2.5 py-1 font-bold hover:bg-red-100">Ajustar horário</button>
                  <button type="button" onClick={createMeeting} className="rounded-lg bg-red-600 px-2.5 py-1 font-bold text-white hover:bg-red-700">Registrar mesmo assim</button>
                </div>
              </div>
            )}
          </div>
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Pauta
            <textarea value={form.agenda} onChange={(event) => setForm({ ...form, agenda: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Anotações / decisões
            <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" disabled={checkingConflicts} onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
            <Plus size={16} /> {checkingConflicts ? "Checando agenda..." : "Registrar reunião"}
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-black text-slate-900">Histórico</h2>
      {loading ? (
        <div className="compex-card flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-3">
          {items.length === 0 ? (
            <div className="compex-card flex min-h-[120px] items-center justify-center text-sm text-slate-500">Nenhuma reunião registrada.</div>
          ) : (
            items.map((m) => (
              <div key={m.id} className="compex-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{m.title}</p>
                    <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">{m.type} · {new Date(m.date).toLocaleDateString("pt-BR")}{m.time ? ` às ${m.time}` : ""}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${m.status === "FINALIZADA" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                    {m.status === "FINALIZADA" ? "Ata finalizada" : "Rascunho"}
                  </span>
                </div>
                {m.participants && m.participants.length > 0 && <p className="mt-2 text-xs text-slate-500">Participantes: {m.participants.join(", ")}</p>}
                {m.agenda && <p className="mt-2 whitespace-pre-line text-sm text-slate-700"><span className="font-bold">Pauta:</span> {m.agenda}</p>}
                {m.notes && <p className="mt-1 text-sm text-slate-700"><span className="font-bold">Notas/decisões:</span> {m.notes}</p>}
                {m.status === "RASCUNHO" && (
                  <div className="mt-3">
                    <button type="button" onClick={() => finalize(m.id)} className="rounded-lg bg-[#0b2265] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#071745]">
                      Finalizar como ata
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function ReunioesPage() {
  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES", "FINANCEIRO", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <ReunioesContent />
    </GestaoGuard>
  );
}
