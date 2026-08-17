"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Newspaper, Plus, Send, CalendarClock, Archive, Trash2, ImagePlus, Pencil, X } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi, sessionToken } from "@/lib/compex-api";

type NewsStatus = "RASCUNHO" | "EM_REVISAO" | "AGENDADO" | "PUBLICADO" | "ARQUIVADO";
type NewsType = "NOTICIA" | "COMUNICADO" | "NOVIDADE" | "RESULTADO" | "EVENTO" | "CAMPANHA" | "CHAMADA" | "AVISO_IMPORTANTE";

type NewsItem = {
  id: string;
  slug: string;
  title: string;
  type: NewsType;
  category: string;
  summary: string | null;
  content: string;
  imageUrl: string | null;
  authorName: string;
  department: string | null;
  status: NewsStatus;
  highlighted: boolean;
  channels: string[];
  publishAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<NewsStatus, string> = {
  RASCUNHO: "Rascunho", EM_REVISAO: "Em revisão", AGENDADO: "Agendado", PUBLICADO: "Publicado", ARQUIVADO: "Arquivado",
};
const STATUS_COLOR: Record<NewsStatus, string> = {
  RASCUNHO: "bg-slate-100 text-slate-600", EM_REVISAO: "bg-amber-50 text-amber-700",
  AGENDADO: "bg-blue-50 text-blue-700", PUBLICADO: "bg-emerald-50 text-emerald-700", ARQUIVADO: "bg-slate-200 text-slate-500",
};
const TYPE_LABEL: Record<NewsType, string> = {
  NOTICIA: "Notícia", COMUNICADO: "Comunicado", NOVIDADE: "Novidade", RESULTADO: "Resultado",
  EVENTO: "Evento", CAMPANHA: "Campanha", CHAMADA: "Chamada", AVISO_IMPORTANTE: "Aviso importante",
};
const CHANNELS = ["HOME", "PORTAL", "GESTAO"] as const;
const CHANNEL_LABEL: Record<string, string> = { HOME: "Home pública", PORTAL: "Portal do Associado", GESTAO: "Somente Gestão" };

const emptyForm = {
  title: "", type: "NOTICIA" as NewsType, category: "Comunicado", summary: "", content: "",
  imageUrl: "", department: "", highlighted: false, channels: ["HOME", "PORTAL"] as string[], expiresAt: "",
};

export default function NoticiasCmsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<NewsStatus | "all">("all");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<Record<string, string>>({});

  const load = async () => {
    try {
      const list = await compexApi<NewsItem[]>("/news");
      setItems(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar o conteúdo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const uploadImage = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = sessionToken();
      const response = await fetch("/api/backend/news/upload", { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : undefined, body: formData });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.url) throw new Error(data.error || "Erro ao enviar a imagem");
      setForm((prev) => ({ ...prev, imageUrl: data.url }));
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Erro ao enviar a imagem.");
    } finally {
      setUploading(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(channel) ? prev.channels.filter((c) => c !== channel) : [...prev.channels, channel],
    }));
  };

  const startEdit = (item: NewsItem) => {
    setEditingId(item.id);
    setForm({
      title: item.title, type: item.type, category: item.category, summary: item.summary || "",
      content: item.content, imageUrl: item.imageUrl || "", department: item.department || "",
      highlighted: item.highlighted, channels: item.channels, expiresAt: item.expiresAt ? item.expiresAt.slice(0, 10) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError("");
  };

  const saveDraft = async () => {
    if (!form.title.trim() || !form.content.trim()) { setFormError("Informe título e conteúdo."); return; }
    if (!form.channels.length) { setFormError("Selecione ao menos um canal de exibição."); return; }
    setSaving(true);
    setFormError("");
    try {
      const payload = {
        title: form.title.trim(), type: form.type, category: form.category, summary: form.summary || null,
        content: form.content, imageUrl: form.imageUrl || null, department: form.department || null,
        highlighted: form.highlighted, channels: form.channels, expiresAt: form.expiresAt || null,
      };
      if (editingId) {
        await compexApi("/news", { method: "PUT", body: JSON.stringify({ id: editingId, ...payload }) });
      } else {
        await compexApi("/news", { method: "POST", body: JSON.stringify(payload) });
      }
      cancelEdit();
      await load();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await compexApi("/news", { method: "PUT", body: JSON.stringify({ id, action, ...extra }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar a ação.");
    }
  };

  const remove = async (id: string) => {
    try {
      await compexApi("/news", { method: "DELETE", body: JSON.stringify({ id }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir.");
    }
  };

  const filtered = filter === "all" ? items : items.filter((item) => item.status === filter);

  return (
    <GestaoGuard allow={["PRESIDENCIA", "MARKETING"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão · Marketing</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Notícias & Comunicados</h1>
            <p className="text-sm text-slate-500">Publique conteúdo na Home, no Portal do Associado ou somente para a Gestão.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Newspaper size={16} className="text-blue-700" />
            <span>{items.length} publicações</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-black text-slate-900">{editingId ? "Editar publicação" : "Nova publicação (rascunho)"}</h2>
            {editingId && (
              <button type="button" onClick={cancelEdit} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700">
                <X size={14} /> Cancelar edição
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Título" className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-500 sm:col-span-2" />
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as NewsType }))} className="rounded-xl border border-slate-200 px-3 py-2 text-sm">
              {Object.entries(TYPE_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <input value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} placeholder="Categoria (ex: Campeonato)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input value={form.department} onChange={(e) => setForm((p) => ({ ...p, department: e.target.value }))} placeholder="Departamento (opcional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <input type="date" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} title="Data de expiração (opcional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            <textarea value={form.summary} onChange={(e) => setForm((p) => ({ ...p, summary: e.target.value }))} rows={2} placeholder="Resumo (aparece na listagem)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
            <textarea value={form.content} onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))} rows={5} placeholder="Conteúdo completo" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />

            <div className="sm:col-span-2 flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">
                <ImagePlus size={14} /> {uploading ? "Enviando..." : "Imagem de capa"}
                <input type="file" accept="image/*" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadImage(file); }} />
              </label>
              {form.imageUrl && <img src={form.imageUrl} alt="" className="h-10 w-16 rounded-lg object-cover" />}
            </div>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-4">
              <span className="text-xs font-bold text-slate-500">Exibir em:</span>
              {CHANNELS.map((channel) => (
                <label key={channel} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <input type="checkbox" checked={form.channels.includes(channel)} onChange={() => toggleChannel(channel)} />
                  {CHANNEL_LABEL[channel]}
                </label>
              ))}
              <label className="ml-auto inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                <input type="checkbox" checked={form.highlighted} onChange={(e) => setForm((p) => ({ ...p, highlighted: e.target.checked }))} />
                Destacar
              </label>
            </div>
          </div>
          {formError && <p className="mt-2 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-3 flex justify-end">
            <button type="button" disabled={saving} onClick={saveDraft} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : editingId ? "Salvar alterações" : "Salvar rascunho"}
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "RASCUNHO", "EM_REVISAO", "AGENDADO", "PUBLICADO", "ARQUIVADO"] as const).map((value) => (
            <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-1.5 text-xs font-bold ${filter === value ? "bg-[#0b2265] text-white" : "bg-slate-100 text-slate-600"}`}>
              {value === "all" ? "Todos" : STATUS_LABEL[value]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando publicações...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhuma publicação por aqui ainda.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((item) => (
              <div key={item.id} className="compex-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[item.status]}`}>{STATUS_LABEL[item.status]}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">{TYPE_LABEL[item.type]}</span>
                      {item.highlighted && <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">Destaque</span>}
                      <span className="text-xs text-slate-400">{item.channels.map((c) => CHANNEL_LABEL[c]).join(" · ")}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-slate-900">{item.title}</h3>
                    <p className="mt-1 text-xs text-slate-500">{item.summary || item.content.slice(0, 140)}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {item.authorName} · {new Date(item.createdAt).toLocaleDateString("pt-BR")}
                      {item.publishAt && ` · publica em ${new Date(item.publishAt).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => startEdit(item)} disabled={!["RASCUNHO", "EM_REVISAO"].includes(item.status)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30">
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => remove(item.id)} disabled={!["RASCUNHO", "ARQUIVADO"].includes(item.status)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-30">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {item.status === "RASCUNHO" && (
                    <button type="button" onClick={() => runAction(item.id, "submit_review")} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                      <Send size={12} /> Enviar para revisão
                    </button>
                  )}
                  {["RASCUNHO", "EM_REVISAO", "AGENDADO"].includes(item.status) && (
                    <>
                      <button type="button" onClick={() => runAction(item.id, "publish")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                        Publicar agora
                      </button>
                      <input
                        type="datetime-local"
                        value={scheduleFor[item.id] || ""}
                        onChange={(e) => setScheduleFor((p) => ({ ...p, [item.id]: e.target.value }))}
                        className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => scheduleFor[item.id] && runAction(item.id, "schedule", { publishAt: scheduleFor[item.id] })}
                        disabled={!scheduleFor[item.id]}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                      >
                        <CalendarClock size={12} /> Agendar
                      </button>
                    </>
                  )}
                  {item.status === "PUBLICADO" && (
                    <button type="button" onClick={() => runAction(item.id, "archive")} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200">
                      <Archive size={12} /> Arquivar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
