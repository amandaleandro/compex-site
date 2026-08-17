"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Indicator = { department: string; totalTasks: number; doneTasks: number; overdueTasks: number; progress: number };

type PlanStatus = "PLANEJADO" | "EM_ANDAMENTO" | "CONCLUIDO" | "ATRASADO";

type Plan = {
  id: string;
  department: string;
  semester: string;
  objective: string;
  responsible: string | null;
  dueDate: string | null;
  status: PlanStatus;
};

const STATUS_LABEL: Record<PlanStatus, string> = { PLANEJADO: "Planejado", EM_ANDAMENTO: "Em andamento", CONCLUIDO: "Concluído", ATRASADO: "Atrasado" };
const STATUS_CLASS: Record<PlanStatus, string> = {
  PLANEJADO: "bg-slate-100 text-slate-600",
  EM_ANDAMENTO: "bg-blue-50 text-blue-700",
  CONCLUIDO: "bg-emerald-50 text-emerald-700",
  ATRASADO: "bg-red-50 text-red-700",
};

const DEPARTMENTS = ["Presidência", "Financeiro", "Esportes", "Eventos", "Marketing", "Produtos", "Patrimônio"];
const currentSemester = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() < 6 ? 1 : 2}`; };

const emptyForm = { department: DEPARTMENTS[0], semester: currentSemester(), objective: "", responsible: "", dueDate: "" };

function DepartamentosContent() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);

  const load = async () => {
    try {
      const [ind, pl] = await Promise.all([
        compexApi<Indicator[]>("/department-indicators"),
        compexApi<Plan[]>("/department-plans"),
      ]);
      setIndicators(Array.isArray(ind) ? ind : []);
      setPlans(Array.isArray(pl) ? pl : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os departamentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const plansByDept = useMemo(() => {
    const map: Record<string, Plan[]> = {};
    plans.forEach((p) => { (map[p.department] ||= []).push(p); });
    return map;
  }, [plans]);

  const submit = async () => {
    if (!form.objective.trim()) { setError("Informe o objetivo."); return; }
    try {
      await compexApi("/department-plans", {
        method: "POST",
        body: JSON.stringify({ ...form, objective: form.objective.trim(), responsible: form.responsible.trim() || undefined, dueDate: form.dueDate || undefined }),
      });
      setForm({ ...emptyForm, department: form.department });
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar o planejamento.");
    }
  };

  const changeStatus = async (id: string, status: PlanStatus) => {
    try {
      await compexApi("/department-plans", { method: "PUT", body: JSON.stringify({ id, status }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o status.");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9">
      <header className="mb-6">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Departamentos</h1>
        <p className="text-sm text-slate-500">Planejamento do semestre e evolução calculada a partir das tarefas de cada equipe.</p>
      </header>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {indicators.map((ind) => (
          <div key={ind.department} className="compex-card p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-black text-slate-900">{ind.department}</p>
              <span className="text-sm font-black text-blue-700">{ind.progress}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600" style={{ width: `${ind.progress}%` }} />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {ind.doneTasks}/{ind.totalTasks} tarefas concluídas{ind.overdueTasks > 0 ? ` · ${ind.overdueTasks} atrasada(s)` : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="compex-card mb-6 p-5">
        <h2 className="mb-4 text-lg font-black text-slate-900">Novo planejamento</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-sm font-bold text-slate-700">
            Departamento
            <select value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
              {DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Semestre
            <input value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700 md:col-span-2">
            Objetivo
            <textarea value={form.objective} onChange={(event) => setForm({ ...form, objective: event.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Responsável
            <input value={form.responsible} onChange={(event) => setForm({ ...form, responsible: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm font-bold text-slate-700">
            Prazo
            <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
          </label>
        </div>
        <div className="mt-5 flex justify-end">
          <button type="button" onClick={submit} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745]">
            <Plus size={16} /> Adicionar objetivo
          </button>
        </div>
      </div>

      {DEPARTMENTS.map((dept) => (
        (plansByDept[dept]?.length || 0) > 0 && (
          <div key={dept} className="mb-6">
            <h2 className="mb-3 text-lg font-black text-slate-900">{dept}</h2>
            <div className="space-y-3">
              {plansByDept[dept].map((p) => (
                <div key={p.id} className="compex-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">{p.objective}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {p.semester}{p.responsible ? ` · ${p.responsible}` : ""}{p.dueDate ? ` · prazo ${new Date(p.dueDate).toLocaleDateString("pt-BR")}` : ""}
                      </p>
                    </div>
                    <select value={p.status} onChange={(event) => changeStatus(p.id, event.target.value as PlanStatus)} className={`rounded-full border-0 px-2 py-0.5 text-[11px] font-bold outline-none ${STATUS_CLASS[p.status]}`}>
                      {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}
    </div>
  );
}

export default function DepartamentosPage() {
  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES", "FINANCEIRO", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <DepartamentosContent />
    </GestaoGuard>
  );
}
