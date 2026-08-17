"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, Vote, Plus, CalendarClock, PlayCircle, StopCircle, ShieldCheck, Trash2, AlertTriangle } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type PollStatus = "RASCUNHO" | "AGENDADA" | "ABERTA" | "ENCERRADA" | "VALIDADA";

type PollResult = { option: string; votes: number };

type Poll = {
  id: string;
  title: string;
  question: string;
  description: string | null;
  rules: string | null;
  options: string[];
  audience: string[] | null;
  status: PollStatus;
  startAt: string | null;
  expiresAt: string | null;
  results: PollResult[];
  totalVotes: number;
  tied: boolean;
  winnerIndex: number | null;
  officialWinnerIndex: number | null;
  validatedByName: string | null;
  validatedAt: string | null;
  validationNote: string | null;
  tieBreakMethod: string | null;
  createdBy: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<PollStatus, string> = {
  RASCUNHO: "Rascunho", AGENDADA: "Agendada", ABERTA: "Aberta", ENCERRADA: "Aguardando validação", VALIDADA: "Resultado validado",
};
const STATUS_COLOR: Record<PollStatus, string> = {
  RASCUNHO: "bg-slate-100 text-slate-600", AGENDADA: "bg-blue-50 text-blue-700",
  ABERTA: "bg-emerald-50 text-emerald-700", ENCERRADA: "bg-amber-50 text-amber-700", VALIDADA: "bg-slate-800 text-white",
};
const ROLES = ["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"];

const emptyForm = {
  title: "", question: "", description: "", rules: "", options: ["", ""], audience: [] as string[],
  startAt: "", expiresAt: "", openNow: false,
};

export default function EnquetesPage() {
  const [items, setItems] = useState<Poll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [scheduleFor, setScheduleFor] = useState<Record<string, string>>({});
  const [validateForm, setValidateForm] = useState<Record<string, { officialWinnerIndex: string; tieBreakMethod: string; validationNote: string }>>({});

  const load = async () => {
    try {
      const list = await compexApi<Poll[]>("/polls");
      setItems(Array.isArray(list) ? list : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as enquetes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const setOption = (index: number, value: string) => {
    setForm((prev) => ({ ...prev, options: prev.options.map((o, i) => (i === index ? value : o)) }));
  };
  const addOption = () => setForm((prev) => ({ ...prev, options: [...prev.options, ""] }));
  const removeOption = (index: number) => setForm((prev) => ({ ...prev, options: prev.options.filter((_, i) => i !== index) }));
  const toggleAudience = (role: string) => setForm((prev) => ({ ...prev, audience: prev.audience.includes(role) ? prev.audience.filter((r) => r !== role) : [...prev.audience, role] }));

  const create = async () => {
    const options = form.options.map((o) => o.trim()).filter(Boolean);
    if (!form.question.trim() || options.length < 2) { setFormError("Informe a pergunta e ao menos 2 opções."); return; }
    if (!form.expiresAt) { setFormError("Toda enquete precisa de uma data/hora de encerramento."); return; }
    setSaving(true);
    setFormError("");
    try {
      await compexApi("/polls", {
        method: "POST",
        body: JSON.stringify({
          title: form.title.trim() || form.question.trim(), question: form.question.trim(),
          description: form.description || null, rules: form.rules || null, options,
          audience: form.audience.length ? form.audience : null,
          startAt: form.startAt || null, expiresAt: form.expiresAt, openNow: form.openNow,
        }),
      });
      setForm(emptyForm);
      await load();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Não foi possível criar a enquete.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await compexApi(`/polls/${id}/${action}`, { method: "POST", body: JSON.stringify(extra || {}) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar a ação.");
    }
  };

  const remove = async (id: string) => {
    try {
      await compexApi(`/polls/${id}`, { method: "DELETE" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível excluir.");
    }
  };

  const validate = async (poll: Poll) => {
    const v = validateForm[poll.id] || { officialWinnerIndex: "", tieBreakMethod: "", validationNote: "" };
    if (poll.tied && v.officialWinnerIndex === "") { setError("Enquete empatada — selecione a opção vencedora."); return; }
    if (poll.tied && !v.tieBreakMethod.trim()) { setError("Informe como o empate foi resolvido."); return; }
    await runAction(poll.id, "validate", {
      officialWinnerIndex: v.officialWinnerIndex !== "" ? Number(v.officialWinnerIndex) : undefined,
      tieBreakMethod: v.tieBreakMethod || undefined,
      validationNote: v.validationNote || undefined,
    });
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Enquetes</h1>
            <p className="text-sm text-slate-500">Votações institucionais com encerramento obrigatório e validação final do resultado.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Vote size={16} className="text-blue-700" />
            <span>{items.length} enquetes</span>
          </div>
        </header>

        <div className="compex-card mb-6 p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Nova enquete</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} placeholder="Título (opcional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
            <textarea value={form.question} onChange={(e) => setForm((p) => ({ ...p, question: e.target.value }))} rows={2} placeholder="Pergunta" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
            <textarea value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} placeholder="Descrição (opcional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
            <textarea value={form.rules} onChange={(e) => setForm((p) => ({ ...p, rules: e.target.value }))} rows={2} placeholder="Regras da votação (opcional)" className="rounded-xl border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />

            <div className="sm:col-span-2 space-y-2">
              <span className="text-xs font-bold text-slate-500">Opções</span>
              {form.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input value={option} onChange={(e) => setOption(index, e.target.value)} placeholder={`Opção ${index + 1}`} className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm" />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(index)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"><Trash2 size={12} /></button>
                  )}
                </div>
              ))}
              <button type="button" onClick={addOption} className="text-xs font-bold text-blue-700 hover:underline">+ Adicionar opção</button>
            </div>

            <label className="text-xs font-bold text-slate-500">
              Início (opcional — agenda para o futuro)
              <input type="datetime-local" value={form.startAt} onChange={(e) => setForm((p) => ({ ...p, startAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs font-bold text-slate-500">
              Encerramento (obrigatório)
              <input type="datetime-local" value={form.expiresAt} onChange={(e) => setForm((p) => ({ ...p, expiresAt: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" />
            </label>

            <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-slate-500">Público (vazio = todos os papéis internos):</span>
              {ROLES.map((role) => (
                <label key={role} className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                  <input type="checkbox" checked={form.audience.includes(role)} onChange={() => toggleAudience(role)} /> {role}
                </label>
              ))}
            </div>

            <label className="sm:col-span-2 inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
              <input type="checkbox" checked={form.openNow} onChange={(e) => setForm((p) => ({ ...p, openNow: e.target.checked }))} />
              Abrir para votação imediatamente
            </label>
          </div>
          {formError && <p className="mt-2 text-sm font-medium text-red-600">{formError}</p>}
          <div className="mt-3 flex justify-end">
            <button type="button" disabled={saving} onClick={create} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-60">
              <Plus size={16} /> {saving ? "Salvando..." : "Criar enquete"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando enquetes...
          </div>
        ) : error ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
        ) : items.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhuma enquete criada ainda.</div>
        ) : (
          <div className="space-y-3">
            {items.map((poll) => (
              <div key={poll.id} className="compex-card p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[poll.status]}`}>{STATUS_LABEL[poll.status]}</span>
                      {poll.tied && poll.status !== "VALIDADA" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          <AlertTriangle size={10} /> Empate — decisão necessária
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{poll.audience ? poll.audience.join(" · ") : "Todos os papéis"}</span>
                    </div>
                    <h3 className="mt-2 text-sm font-bold text-slate-900">{poll.title || poll.question}</h3>
                    <p className="mt-1 text-xs text-slate-500">{poll.question}</p>
                    <p className="mt-1 text-[11px] text-slate-400">
                      {poll.createdBy} · encerra em {poll.expiresAt ? new Date(poll.expiresAt).toLocaleString("pt-BR") : "—"}
                      {poll.startAt && ` · abre em ${new Date(poll.startAt).toLocaleString("pt-BR")}`}
                    </p>
                  </div>
                  {["RASCUNHO", "AGENDADA"].includes(poll.status) && (
                    <button type="button" onClick={() => remove(poll.id)} className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"><Trash2 size={12} /></button>
                  )}
                </div>

                {poll.status !== "RASCUNHO" && poll.status !== "AGENDADA" && (
                  <div className="mt-3 space-y-1 border-t border-slate-100 pt-3">
                    {poll.results.map((r, index) => {
                      const pct = poll.totalVotes ? Math.round((r.votes / poll.totalVotes) * 100) : 0;
                      const isOfficial = poll.officialWinnerIndex === index;
                      return (
                        <div key={index} className="text-xs">
                          <div className="flex justify-between"><span className={isOfficial ? "font-bold text-emerald-700" : "text-slate-600"}>{isOfficial && "🏆 "}{r.option}</span><span className="text-slate-400">{r.votes} voto(s) · {pct}%</span></div>
                          <div className="mt-0.5 h-1.5 w-full rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-blue-600" style={{ width: `${pct}%` }} /></div>
                        </div>
                      );
                    })}
                    <p className="pt-1 text-[11px] text-slate-400">{poll.totalVotes} voto(s) no total</p>
                    {poll.status === "VALIDADA" && (
                      <p className="text-[11px] text-slate-500">Validado por {poll.validatedByName} em {poll.validatedAt && new Date(poll.validatedAt).toLocaleString("pt-BR")}{poll.tieBreakMethod && ` · desempate: ${poll.tieBreakMethod}`}</p>
                    )}
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  {poll.status === "RASCUNHO" && (
                    <>
                      <input type="datetime-local" value={scheduleFor[poll.id] || ""} onChange={(e) => setScheduleFor((p) => ({ ...p, [poll.id]: e.target.value }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                      <button type="button" onClick={() => scheduleFor[poll.id] && runAction(poll.id, "schedule", { startAt: scheduleFor[poll.id] })} disabled={!scheduleFor[poll.id]} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40">
                        <CalendarClock size={12} /> Agendar
                      </button>
                      <button type="button" onClick={() => runAction(poll.id, "open")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                        <PlayCircle size={12} /> Abrir agora
                      </button>
                    </>
                  )}
                  {poll.status === "AGENDADA" && (
                    <button type="button" onClick={() => runAction(poll.id, "open")} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-100">
                      <PlayCircle size={12} /> Abrir agora
                    </button>
                  )}
                  {poll.status === "ABERTA" && (
                    <button type="button" onClick={() => runAction(poll.id, "close")} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 hover:bg-amber-100">
                      <StopCircle size={12} /> Encerrar agora
                    </button>
                  )}
                  {poll.status === "ENCERRADA" && (
                    <div className="w-full space-y-2 rounded-lg bg-slate-50 p-3">
                      {poll.tied && (
                        <div className="flex flex-wrap items-center gap-2">
                          <select value={validateForm[poll.id]?.officialWinnerIndex || ""} onChange={(e) => setValidateForm((p) => ({ ...p, [poll.id]: { ...(p[poll.id] || { officialWinnerIndex: "", tieBreakMethod: "", validationNote: "" }), officialWinnerIndex: e.target.value } }))} className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs">
                            <option value="">Opção vencedora...</option>
                            {poll.options.map((o, i) => <option key={i} value={i}>{o}</option>)}
                          </select>
                          <input value={validateForm[poll.id]?.tieBreakMethod || ""} onChange={(e) => setValidateForm((p) => ({ ...p, [poll.id]: { ...(p[poll.id] || { officialWinnerIndex: "", tieBreakMethod: "", validationNote: "" }), tieBreakMethod: e.target.value } }))} placeholder="Como foi resolvido (ex: decisão da Presidência)" className="flex-1 rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                        </div>
                      )}
                      <input value={validateForm[poll.id]?.validationNote || ""} onChange={(e) => setValidateForm((p) => ({ ...p, [poll.id]: { ...(p[poll.id] || { officialWinnerIndex: "", tieBreakMethod: "", validationNote: "" }), validationNote: e.target.value } }))} placeholder="Observações (opcional)" className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs" />
                      <button type="button" onClick={() => validate(poll)} className="inline-flex items-center gap-1.5 rounded-lg bg-[#0b2265] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#071745]">
                        <ShieldCheck size={12} /> Validar resultado
                      </button>
                    </div>
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
