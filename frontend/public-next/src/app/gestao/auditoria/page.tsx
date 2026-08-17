"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type LogEntry = {
  id: string;
  actorName: string;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  note: string | null;
  createdAt: string;
};

function AuditoriaContent() {
  const [items, setItems] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    compexApi<LogEntry[]>("/audit-log")
      .then((result) => setItems(Array.isArray(result) ? result : []))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar a auditoria."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => [i.actorName, i.action, i.entity, i.entityId || ""].join(" ").toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9">
      <header className="mb-6">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Auditoria</h1>
        <p className="text-sm text-slate-500">Trilha das últimas 200 ações administrativas — quem fez, o quê e quando.</p>
      </header>

      <div className="compex-card mb-6 p-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por pessoa, ação ou registro"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
        </div>
      ) : error ? (
        <div className="compex-card flex min-h-[220px] items-center justify-center text-sm font-medium text-red-600">{error}</div>
      ) : (
        <div className="compex-card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-100 text-[11px] font-black uppercase tracking-[0.1em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Quando</th>
                <th className="px-4 py-3">Quem</th>
                <th className="px-4 py-3">Ação</th>
                <th className="px-4 py-3">Registro</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-500">Nenhum registro encontrado.</td></tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-4 py-3 text-xs text-slate-500">{new Date(log.createdAt).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-3 font-bold text-slate-800">{log.actorName}{log.actorRole ? <span className="ml-1 text-[11px] font-normal text-slate-400">({log.actorRole})</span> : null}</td>
                    <td className="px-4 py-3 text-slate-700">{log.action}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{log.entity}{log.entityId ? ` · ${log.entityId.slice(0, 8)}` : ""}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function AuditoriaPage() {
  return (
    <GestaoGuard allow={["PRESIDENCIA"]}>
      <AuditoriaContent />
    </GestaoGuard>
  );
}
