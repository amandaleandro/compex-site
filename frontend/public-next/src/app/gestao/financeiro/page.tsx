"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, LoaderCircle, Plus, Trash2, Wallet } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type FinanceEntry = {
  id: string;
  description: string;
  amount: number;
  category: string;
  type: "income" | "expense";
  createdAt: string;
};

type FinanceOverview = {
  entries: FinanceEntry[];
  months: { month: string; income: number; expense: number }[];
};

const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const monthLabel = (month: string) => new Date(`${month}-02`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();

const initialEntry = {
  description: "",
  amount: "",
  category: "",
  type: "income" as "income" | "expense",
};

export default function FinanceiroPage() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [monthsWindow, setMonthsWindow] = useState(6);
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [form, setForm] = useState(initialEntry);

  const loadOverview = async () => {
    try {
      const data = await compexApi<FinanceOverview>("/finance-overview");
      setOverview(data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o financeiro.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const saveEntry = async () => {
    const amount = Number(form.amount.replace(",", "."));
    if (!form.description.trim() || !amount || amount <= 0) {
      setFormError("Informe a descrição e um valor válido.");
      return;
    }

    setSaving(true);
    setFormError("");
    try {
      await compexApi("/transactions", {
        method: "POST",
        body: JSON.stringify({
          description: form.description.trim(),
          amount,
          category: form.category.trim() || "Operação",
          type: form.type,
        }),
      });
      setForm(initialEntry);
      await loadOverview();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível salvar a movimentação.");
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      await compexApi("/transactions", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadOverview();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir a movimentação.");
    }
  };

  const filteredEntries = useMemo(() => {
    const list = overview?.entries || [];
    return list.filter((entry) => typeFilter === "all" || entry.type === typeFilter);
  }, [overview, typeFilter]);

  const totals = useMemo(() => {
    const income = (overview?.entries || []).filter((entry) => entry.type === "income").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const expense = (overview?.entries || []).filter((entry) => entry.type === "expense").reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
    const balance = income - expense;
    return { income, expense, balance };
  }, [overview]);

  const chartMonths = useMemo(() => (overview?.months || []).slice(-monthsWindow), [overview, monthsWindow]);

  const chartMax = useMemo(() => {
    const max = Math.max(10, ...chartMonths.flatMap((month) => [month.income, month.expense]));
    const rounded = Math.ceil(max / 4 / 5) * 5 || 5;
    return rounded * 4;
  }, [chartMonths]);

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Financeiro</h1>
            <p className="text-sm text-slate-500">Resumo de receitas, despesas e movimentações do caixa.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Wallet size={16} className="text-blue-700" />
            <span>Saldo: {money(totals.balance)}</span>
          </div>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Receitas</p>
            <strong className="mt-2 flex items-center gap-2 text-2xl font-black text-emerald-700">
              <ArrowUpRight size={18} /> {money(totals.income)}
            </strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Despesas</p>
            <strong className="mt-2 flex items-center gap-2 text-2xl font-black text-red-700">
              <ArrowDownLeft size={18} /> {money(totals.expense)}
            </strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Saldo</p>
            <strong className="mt-2 text-2xl font-black text-slate-900">{money(totals.balance)}</strong>
          </div>
        </div>

        <div className="compex-card mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">Nova movimentação</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="block text-sm font-bold text-slate-700 xl:col-span-2">
              Descrição
              <input
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                placeholder="Ex.: Mensalidade, patrocínio, compra de materiais..."
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Categoria
              <input
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                placeholder="Operação"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Valor
              <input
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                inputMode="decimal"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                placeholder="0,00"
              />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Tipo
              <select
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as "income" | "expense" })}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              >
                <option value="income">Receita</option>
                <option value="expense">Despesa</option>
              </select>
            </label>
          </div>

          {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => { setForm(initialEntry); setFormError(""); }} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Limpar
            </button>
            <button type="button" disabled={saving} onClick={saveEntry} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : "Registrar movimentação"}
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="compex-card p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-lg font-black text-slate-900">Evolução financeira</h2>
              <select
                value={monthsWindow}
                onChange={(event) => setMonthsWindow(Number(event.target.value))}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-blue-500"
              >
                <option value={3}>Últimos 3 meses</option>
                <option value={6}>Últimos 6 meses</option>
                <option value={12}>Últimos 12 meses</option>
              </select>
            </div>

            {chartMonths.length === 0 ? (
              <div className="flex min-h-[220px] items-center justify-center text-sm text-slate-500">Sem dados financeiros para o período.</div>
            ) : (
              <div>
                <svg viewBox="0 0 600 220" className="h-56 w-full overflow-visible">
                  <path
                    d={chartMonths.map((month, index) => {
                      const x = chartMonths.length === 1 ? 0 : (index / (chartMonths.length - 1)) * 600;
                      const y = 220 - Math.min(1, month.income / chartMax) * 220;
                      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                    }).join(" ") + " L600 220 L0 220 Z"}
                    fill="#2563eb"
                    opacity={0.08}
                  />
                  <path
                    d={chartMonths.map((month, index) => {
                      const x = chartMonths.length === 1 ? 0 : (index / (chartMonths.length - 1)) * 600;
                      const y = 220 - Math.min(1, month.income / chartMax) * 220;
                      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                    }).join(" ")}
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth={2.5}
                  />
                  <path
                    d={chartMonths.map((month, index) => {
                      const x = chartMonths.length === 1 ? 0 : (index / (chartMonths.length - 1)) * 600;
                      const y = 220 - Math.min(1, month.expense / chartMax) * 220;
                      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
                    }).join(" ")}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={2.5}
                  />
                </svg>
                <div className="mt-2 flex justify-between text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
                  {chartMonths.map((month) => (
                    <span key={month.month}>{monthLabel(month.month)}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="compex-card p-5">
            <h2 className="mb-4 text-lg font-black text-slate-900">Movimentações</h2>
            <div className="mb-4 flex gap-2">
              {(["all", "income", "expense"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTypeFilter(value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    typeFilter === value ? "bg-[#0b2265] text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {value === "all" ? "Todas" : value === "income" ? "Receitas" : "Despesas"}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : error ? (
              <div className="text-sm font-medium text-red-600">{error}</div>
            ) : (
              <div className="space-y-3">
                {filteredEntries.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma movimentação para o filtro selecionado.</p>
                ) : (
                  filteredEntries.slice(0, 8).map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                      <div>
                        <div className="font-bold text-slate-900">{entry.description}</div>
                        <div className="text-[11px] text-slate-500">{entry.category} · {new Date(entry.createdAt).toLocaleDateString("pt-BR")}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`text-right font-black ${entry.type === "income" ? "text-emerald-700" : "text-red-700"}`}>
                          {entry.type === "income" ? "+" : "-"}
                          {money(entry.amount)}
                        </div>
                        <button
                          type="button"
                          onClick={() => deleteEntry(entry.id)}
                          className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                          aria-label="Excluir movimentação"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </GestaoGuard>
  );
}
