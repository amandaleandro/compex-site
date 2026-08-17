"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import GestaoGuard, { useGestaoSession } from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Status = "SOLICITADO" | "EM_ANALISE" | "APROVADO" | "REJEITADO" | "FINALIZADO";

type Departure = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  reason: string;
  observations: string | null;
  status: Status;
  rejectedReason: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<Status, string> = {
  SOLICITADO: "Solicitado",
  EM_ANALISE: "Em análise",
  APROVADO: "Aprovado",
  REJEITADO: "Rejeitado",
  FINALIZADO: "Finalizado",
};

const STATUS_CLASS: Record<Status, string> = {
  SOLICITADO: "bg-blue-50 text-blue-700",
  EM_ANALISE: "bg-amber-50 text-amber-700",
  APROVADO: "bg-emerald-50 text-emerald-700",
  REJEITADO: "bg-red-50 text-red-700",
  FINALIZADO: "bg-slate-100 text-slate-600",
};

function DesligamentoContent() {
  const session = useGestaoSession();
  const [items, setItems] = useState<Departure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [department, setDepartment] = useState("Presidência");
  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const isPresidencia = session.role === "PRESIDENCIA";

  const load = async () => {
    try {
      const result = await compexApi<Departure[]>("/departures");
      setItems(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mine = useMemo(() => items.filter((i) => i.requesterEmail === session.email), [items, session.email]);

  const submit = async () => {
    if (!reason.trim()) { setError("Informe o motivo do desligamento."); return; }
    try {
      await compexApi("/departures", { method: "POST", body: JSON.stringify({ department, reason: reason.trim(), observations: observations.trim() || undefined }) });
      setReason("");
      setObservations("");
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a solicitação.");
    }
  };

  const runAction = async (id: string, action: string, rejectedReason?: string) => {
    try {
      await compexApi("/departures", { method: "PUT", body: JSON.stringify({ id, action, rejectedReason }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar a ação.");
    }
  };

  const reject = (id: string) => {
    const value = window.prompt("Motivo da rejeição:");
    if (!value) return;
    runAction(id, "reject", value);
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 sm:px-9">
      <header className="mb-6">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Solicitação de Desligamento</h1>
        <p className="text-sm text-slate-500">Fluxo formal para saída da gestão — registrado e com histórico, sem depender de aviso verbal.</p>
      </header>

      <div className="compex-card mb-6 p-5">
        <h2 className="mb-4 text-lg font-black text-slate-900">Nova solicitação</h2>
        {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700">
            Departamento
            <select value={department} onChange={(event) => setDepartment(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
              {["Presidência", "Financeiro", "Esportes", "Eventos", "Marketing", "Produtos", "Patrimônio"].map((team) => (
                <option key={team} value={team}>{team}</option>
              ))}
            </select>
          </label>
          <div />
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Motivo
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Observações
            <textarea value={observations} onChange={(event) => setObservations(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745]">
            <Plus size={16} /> Enviar solicitação
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-black text-slate-900">{isPresidencia ? "Todas as solicitações" : "Minhas solicitações"}</h2>
      {loading ? (
        <div className="compex-card flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-3">
          {(isPresidencia ? items : mine).length === 0 ? (
            <div className="compex-card flex min-h-[120px] items-center justify-center text-sm text-slate-500">Nenhuma solicitação.</div>
          ) : (
            (isPresidencia ? items : mine).map((d) => (
              <div key={d.id} className="compex-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{d.requesterName} · {d.department}</p>
                    <p className="mt-1 text-sm text-slate-600">{d.reason}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[d.status]}`}>{STATUS_LABEL[d.status]}</span>
                </div>
                {d.rejectedReason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Rejeitado: {d.rejectedReason}</p>}
                {isPresidencia && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {d.status === "SOLICITADO" && (
                      <button type="button" onClick={() => runAction(d.id, "analyze")} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-50">Colocar em análise</button>
                    )}
                    {["SOLICITADO", "EM_ANALISE"].includes(d.status) && (
                      <>
                        <button type="button" onClick={() => runAction(d.id, "approve")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">Aprovar</button>
                        <button type="button" onClick={() => reject(d.id)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">Rejeitar</button>
                      </>
                    )}
                    {d.status === "APROVADO" && (
                      <button type="button" onClick={() => runAction(d.id, "finalize")} className="rounded-lg bg-[#0b2265] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#071745]">Finalizar (desliga da gestão)</button>
                    )}
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

export default function DesligamentoPage() {
  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES", "FINANCEIRO", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <DesligamentoContent />
    </GestaoGuard>
  );
}
