"use client";

import { useEffect, useState } from "react";
import { Handshake, LoaderCircle, Plus, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Sponsor = {
  id: string;
  company: string;
  contact: string;
  value: string;
  status: string;
  delivery: string;
  category: string;
  responsibleName: string | null;
  responsibleEmail: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
};

const initialSponsor = {
  company: "",
  contact: "",
  value: "",
  status: "Negociando",
  delivery: "",
  category: "PATROCINIO",
  responsibleName: "",
  responsibleEmail: "",
  notes: "",
};

const statusClass = (status: string) => {
  if (status === "Fechado") return "bg-emerald-50 text-emerald-700";
  if (status === "Perdido") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
};

export default function PatrocinadoresPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialSponsor);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const list = await compexApi<Sponsor[]>("/sponsors");
      setSponsors(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os patrocinadores.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveSponsor = async () => {
    if (!form.company.trim() || !form.contact.trim()) {
      setFormError("Informe a empresa e o contato.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/sponsors", {
        method: "POST",
        body: JSON.stringify({
          company: form.company.trim(),
          contact: form.contact.trim(),
          value: form.value.trim() || "A definir",
          status: form.status,
          delivery: form.delivery.trim() || "—",
          category: form.category,
          responsibleName: form.responsibleName.trim() || null,
          responsibleEmail: form.responsibleEmail.trim() || null,
          notes: form.notes.trim() || null,
        }),
      });
      setForm(initialSponsor);
      await loadData();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível salvar o patrocinador.");
    } finally {
      setSaving(false);
    }
  };

  const deleteSponsor = async (id: string) => {
    try {
      await compexApi("/sponsors", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o patrocinador.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "MARKETING", "EVENTOS"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Patrocinadores</h1>
            <p className="text-sm text-slate-500">Negociações, contratos e acompanhamento de parcerias.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Handshake size={16} className="text-blue-700" />
            <span>{sponsors.length} registros</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Novo patrocinador</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-bold text-slate-700">
              Empresa
              <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Contato
              <input value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Telefone, e-mail..." />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Valor
              <input value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: R$ 5.000 ou permuta" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Status
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="Negociando">Negociando</option>
                <option value="Fechado">Fechado</option>
                <option value="Perdido">Perdido</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Categoria
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="PATROCINIO">Patrocínio</option>
                <option value="PARCERIA">Parceria</option>
                <option value="PERMUTA">Permuta</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Entrega/contrapartida
              <input value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Logo na camisa" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Responsável interno
              <input value={form.responsibleName} onChange={(e) => setForm({ ...form, responsibleName: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              E-mail do responsável
              <input value={form.responsibleEmail} onChange={(e) => setForm({ ...form, responsibleEmail: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-3">
              Observações
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={saveSponsor} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : "Cadastrar patrocinador"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando patrocinadores...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <div className="compex-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Empresa</th>
                    <th className="px-5 py-3">Valor</th>
                    <th className="px-5 py-3">Categoria</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {sponsors.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">Nenhum patrocinador registrado.</td>
                    </tr>
                  ) : (
                    sponsors.map((sponsor) => (
                      <tr key={sponsor.id} className="border-t border-slate-100">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{sponsor.company}</div>
                          <div className="text-xs text-slate-500">{sponsor.contact}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{sponsor.value}</td>
                        <td className="px-5 py-4 text-slate-700">{sponsor.category}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusClass(sponsor.status)}`}>{sponsor.status}</span>
                        </td>
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => deleteSponsor(sponsor.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
                            <Trash2 size={12} /> Excluir
                          </button>
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
