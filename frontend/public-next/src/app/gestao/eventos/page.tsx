"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, LoaderCircle, Plus, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type EventItem = {
  id: string;
  name: string;
  type: string;
  date: string;
  location: string | null;
  time: string | null;
  description: string | null;
  published: boolean;
  platform: string | null;
  ticketUrl: string | null;
  isOwnOrganization: boolean;
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
};

const initialEvent = {
  id: "",
  name: "",
  type: "Evento",
  date: "",
  time: "",
  location: "",
  description: "",
  published: true,
};

export default function EventosPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState(initialEvent);

  const loadEvents = async () => {
    try {
      const list = await compexApi<EventItem[]>("/events");
      setEvents(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os eventos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const saveEvent = async () => {
    if (!form.name.trim() || !form.date) {
      setFormError("Informe o nome e a data do evento.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      const payload = {
        name: form.name.trim(),
        type: form.type.trim() || "Evento",
        date: form.date,
        time: form.time || null,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        published: form.published,
      };

      if (form.id) {
        await compexApi("/events", { method: "PUT", body: JSON.stringify({ ...payload, id: form.id }) });
      } else {
        await compexApi("/events", { method: "POST", body: JSON.stringify(payload) });
      }

      setForm(initialEvent);
      await loadEvents();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível salvar o evento.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEvent = async (id: string) => {
    try {
      await compexApi("/events", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadEvents();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o evento.");
    }
  };

  const openEdit = (event: EventItem) => {
    setForm({
      id: event.id,
      name: event.name,
      type: event.type,
      date: event.date.slice(0, 10),
      time: event.time || "",
      location: event.location || "",
      description: event.description || "",
      published: event.published,
    });
  };

  const upcoming = useMemo(() => {
    return [...events].filter((event) => new Date(event.date).getTime() >= Date.now()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [events]);

  return (
    <GestaoGuard allow={["PRESIDENCIA", "EVENTOS", "MARKETING"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Eventos</h1>
            <p className="text-sm text-slate-500">Agenda, divulgação e acompanhamento do calendário da atlética.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <CalendarRange size={16} className="text-blue-700" />
            <span>{upcoming.length} próximos</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">{form.id ? "Editar evento" : "Novo evento"}</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{form.id ? "Atualização" : "Cadastro"}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-bold text-slate-700">
              Nome
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Tipo
              <input value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Data
              <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Horário
              <input type="time" value={form.time} onChange={(event) => setForm({ ...form, time: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Local
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
              <input type="checkbox" checked={form.published} onChange={(event) => setForm({ ...form, published: event.target.checked })} className="h-4 w-4 rounded border-slate-300" />
              Publicado
            </label>

            <label className="block text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-3">
              Descrição
              <textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
          </div>

          {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => { setForm(initialEvent); setFormError(""); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Limpar
            </button>
            <button type="button" disabled={saving} onClick={saveEvent} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : form.id ? "Salvar alterações" : "Cadastrar evento"}
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Eventos</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{events.length}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Publicados</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{events.filter((event) => event.published).length}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Atlética</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{events.filter((event) => event.isOwnOrganization).length}</strong>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando eventos...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <div className="compex-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Evento</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Local</th>
                    <th className="px-5 py-3">Plataforma</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {events.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-500">Nenhum evento registrado.</td>
                    </tr>
                  ) : (
                    events.map((event) => (
                      <tr key={event.id} className="border-t border-slate-100">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{event.name}</div>
                          <div className="text-xs text-slate-500">{event.type}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{formatDate(event.date)}</td>
                        <td className="px-5 py-4 text-slate-700">{event.location || "—"}</td>
                        <td className="px-5 py-4 text-slate-700">{event.platform || "—"}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${event.published ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {event.published ? "Publicado" : "Rascunho"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <button type="button" onClick={() => openEdit(event)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                              Editar
                            </button>
                            <button type="button" onClick={() => deleteEvent(event.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
                              <Trash2 size={12} /> Excluir
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
