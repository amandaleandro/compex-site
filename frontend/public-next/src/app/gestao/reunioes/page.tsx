"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
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

const emptyForm = { title: "", type: "Ordinária", date: "", time: "", participants: "", agenda: "", notes: "" };

function ReunioesContent() {
  const session = useGestaoSession();
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

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

  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    if (!form.title.trim() || !form.date) { setError("Informe título e data."); return; }
    try {
      await compexApi("/meetings", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim(),
          type: form.type,
          date: form.date,
          time: form.time || undefined,
          participants: form.participants.split(",").map((p) => p.trim()).filter(Boolean),
          agenda: form.agenda.trim() || undefined,
          notes: form.notes.trim() || undefined,
        }),
      });
      setForm(emptyForm);
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar a reunião.");
    }
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 sm:px-9">
      <header className="mb-6">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Reuniões e Atas</h1>
        <p className="text-sm text-slate-500">Pauta, decisões e responsáveis registrados — atas finalizadas nunca são apagadas.</p>
      </header>

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
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745]">
            <Plus size={16} /> Registrar reunião
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
                {m.agenda && <p className="mt-2 text-sm text-slate-700"><span className="font-bold">Pauta:</span> {m.agenda}</p>}
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
