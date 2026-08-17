"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Trash2, CalendarClock } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Slot = { id: string; weekday: number; weekdayLabel: string; startTime: string; endTime: string };

const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export default function DisponibilidadePage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weekday, setWeekday] = useState(1);
  const [startTime, setStartTime] = useState("19:00");
  const [endTime, setEndTime] = useState("21:00");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const list = await compexApi<Slot[]>("/availability");
      setSlots(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar sua disponibilidade.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addSlot = async () => {
    if (startTime >= endTime) { setError("O início precisa ser antes do fim."); return; }
    setSaving(true);
    setError("");
    try {
      await compexApi("/availability", { method: "POST", body: JSON.stringify({ weekday, startTime, endTime }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const removeSlot = async (id: string) => {
    try {
      await compexApi("/availability", { method: "DELETE", body: JSON.stringify({ id }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-3xl px-6 py-7 sm:px-9">
        <header className="mb-6">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Minha disponibilidade</h1>
          <p className="text-sm text-slate-500">Cadastre os horários em que costuma estar livre — usado só para sugerir o melhor horário de reunião, nunca marca nada sozinho.</p>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-black text-slate-900"><CalendarClock size={18} className="text-blue-700" /> Adicionar horário</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {WEEKDAYS.map((label, index) => <option key={index} value={index}>{label}</option>)}
            </select>
            <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <button type="button" disabled={saving} onClick={addSlot} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> Adicionar
            </button>
          </div>
          {error && <p className="mt-2 text-sm font-medium text-red-600">{error}</p>}
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : slots.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhum horário cadastrado ainda.</div>
        ) : (
          <div className="space-y-2">
            {slots.map((slot) => (
              <div key={slot.id} className="compex-card flex items-center justify-between p-3">
                <span className="text-sm font-bold text-slate-800">{slot.weekdayLabel} · {slot.startTime} às {slot.endTime}</span>
                <button type="button" onClick={() => removeSlot(slot.id)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"><Trash2 size={12} /></button>
              </div>
            ))}
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
