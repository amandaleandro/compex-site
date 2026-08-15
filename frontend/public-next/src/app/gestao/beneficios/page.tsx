"use client";

import { useEffect, useState } from "react";
import { Gift, LoaderCircle, Plus, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Benefit = {
  id: string;
  name: string;
  category: string;
  discount: string;
  description: string | null;
  icon: string | null;
};

const initialBenefit = { name: "", category: "", discount: "", description: "", icon: "" };

export default function BeneficiosPage() {
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialBenefit);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const list = await compexApi<Benefit[]>("/benefits");
      setBenefits(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os benefícios.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveBenefit = async () => {
    if (!form.name.trim() || !form.category.trim() || !form.discount.trim()) {
      setFormError("Informe nome, categoria e desconto/vantagem.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/benefits", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category.trim(),
          discount: form.discount.trim(),
          description: form.description.trim() || null,
          icon: form.icon.trim() || null,
        }),
      });
      setForm(initialBenefit);
      await loadData();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível salvar o benefício.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBenefit = async (id: string) => {
    try {
      await compexApi("/benefits", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o benefício.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "MARKETING"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Benefícios</h1>
            <p className="text-sm text-slate-500">Parcerias e vantagens disponíveis para os associados.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Gift size={16} className="text-blue-700" />
            <span>{benefits.length} benefícios</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Novo benefício</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-bold text-slate-700">
              Nome
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Categoria
              <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Alimentação, saúde..." />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Desconto/vantagem
              <input value={form.discount} onChange={(e) => setForm({ ...form, discount: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: 15% off" />
            </label>
            <label className="block text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-3">
              Descrição
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={saveBenefit} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : "Cadastrar benefício"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando benefícios...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : benefits.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhum benefício cadastrado.</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {benefits.map((benefit) => (
              <div key={benefit.id} className="compex-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-blue-700">{benefit.category}</div>
                    <h3 className="mt-1 font-black text-slate-900">{benefit.name}</h3>
                  </div>
                  <button type="button" onClick={() => deleteBenefit(benefit.id)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100">
                    <Trash2 size={12} />
                  </button>
                </div>
                <p className="mt-2 text-sm font-bold text-emerald-700">{benefit.discount}</p>
                {benefit.description && <p className="mt-1 text-xs text-slate-500">{benefit.description}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
