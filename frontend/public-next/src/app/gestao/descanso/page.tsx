"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import GestaoGuard, { useGestaoSession } from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Status = "SOLICITADO" | "APROVADO" | "REJEITADO";

type Rest = {
  id: string;
  requesterName: string;
  requesterEmail: string;
  department: string;
  startDate: string;
  endDate: string;
  days: number;
  semester: string;
  reason: string | null;
  substituteName: string | null;
  status: Status;
  rejectedReason: string | null;
};

const STATUS_LABEL: Record<Status, string> = { SOLICITADO: "Solicitado", APROVADO: "Aprovado", REJEITADO: "Rejeitado" };
const STATUS_CLASS: Record<Status, string> = {
  SOLICITADO: "bg-blue-50 text-blue-700",
  APROVADO: "bg-emerald-50 text-emerald-700",
  REJEITADO: "bg-red-50 text-red-700",
};

function DescansoContent() {
  const session = useGestaoSession();
  const [items, setItems] = useState<Rest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [department, setDepartment] = useState("Presidência");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [substituteName, setSubstituteName] = useState("");
  const isPresidencia = session.role === "PRESIDENCIA";

  const load = async () => {
    try {
      const result = await compexApi<Rest[]>("/rests");
      setItems(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os descansos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const mine = useMemo(() => items.filter((i) => i.requesterEmail === session.email), [items, session.email]);

  const submit = async () => {
    if (!startDate || !endDate) { setError("Informe data inicial e final."); return; }
    try {
      await compexApi("/rests", {
        method: "POST",
        body: JSON.stringify({ department, startDate, endDate, reason: reason.trim() || undefined, substituteName: substituteName.trim() || undefined }),
      });
      setStartDate("");
      setEndDate("");
      setReason("");
      setSubstituteName("");
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar a solicitação.");
    }
  };

  const runAction = async (id: string, action: string, rejectedReason?: string) => {
    try {
      await compexApi("/rests", { method: "PUT", body: JSON.stringify({ id, action, rejectedReason }) });
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

  const list = isPresidencia ? items : mine;

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 sm:px-9">
      <header className="mb-6">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Descanso da Gestão</h1>
        <p className="text-sm text-slate-500">Até 30 dias de descanso, uma vez por semestre. O sistema valida limite e conflitos automaticamente.</p>
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
          <label className="block text-sm font-bold text-slate-700">
            Substituto (opcional)
            <input value={substituteName} onChange={(event) => setSubstituteName(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Data inicial
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Data final
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Motivo (opcional)
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745]">
            <Plus size={16} /> Enviar solicitação
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-black text-slate-900">{isPresidencia ? "Todas as solicitações" : "Meus descansos"}</h2>
      {loading ? (
        <div className="compex-card flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : (
        <div className="space-y-3">
          {list.length === 0 ? (
            <div className="compex-card flex min-h-[120px] items-center justify-center text-sm text-slate-500">Nenhuma solicitação.</div>
          ) : (
            list.map((r) => (
              <div key={r.id} className="compex-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">{r.requesterName} · {r.department}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {new Date(r.startDate).toLocaleDateString("pt-BR")} a {new Date(r.endDate).toLocaleDateString("pt-BR")} ({r.days} dias)
                      {r.substituteName ? ` · substituto: ${r.substituteName}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                </div>
                {r.rejectedReason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Rejeitado: {r.rejectedReason}</p>}
                {isPresidencia && r.status === "SOLICITADO" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={() => runAction(r.id, "approve")} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700">Aprovar</button>
                    <button type="button" onClick={() => reject(r.id)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">Rejeitar</button>
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

export default function DescansoPage() {
  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES", "FINANCEIRO", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <DescansoContent />
    </GestaoGuard>
  );
}
