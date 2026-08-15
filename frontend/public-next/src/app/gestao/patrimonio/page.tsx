"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, LoaderCircle, Plus, Search, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type AssetCondition = "OTIMO" | "BOM" | "REGULAR" | "RUIM";
type Asset = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  condition: AssetCondition;
  sport: string | null;
  gender: "MASCULINO" | "FEMININO" | "MISTA" | null;
  location: string | null;
  notes: string | null;
};

type AssetLoan = {
  id: string;
  borrowerName: string;
  quantity: number;
  status: "EMPRESTADO" | "DEVOLVIDO";
  loanDate: string;
  expectedReturn: string | null;
  asset: { name: string } | null;
};

const conditionLabel: Record<AssetCondition, string> = {
  OTIMO: "Ótimo",
  BOM: "Bom",
  REGULAR: "Regular",
  RUIM: "Ruim",
};

const conditionClass: Record<AssetCondition, string> = {
  OTIMO: "bg-emerald-50 text-emerald-700",
  BOM: "bg-blue-50 text-blue-700",
  REGULAR: "bg-amber-50 text-amber-700",
  RUIM: "bg-red-50 text-red-700",
};

const initialAsset = {
  id: "",
  name: "",
  category: "Geral",
  quantity: 1,
  condition: "BOM" as AssetCondition,
  sport: "",
  gender: "",
  location: "",
  notes: "",
};

export default function PatrimonioPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loans, setLoans] = useState<AssetLoan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(initialAsset);

  const loadData = async () => {
    try {
      const [assetList, loanList] = await Promise.all([
        compexApi<Asset[]>("/assets"),
        compexApi<AssetLoan[]>("/asset-loans"),
      ]);
      setAssets(Array.isArray(assetList) ? assetList : []);
      setLoans(Array.isArray(loanList) ? loanList : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o patrimônio.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assets.filter((asset) => !q || `${asset.name} ${asset.category} ${asset.location || ""} ${asset.sport || ""}`.toLowerCase().includes(q));
  }, [assets, search]);

  const saveAsset = async () => {
    if (!form.name.trim()) {
      setError("Informe o nome do item.");
      return;
    }

    try {
      const payload = {
        ...form,
        name: form.name.trim(),
        category: form.category.trim() || "Geral",
        sport: form.sport?.trim() || null,
        gender: form.gender || null,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      };

      if (form.id) {
        await compexApi("/assets", { method: "PUT", body: JSON.stringify({ ...payload, id: form.id }) });
      } else {
        await compexApi("/assets", { method: "POST", body: JSON.stringify(payload) });
      }

      setError("");
      setForm(initialAsset);
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível salvar o item.");
    }
  };

  const deleteAsset = async (id: string) => {
    try {
      await compexApi("/assets", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o item.");
    }
  };

  const returnLoan = async (id: string) => {
    try {
      await compexApi("/asset-loans", { method: "PUT", body: JSON.stringify({ id, status: "DEVOLVIDO" }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível registrar a devolução.");
    }
  };

  const openEdit = (asset: Asset) => {
    setForm({
      id: asset.id,
      name: asset.name,
      category: asset.category,
      quantity: asset.quantity,
      condition: asset.condition,
      sport: asset.sport || "",
      gender: asset.gender || "",
      location: asset.location || "",
      notes: asset.notes || "",
    });
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "PATRIMONIO", "ESPORTES", "EVENTOS", "FINANCEIRO", "MARKETING"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Patrimônio</h1>
            <p className="text-sm text-slate-500">Controle de materiais, itens esportivos e empréstimos internos.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Box size={16} className="text-blue-700" />
            <span>{assets.length} itens cadastrados</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">{form.id ? "Editar item" : "Novo item"}</h2>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">{form.id ? "Atualização" : "Cadastro"}</span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-bold text-slate-700">
              Nome
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Categoria
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Quantidade
              <input type="number" min={1} value={form.quantity} onChange={(event) => setForm({ ...form, quantity: Number(event.target.value || 1) })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Condição
              <select value={form.condition} onChange={(event) => setForm({ ...form, condition: event.target.value as AssetCondition })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="OTIMO">Ótimo</option>
                <option value="BOM">Bom</option>
                <option value="REGULAR">Regular</option>
                <option value="RUIM">Ruim</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Modalidade / esporte
              <input value={form.sport} onChange={(event) => setForm({ ...form, sport: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Gênero
              <select value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as any })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="">Sem gênero</option>
                <option value="MASCULINO">Masculino</option>
                <option value="FEMININO">Feminino</option>
                <option value="MISTA">Mista</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-2">
              Localização
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Armário, sala, depósito..." />
            </label>

            <label className="block text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-3">
              Observações
              <textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" rows={3} placeholder="Detalhes úteis sobre manutenção, uso ou lembretes" />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" onClick={() => setForm(initialAsset)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50">
              Limpar
            </button>
            <button type="button" onClick={saveAsset} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745]">
              <Plus size={16} /> {form.id ? "Salvar alterações" : "Cadastrar item"}
            </button>
          </div>
        </div>

        <div className="mb-6 compex-card p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar item, categoria ou local"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando patrimônio...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="compex-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Item</th>
                      <th className="px-5 py-3">Qtd.</th>
                      <th className="px-5 py-3">Condição</th>
                      <th className="px-5 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssets.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">Nenhum item encontrado.</td>
                      </tr>
                    ) : (
                      filteredAssets.map((asset) => (
                        <tr key={asset.id} className="border-t border-slate-100">
                          <td className="px-5 py-4">
                            <div className="font-bold text-slate-900">{asset.name}</div>
                            <div className="text-xs text-slate-500">{asset.category} · {asset.location || "Local não informado"}</div>
                          </td>
                          <td className="px-5 py-4 text-slate-700">{asset.quantity}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${conditionClass[asset.condition]}`}>
                              {conditionLabel[asset.condition]}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2">
                              <button type="button" onClick={() => openEdit(asset)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                                Editar
                              </button>
                              <button type="button" onClick={() => deleteAsset(asset.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
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

            <div className="compex-card p-5">
              <h2 className="mb-4 text-lg font-black text-slate-900">Empréstimos</h2>
              <div className="space-y-3">
                {loans.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum empréstimo registrado.</p>
                ) : (
                  loans.slice(0, 8).map((loan) => (
                    <div key={loan.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-slate-900">{loan.borrowerName}</div>
                          <div className="text-xs text-slate-500">{loan.asset?.name || "Item"} · {loan.quantity}x</div>
                        </div>
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${loan.status === "DEVOLVIDO" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                          {loan.status === "DEVOLVIDO" ? "Devolvido" : "Emprestado"}
                        </span>
                      </div>

                      {loan.status !== "DEVOLVIDO" && (
                        <button type="button" onClick={() => returnLoan(loan.id)} className="mt-3 rounded-lg bg-[#0b2265] px-3 py-1.5 text-[11px] font-bold text-white hover:bg-[#071745]">
                          Marcar devolução
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
