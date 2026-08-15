"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, LoaderCircle, Search, Upload, X } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi, sessionToken } from "@/lib/compex-api";

type DocumentItem = {
  id: string;
  name: string;
  category: string;
  url: string | null;
  access: "public" | "private";
  createdAt: string;
};

export default function DocumentosPage() {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ name: "", category: "Geral", access: "private" as "public" | "private", file: null as File | null });

  const loadDocuments = async () => {
    try {
      const result = await compexApi<DocumentItem[]>("/documents");
      setDocuments(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os documentos.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocuments();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => !q || `${doc.name} ${doc.category}`.toLowerCase().includes(q));
  }, [documents, query]);

  const handleUpload = async () => {
    if (!form.name.trim() || !form.file) {
      setError("Informe o nome e selecione um arquivo.");
      return;
    }

    try {
      setUploading(true);
      setError("");
      const fd = new FormData();
      fd.append("name", form.name.trim());
      fd.append("category", form.category.trim() || "Geral");
      fd.append("access", form.access);
      fd.append("file", form.file);

      const response = await fetch("/api/backend/documents/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken()}` },
        body: fd,
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar o documento.");

      setForm({ name: "", category: "Geral", access: "private", file: null });
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível subir o documento.");
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = async (id: string) => {
    try {
      await compexApi("/documents", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadDocuments();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o documento.");
    }
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Documentos</h1>
            <p className="text-sm text-slate-500">Arquivos oficiais, materiais e documentação da diretoria.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <FileText size={16} className="text-blue-700" />
            <span>{documents.length} arquivados</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr_0.8fr_1fr]">
            <label className="block text-sm font-bold text-slate-700">
              Nome do documento
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Relatório trimestral" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Categoria
              <input value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Geral" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Visibilidade
              <select value={form.access} onChange={(event) => setForm({ ...form, access: event.target.value as "public" | "private" })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="private">Diretoria</option>
                <option value="public">Público</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Arquivo
              <input type="file" onChange={(event) => setForm({ ...form, file: event.target.files?.[0] || null })} className="mt-1 block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>
          </div>

          <div className="mt-4 flex justify-end">
            <button type="button" onClick={handleUpload} disabled={uploading} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Upload size={16} /> {uploading ? "Enviando..." : "Salvar documento"}
            </button>
          </div>
        </div>

        <div className="compex-card mb-6 p-4">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar documento ou categoria"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
            />
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando documentos...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : (
          <div className="compex-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Documento</th>
                    <th className="px-5 py-3">Categoria</th>
                    <th className="px-5 py-3">Visibilidade</th>
                    <th className="px-5 py-3">Data</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">Nenhum documento encontrado.</td>
                    </tr>
                  ) : (
                    filtered.map((doc) => (
                      <tr key={doc.id} className="border-t border-slate-100">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-blue-50 p-2 text-blue-700"><FileText size={16} /></div>
                            <div>
                              <div className="font-bold text-slate-900">{doc.name}</div>
                              <div className="text-xs text-slate-500">{doc.url ? "Arquivo disponível" : "Sem link"}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{doc.category}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${doc.access === "public" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                            {doc.access === "public" ? "Público" : "Diretoria"}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{new Date(doc.createdAt).toLocaleDateString("pt-BR")}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            {doc.url && (
                              <a href={doc.url} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                                Abrir
                              </a>
                            )}
                            <button type="button" onClick={() => removeDocument(doc.id)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
                              <X size={12} /> Excluir
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
        )}
      </div>
    </GestaoGuard>
  );
}
