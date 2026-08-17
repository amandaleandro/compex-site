"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type FunctionType =
  | "SUMULA" | "APOIO_JOGO" | "BANDEIRAO" | "MATERIAL" | "TORCIDA" | "FOTOGRAFIA" | "SOCIAL_MEDIA"
  | "EVENTOS" | "BARRACAS" | "RECEPCAO" | "VENDA_INGRESSOS" | "TRANSPORTE" | "ORGANIZACAO" | "OUTRA";

type Status = "AGUARDANDO" | "CONFIRMADO" | "TROCA_SOLICITADA" | "SUBSTITUIDO" | "RECUSADO" | "CONCLUIDO";

type Schedule = {
  id: string;
  referenceLabel: string;
  function: FunctionType;
  assignedName: string;
  assignedEmail: string | null;
  date: string;
  time: string | null;
  location: string | null;
  instructions: string | null;
  status: Status;
  substituteName: string | null;
};

const FUNCTION_LABEL: Record<FunctionType, string> = {
  SUMULA: "Súmula",
  APOIO_JOGO: "Apoio ao jogo",
  BANDEIRAO: "Bandeirão",
  MATERIAL: "Material",
  TORCIDA: "Torcida",
  FOTOGRAFIA: "Fotografia",
  SOCIAL_MEDIA: "Social media",
  EVENTOS: "Eventos",
  BARRACAS: "Barracas",
  RECEPCAO: "Recepção",
  VENDA_INGRESSOS: "Venda de ingressos",
  TRANSPORTE: "Transporte",
  ORGANIZACAO: "Organização",
  OUTRA: "Outra",
};

const STATUS_LABEL: Record<Status, string> = {
  AGUARDANDO: "Aguardando",
  CONFIRMADO: "Confirmado",
  TROCA_SOLICITADA: "Troca solicitada",
  SUBSTITUIDO: "Substituído",
  RECUSADO: "Recusado",
  CONCLUIDO: "Concluído",
};

const STATUS_CLASS: Record<Status, string> = {
  AGUARDANDO: "bg-slate-100 text-slate-600",
  CONFIRMADO: "bg-emerald-50 text-emerald-700",
  TROCA_SOLICITADA: "bg-amber-50 text-amber-700",
  SUBSTITUIDO: "bg-blue-50 text-blue-700",
  RECUSADO: "bg-red-50 text-red-700",
  CONCLUIDO: "bg-emerald-100 text-emerald-800",
};

const emptyForm = { referenceLabel: "", function: "SUMULA" as FunctionType, assignedName: "", date: "", time: "", location: "", instructions: "" };

export default function EscalasPage() {
  const [items, setItems] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const result = await compexApi<Schedule[]>("/schedules");
      setItems(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as escalas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => ({
    aguardando: items.filter((i) => i.status === "AGUARDANDO").length,
    confirmado: items.filter((i) => i.status === "CONFIRMADO").length,
    pendencia: items.filter((i) => ["TROCA_SOLICITADA", "RECUSADO"].includes(i.status)).length,
  }), [items]);

  const submit = async () => {
    if (!form.referenceLabel.trim() || !form.assignedName.trim() || !form.date) {
      setError("Informe evento/jogo, responsável e data.");
      return;
    }
    try {
      await compexApi("/schedules", { method: "POST", body: JSON.stringify({ ...form, referenceLabel: form.referenceLabel.trim(), assignedName: form.assignedName.trim() }) });
      setForm(emptyForm);
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a escala.");
    }
  };

  const runAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await compexApi("/schedules", { method: "PUT", body: JSON.stringify({ id, action, ...extra }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a escala.");
    }
  };

  const substitute = (id: string) => {
    const name = window.prompt("Nome do substituto:");
    if (!name) return;
    runAction(id, "substitute", { substituteName: name });
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES", "EVENTOS", "MARKETING"]}>
      <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9">
        <header className="mb-6">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
          <h1 className="mt-1 text-2xl font-black text-slate-900">Escalas</h1>
          <p className="text-sm text-slate-500">Súmula, bandeirão, apoio de jogo, barracas, recepção e outras funções — quem confirmou e quem falta.</p>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Aguardando</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{summary.aguardando}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Confirmadas</p>
            <strong className="mt-2 block text-2xl font-black text-emerald-700">{summary.confirmado}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Pendências</p>
            <strong className="mt-2 block text-2xl font-black text-red-700">{summary.pendencia}</strong>
          </div>
        </div>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Nova escala</h2>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Evento/jogo
              <input value={form.referenceLabel} onChange={(event) => setForm({ ...form, referenceLabel: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Vôlei x Direito — semifinal" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Função
              <select value={form.function} onChange={(event) => setForm({ ...form, function: event.target.value as FunctionType })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                {Object.entries(FUNCTION_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Responsável
              <input value={form.assignedName} onChange={(event) => setForm({ ...form, assignedName: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Local
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
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
              Instruções
              <textarea value={form.instructions} onChange={(event) => setForm({ ...form, instructions: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
          </div>
          <div className="mt-5 flex justify-end">
            <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745]">
              <Plus size={16} /> Criar escala
            </button>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : (
          <div className="space-y-3">
            {items.length === 0 ? (
              <div className="compex-card flex min-h-[120px] items-center justify-center text-sm text-slate-500">Nenhuma escala criada.</div>
            ) : (
              items.map((s) => (
                <div key={s.id} className="compex-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{s.referenceLabel}</p>
                      <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">{FUNCTION_LABEL[s.function]}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {s.assignedName} · {new Date(s.date).toLocaleDateString("pt-BR")}{s.time ? ` às ${s.time}` : ""}{s.location ? ` · ${s.location}` : ""}
                      </p>
                      {s.substituteName && <p className="mt-1 text-xs text-blue-700">Substituto: {s.substituteName}</p>}
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {s.status === "AGUARDANDO" && (
                      <>
                        <button type="button" onClick={() => runAction(s.id, "confirm")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">Confirmar</button>
                        <button type="button" onClick={() => runAction(s.id, "request_swap")} className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100">Solicitar troca</button>
                        <button type="button" onClick={() => runAction(s.id, "unavailable")} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">Indisponível</button>
                      </>
                    )}
                    {["TROCA_SOLICITADA", "RECUSADO"].includes(s.status) && (
                      <button type="button" onClick={() => substitute(s.id)} className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-blue-700">Definir substituto</button>
                    )}
                    {s.status === "CONFIRMADO" && (
                      <button type="button" onClick={() => runAction(s.id, "complete")} className="rounded-lg bg-[#0b2265] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#071745]">Marcar concluída</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
