"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Plus, ShieldCheck, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Role = "PRESIDENCIA" | "FINANCEIRO" | "ESPORTES" | "EVENTOS" | "MARKETING" | "PRODUTOS" | "PATRIMONIO";
type Rank = "DIRETOR" | "COORDENADOR";

type Director = {
  id: string;
  name: string;
  email: string;
  role: Role;
  rank: Rank;
  birthDate: string | null;
  member: { course: string; plan: string; status: string } | null;
};

const roleLabel: Record<Role, string> = {
  PRESIDENCIA: "Presidência",
  FINANCEIRO: "Financeiro",
  ESPORTES: "Esportes",
  EVENTOS: "Eventos",
  MARKETING: "Marketing",
  PRODUTOS: "Produtos",
  PATRIMONIO: "Patrimônio",
};

const initialForm = {
  name: "",
  email: "",
  password: "",
  role: "FINANCEIRO" as Role,
  rank: "COORDENADOR" as Rank,
};

export default function PermissoesPage() {
  const [directors, setDirectors] = useState<Director[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const list = await compexApi<Director[]>("/directors");
      setDirectors(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as contas da diretoria.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveDirector = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      setFormError("Informe nome, e-mail e senha.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/directors", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
          rank: form.rank,
        }),
      });
      setForm(initialForm);
      await loadData();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível criar a conta.");
    } finally {
      setSaving(false);
    }
  };

  const removeDirector = async (id: string) => {
    try {
      await compexApi("/directors", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível remover a conta.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA"]}>
      <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Permissões</h1>
            <p className="text-sm text-slate-500">Contas de diretoria, vice-presidência e coordenadores por área.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <ShieldCheck size={16} className="text-blue-700" />
            <span>{directors.length} contas</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Nova conta</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-bold text-slate-700">
              Nome
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              E-mail
              <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Senha inicial
              <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Área
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                {(Object.keys(roleLabel) as Role[]).map((role) => (
                  <option key={role} value={role}>{roleLabel[role]}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Nível
              <select value={form.rank} onChange={(e) => setForm({ ...form, rank: e.target.value as Rank })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="DIRETOR">Diretor(a)</option>
                <option value="COORDENADOR">Coordenador(a)</option>
              </select>
            </label>
          </div>
          {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={saveDirector} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : "Criar conta"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando contas...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <div className="compex-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Nome</th>
                    <th className="px-5 py-3">Área</th>
                    <th className="px-5 py-3">Nível</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {directors.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">Nenhuma conta cadastrada.</td>
                    </tr>
                  ) : (
                    directors.map((director) => (
                      <tr key={director.id} className="border-t border-slate-100">
                        <td className="px-5 py-4">
                          <div className="font-bold text-slate-900">{director.name}</div>
                          <div className="text-xs text-slate-500">{director.email}</div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{roleLabel[director.role] || director.role}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${director.rank === "DIRETOR" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"}`}>
                            {director.rank === "DIRETOR" ? "Diretor(a)" : "Coordenador(a)"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => removeDirector(director.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
                            <Trash2 size={12} /> Remover
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
