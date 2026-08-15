"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MessageSquareText, Plus, Trash2 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type BoardPost = {
  id: string;
  type: "RECADO" | "ELOGIO";
  authorName: string;
  message: string;
  createdAt: string;
};

export default function ComunicacaoPage() {
  const [posts, setPosts] = useState<BoardPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "RECADO" | "ELOGIO">("all");
  const [type, setType] = useState<"RECADO" | "ELOGIO">("RECADO");
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const loadPosts = async () => {
    try {
      const list = await compexApi<BoardPost[]>("/board");
      setPosts(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o mural.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const publish = async () => {
    if (!message.trim()) {
      setFormError("Escreva a mensagem antes de publicar.");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/board", { method: "POST", body: JSON.stringify({ type, message: message.trim() }) });
      setMessage("");
      await loadPosts();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível publicar.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await compexApi("/board", { method: "DELETE", body: JSON.stringify({ id }) });
      await loadPosts();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir o recado.");
    }
  };

  const filtered = filter === "all" ? posts : posts.filter((post) => post.type === filter);

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Comunicação</h1>
            <p className="text-sm text-slate-500">Mural interno de recados e elogios entre a diretoria.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <MessageSquareText size={16} className="text-blue-700" />
            <span>{posts.length} publicações</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Novo recado</h2>
          <div className="mb-3 flex gap-2">
            {(["RECADO", "ELOGIO"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setType(value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${type === value ? "bg-[#0b2265] text-white" : "bg-slate-100 text-slate-600"}`}
              >
                {value === "RECADO" ? "Recado" : "Elogio"}
              </button>
            ))}
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={3}
            placeholder="Escreva sua mensagem para a diretoria..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
          />
          {formError && <p className="mt-2 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-3 flex justify-end">
            <button type="button" disabled={saving} onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Publicando..." : "Publicar"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex gap-2">
          {(["all", "RECADO", "ELOGIO"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-[#0b2265] text-white" : "bg-slate-100 text-slate-600"}`}
            >
              {value === "all" ? "Todos" : value === "RECADO" ? "Recados" : "Elogios"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando mural...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhuma publicação por aqui ainda.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((post) => (
              <div key={post.id} className="compex-card flex items-start justify-between gap-3 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${post.type === "ELOGIO" ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}>
                      {post.type === "ELOGIO" ? "Elogio" : "Recado"}
                    </span>
                    <span className="text-xs text-slate-500">{post.authorName} · {new Date(post.createdAt).toLocaleDateString("pt-BR")}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{post.message}</p>
                </div>
                <button type="button" onClick={() => remove(post.id)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100">
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
