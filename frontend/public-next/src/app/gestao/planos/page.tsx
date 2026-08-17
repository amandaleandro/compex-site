"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus, Power, Wallet } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Plan = {
  id: string;
  name: string;
  priceCents: number;
  period: string;
  periodicity: string;
  durationMonths: number;
  description: string | null;
  active: boolean;
  memberCount?: number;
  createdAt: string;
  updatedAt: string;
};

const initialForm = { name: "", priceReais: "", period: "/semestre", periodicity: "SEMESTRAL", durationMonths: "6", description: "" };

export default function PlanosPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const list = await compexApi<Plan[]>("/plans");
      setPlans(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os planos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const savePlan = async () => {
    const priceCents = Math.round(Number(form.priceReais.replace(",", ".")) * 100);
    if (!form.name.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
      setFormError("Informe nome e valor válido (ex.: 60,00).");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/plans", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          priceCents,
          period: form.period.trim() || "/semestre",
          periodicity: form.periodicity,
          durationMonths: Number(form.durationMonths) || 6,
          description: form.description.trim() || null,
        }),
      });
      setForm(initialForm);
      await loadData();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível salvar o plano.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (plan: Plan) => {
    try {
      await compexApi("/plans", { method: "PUT", body: JSON.stringify({ id: plan.id, active: !plan.active }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar o plano.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Planos de Sócio</h1>
            <p className="text-sm text-slate-500">Fonte única de verdade para preço e periodicidade da mensalidade — usada no cadastro público e no checkout.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Wallet size={16} className="text-blue-700" />
            <span>{plans.length} planos</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Novo plano</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block text-sm font-bold text-slate-700">
              Nome
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Sócio Semestral" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Valor (R$)
              <input value={form.priceReais} onChange={(e) => setForm({ ...form, priceReais: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: 60,00" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Periodicidade
              <select value={form.periodicity} onChange={(e) => setForm({ ...form, periodicity: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="MENSAL">Mensal</option>
                <option value="SEMESTRAL">Semestral</option>
                <option value="ANUAL">Anual</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Duração (meses)
              <input type="number" min={1} value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-4">
              Descrição
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={savePlan} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : "Cadastrar plano"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando planos...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : plans.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhum plano cadastrado.</div>
        ) : (
          <div className="compex-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Periodicidade</th>
                  <th className="px-4 py-3">Duração</th>
                  <th className="px-4 py-3">Sócios</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 font-bold text-slate-900">{plan.name}{plan.description && <div className="text-xs font-medium text-slate-400">{plan.description}</div>}</td>
                    <td className="px-4 py-3 font-bold text-blue-700">{(plan.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</td>
                    <td className="px-4 py-3 text-slate-600">{plan.periodicity}</td>
                    <td className="px-4 py-3 text-slate-600">{plan.durationMonths} meses</td>
                    <td className="px-4 py-3 text-slate-600">{plan.memberCount ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${plan.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {plan.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => toggleActive(plan)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50">
                        <Power size={12} /> {plan.active ? "Desativar" : "Ativar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
