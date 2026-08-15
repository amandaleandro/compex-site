"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, LoaderCircle, Plus, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Warning = {
  id: string;
  type: "ADVERTENCIA" | "SUSPENSAO" | "DESLIGAMENTO";
  reason: string;
  createdAt: string;
  userId: string;
  userName: string;
  userRole: string;
};

type Director = { id: string; name: string; role: string };

const typeLabel: Record<Warning["type"], string> = {
  ADVERTENCIA: "Advertência",
  SUSPENSAO: "Suspensão",
  DESLIGAMENTO: "Desligamento",
};

const typeClass: Record<Warning["type"], string> = {
  ADVERTENCIA: "bg-amber-50 text-amber-700",
  SUSPENSAO: "bg-orange-50 text-orange-700",
  DESLIGAMENTO: "bg-red-50 text-red-700",
};

const initialForm = { userId: "", type: "ADVERTENCIA" as Warning["type"], reason: "" };

export default function AdvertenciasPage() {
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [directors, setDirectors] = useState<Director[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      const [warningList, directorList] = await Promise.all([
        compexApi<Warning[]>("/warnings"),
        compexApi<Director[]>("/directors"),
      ]);
      setWarnings(Array.isArray(warningList) ? warningList : []);
      setDirectors(Array.isArray(directorList) ? directorList : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as advertências.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const saveWarning = async () => {
    if (!form.userId || !form.reason.trim()) {
      setFormError("Selecione a pessoa e descreva o motivo.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/warnings", {
        method: "POST",
        body: JSON.stringify({ userId: form.userId, type: form.type, reason: form.reason.trim() }),
      });
      setForm(initialForm);
      await loadData();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível registrar a advertência.");
    } finally {
      setSaving(false);
    }
  };

  const removeWarning = async (id: string) => {
    try {
      await compexApi("/warnings", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadData();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir a advertência.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Advertências</h1>
            <p className="text-sm text-slate-500">Registro disciplinar da diretoria e coordenadores por área.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <AlertTriangle size={16} className="text-blue-700" />
            <span>{warnings.length} registros</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Nova advertência</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <label className="block text-sm font-bold text-slate-700">
              Pessoa
              <select value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="">Selecione...</option>
                {directors.map((director) => (
                  <option key={director.id} value={director.id}>{director.name}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700">
              Tipo
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as Warning["type"] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="ADVERTENCIA">Advertência</option>
                <option value="SUSPENSAO">Suspensão</option>
                <option value="DESLIGAMENTO">Desligamento</option>
              </select>
            </label>
            <label className="block text-sm font-bold text-slate-700 md:col-span-2 xl:col-span-1">
              Motivo
              <input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
          </div>
          {formError && <p className="mt-3 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-4 flex justify-end">
            <button type="button" disabled={saving} onClick={saveWarning} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : "Registrar"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando advertências...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : warnings.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhuma advertência registrada.</div>
        ) : (
          <div className="space-y-3">
            {warnings.map((warning) => (
              <div key={warning.id} className="compex-card flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${typeClass[warning.type]}`}>{typeLabel[warning.type]}</span>
                    <span className="text-xs text-slate-500">{new Date(warning.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <div className="mt-2 font-bold text-slate-900">{warning.userName}</div>
                  <p className="text-sm text-slate-600">{warning.reason}</p>
                </div>
                <button type="button" onClick={() => removeWarning(warning.id)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100">
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
