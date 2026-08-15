"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, MessageSquarePlus, Sparkles } from "lucide-react";
import GestaoGuard, { useGestaoSession } from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

const ROLE_LABEL: Record<string, string> = { PRESIDENCIA: "Presidência", FINANCEIRO: "Financeiro", ESPORTES: "Esportes", EVENTOS: "Eventos", MARKETING: "Marketing", PRODUTOS: "Produtos", PATRIMONIO: "Patrimônio", ASSOCIADO: "Associado" };
const money = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const initials = (name: string) => (name || "").split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

type Stats = { members: number; events: number; athletes: number; balance: number; months: { month: string; income: number; expense: number }[] };
type Director = { id: string; name: string; email: string; role: string };
type EventItem = { id: string; name: string; date: string; type: string | null; location: string | null; published: boolean };
type DashboardExtra = {
  birthdays: { name: string; role: string; day: number }[];
  spotlight: { name: string; role: string | null; count: number } | null;
  upcomingGames: { teamName: string; date: string; location: string | null; coachName: string | null }[];
  upcomingTrainings: { teamName: string; date: string; location: string | null; coachName: string | null }[];
  todayTasks: { id: string; title: string; team: string; owner: string | null }[];
};
type Poll = { id: string; question: string; options: string[]; expiresAt: string | null; myVote: number | null; totalVotes: number; results: { option: string; votes: number }[]; effectiveClosed: boolean; closed: boolean; isExpired: boolean };
type BoardPost = { id: string; message: string; authorName: string; createdAt: string };

function sessionRow(s: { teamName: string; date: string; location: string | null; coachName: string | null }, key: string) {
  const date = new Date(s.date);
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = date.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();
  return (
    <div key={key} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-50 text-center leading-none"><b className="block text-sm">{day}</b><span className="block text-[9px] text-slate-500">{month}</span></div>
      <div className="min-w-0"><strong className="block truncate text-sm text-slate-900">{s.teamName}</strong><p className="truncate text-xs text-slate-500">{s.location || "Local a definir"}{s.coachName ? ` · ${s.coachName}` : ""}</p></div>
    </div>
  );
}

function Panel({ eyebrow, title, action, children }: { eyebrow: string; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="compex-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <div><span className="text-[10px] font-black uppercase tracking-widest text-blue-700">{eyebrow}</span><h2 className="text-base font-black text-slate-900">{title}</h2></div>
        {action}
      </div>
      {children}
    </article>
  );
}

function FinanceChart({ months }: { months: Stats["months"] }) {
  if (!months.length) return <p className="py-8 text-center text-xs font-bold text-slate-400">Sem dados financeiros ainda.</p>;
  const max = Math.max(10, ...months.flatMap((m) => [m.income, m.expense]));
  const step = Math.ceil(max / 4 / 5) * 5 || 5;
  const top = step * 4;
  const n = months.length || 1;
  const point = (value: number, index: number): [number, number] => [n === 1 ? 0 : (index / (n - 1)) * 600, 220 - Math.min(1, value / top) * 220];
  const pathFor = (key: "income" | "expense") => months.map((m, i) => point(m[key], i)).map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const monthLabel = (key: string) => new Date(`${key}-02`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase();

  return (
    <div>
      <div className="mb-2 flex gap-4 text-[11px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-blue-600" /> Receitas</span>
        <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" /> Despesas</span>
      </div>
      <svg viewBox="0 0 600 220" preserveAspectRatio="none" className="h-40 w-full">
        <path d={`${pathFor("income")} L600 220 L0 220 Z`} fill="#2563eb" opacity={0.08} />
        <path d={pathFor("income")} fill="none" stroke="#2563eb" strokeWidth={2.5} />
        <path d={pathFor("expense")} fill="none" stroke="#ef4444" strokeWidth={2.5} />
      </svg>
      <div className="mt-1 flex justify-between text-[10px] font-bold text-slate-400">{months.map((m) => <span key={m.month}>{monthLabel(m.month)}</span>)}</div>
    </div>
  );
}

function GestaoHome() {
  const session = useGestaoSession();
  const canSeeFinance = session.role === "PRESIDENCIA" || session.role === "FINANCEIRO";

  const [stats, setStats] = useState<Stats | null>(null);
  const [directors, setDirectors] = useState<Director[] | null>(null);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [extra, setExtra] = useState<DashboardExtra | null>(null);
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [recados, setRecados] = useState<BoardPost[] | null>(null);
  const [elogios, setElogios] = useState<BoardPost[] | null>(null);
  const [monthsWindow, setMonthsWindow] = useState(6);
  const [boardModal, setBoardModal] = useState<"RECADO" | "ELOGIO" | null>(null);
  const [boardMessage, setBoardMessage] = useState("");
  const [boardError, setBoardError] = useState("");
  const [posting, setPosting] = useState(false);

  const loadBoard = (type: "RECADO" | "ELOGIO", setter: (posts: BoardPost[]) => void) => {
    compexApi<BoardPost[]>(`/board?type=${type}`).then(setter).catch(() => setter([]));
  };

  useEffect(() => {
    compexApi<Stats>("/stats").then(setStats).catch(() => setStats(null));
    compexApi<EventItem[]>("/events").then(setEvents).catch(() => setEvents([]));
    compexApi<DashboardExtra>("/dashboard-extra").then(setExtra).catch(() => setExtra(null));
    compexApi<Poll[]>("/polls").then(setPolls).catch(() => setPolls([]));
    loadBoard("RECADO", setRecados);
    loadBoard("ELOGIO", setElogios);
    if (session.role === "PRESIDENCIA") compexApi<Director[]>("/directors").then(setDirectors).catch(() => setDirectors([]));
  }, [session.role]);

  const upcomingEvents = useMemo(() => events
    .filter((e) => e.published !== false && new Date(e.date) >= new Date(new Date().toDateString()))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3), [events]);

  const openPolls = (polls || []).filter((p) => !p.effectiveClosed && !p.closed && !p.isExpired);

  const vote = async (pollId: string, optionIndex: number) => {
    try {
      await compexApi(`/polls/${pollId}/vote`, { method: "POST", body: JSON.stringify({ optionIndex }) });
      compexApi<Poll[]>("/polls").then(setPolls).catch(() => {});
    } catch (reason) {
      alert(reason instanceof Error ? reason.message : "Erro ao registrar voto.");
    }
  };

  const completeTask = async (id: string) => {
    setExtra((prev) => prev ? { ...prev, todayTasks: prev.todayTasks.filter((t) => t.id !== id) } : prev);
    try {
      await compexApi("/tasks", { method: "PUT", body: JSON.stringify({ id, status: "done" }) });
    } catch {}
    compexApi<DashboardExtra>("/dashboard-extra").then(setExtra).catch(() => {});
  };

  const submitBoard = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!boardMessage.trim()) { setBoardError("Escreva uma mensagem."); return; }
    setPosting(true);
    try {
      await compexApi("/board", { method: "POST", body: JSON.stringify({ type: boardModal, message: boardMessage.trim() }) });
      setBoardModal(null);
      setBoardMessage("");
      setBoardError("");
      if (boardModal === "RECADO") loadBoard("RECADO", setRecados);
      else if (boardModal === "ELOGIO") loadBoard("ELOGIO", setElogios);
    } catch {
      setBoardError("Não foi possível publicar.");
    } finally {
      setPosting(false);
    }
  };

  const todayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date());

  return (
    <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9 lg:px-9 space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-[11px] font-black uppercase tracking-widest text-blue-700">{todayLabel.toUpperCase()}</span>
          <h1 className="text-2xl font-black text-slate-900">Olá, {session.name.split(" ")[0]} ✦</h1>
          <p className="text-sm text-slate-500">Aqui está o resumo da operação da CompExatas hoje.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right"><strong className="block text-sm text-slate-900">{session.name}</strong><small className="text-xs text-slate-500">{ROLE_LABEL[session.role] || session.role}</small></div>
          <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0b2265] text-xs font-black text-white">{initials(session.name)}</div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="compex-card p-4"><p className="text-xs text-slate-500">Associados ativos</p><strong className="text-2xl font-black text-slate-900">{stats ? stats.members : "--"}</strong></div>
        {canSeeFinance && <div className="compex-card p-4"><p className="text-xs text-slate-500">Caixa disponível</p><strong className="text-2xl font-black text-slate-900">{stats ? money(stats.balance) : "--"}</strong></div>}
        <div className="compex-card p-4"><p className="text-xs text-slate-500">Eventos publicados</p><strong className="text-2xl font-black text-slate-900">{stats ? String(stats.events).padStart(2, "0") : "--"}</strong></div>
        <div className="compex-card p-4"><p className="text-xs text-slate-500">Atletas cadastrados</p><strong className="text-2xl font-black text-slate-900">{stats ? stats.athletes : "--"}</strong></div>
      </div>

      {session.role === "PRESIDENCIA" && (
        <Panel eyebrow="Só presidência" title="Diretoria & acessos" action={<a href="/gestao/permissoes" className="text-xs font-bold text-blue-700">Gerenciar permissões →</a>}>
          {directors === null && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          {directors !== null && directors.length === 0 && <p className="text-xs text-slate-400">Nenhuma outra conta de diretoria cadastrada.</p>}
          {directors !== null && directors.map((d) => (
            <div key={d.id} className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0"><span><b>{d.name}</b> · {d.email}</span><span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">{ROLE_LABEL[d.role] || d.role}</span></div>
          ))}
        </Panel>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {canSeeFinance && (
          <Panel eyebrow="Financeiro" title="Receitas x despesas" action={
            <select value={monthsWindow} onChange={(e) => setMonthsWindow(Number(e.target.value))} className="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-600">
              <option value={3}>Últimos 3 meses</option><option value={6}>Últimos 6 meses</option><option value={12}>Últimos 12 meses</option>
            </select>
          }>
            {stats ? <FinanceChart months={stats.months.slice(-monthsWindow)} /> : <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          </Panel>
        )}
        <Panel eyebrow="Agenda" title="Próximos eventos" action={<a href="/gestao/eventos" className="text-xs font-bold text-blue-700">Ver todos →</a>}>
          {upcomingEvents.length === 0 && <p className="text-xs text-slate-400">Nenhum evento publicado no momento.</p>}
          {upcomingEvents.map((e) => {
            const date = new Date(e.date);
            const day = String(date.getUTCDate()).padStart(2, "0");
            const month = date.toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" }).replace(".", "").toUpperCase();
            return (
              <div key={e.id} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-slate-50 text-center leading-none"><b className="block text-sm">{day}</b><span className="block text-[9px] text-slate-500">{month}</span></div>
                <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{e.name}</strong><p className="truncate text-xs text-slate-500">{e.type || "Evento"}{e.location ? ` · ${e.location}` : ""}</p></div>
                <span className="shrink-0 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-700">Publicado</span>
              </div>
            );
          })}
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel eyebrow="Gestão" title="Aniversariantes do mês">
          {!extra && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          {extra && extra.birthdays.length === 0 && <p className="text-xs text-slate-400">Nenhum aniversariante este mês.</p>}
          {extra?.birthdays.map((b, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-black text-slate-700">{String(b.day).padStart(2, "0")}</span>
              <div><b className="block text-sm text-slate-900">{b.name}</b><small className="text-xs text-slate-500">{b.role}</small></div>
            </div>
          ))}
        </Panel>
        <Panel eyebrow="Reconhecimento" title="Diretor destaque do mês">
          {!extra && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          {extra && !extra.spotlight && <p className="text-xs text-slate-400">Ainda sem destaque este mês — conclua tarefas para aparecer aqui.</p>}
          {extra?.spotlight && (
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#0b2265] text-xs font-black text-white">{initials(extra.spotlight.name)}</div>
              <div><h3 className="text-sm font-black text-slate-900">{extra.spotlight.name} ✦</h3><p className="text-xs text-slate-500">{extra.spotlight.role ? `${extra.spotlight.role} · ` : ""}{extra.spotlight.count} tarefa{extra.spotlight.count === 1 ? "" : "s"} concluída{extra.spotlight.count === 1 ? "" : "s"} este mês</p></div>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel eyebrow="Esportes" title="Próximos jogos" action={<a href="/gestao/esportes" className="text-xs font-bold text-blue-700">Ver modalidades →</a>}>
          {!extra && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          {extra && extra.upcomingGames.length === 0 && <p className="text-xs text-slate-400">Nenhum jogo agendado.</p>}
          {extra?.upcomingGames.map((g, i) => sessionRow(g, `g${i}`))}
        </Panel>
        <Panel eyebrow="Esportes" title="Próximos treinos" action={<a href="/gestao/esportes" className="text-xs font-bold text-blue-700">Ver modalidades →</a>}>
          {!extra && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          {extra && extra.upcomingTrainings.length === 0 && <p className="text-xs text-slate-400">Nenhum treino agendado.</p>}
          {extra?.upcomingTrainings.map((t, i) => sessionRow(t, `t${i}`))}
        </Panel>
      </div>

      <Panel eyebrow="Diretoria" title="Enquetes para votar" action={<a href="/gestao/documentos" className="text-xs font-bold text-blue-700">Ver todas →</a>}>
        {polls === null && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
        {polls !== null && openPolls.length === 0 && <p className="text-xs text-slate-400">Nenhuma enquete aberta no momento.</p>}
        {openPolls.map((poll) => (
          <div key={poll.id} className="mb-4 border-b border-slate-100 pb-4 last:mb-0 last:border-0">
            <b className="text-sm text-slate-900">{poll.question}</b>
            {poll.expiresAt && <small className="mt-0.5 block text-[11px] text-slate-400">⏱️ Vence dia {new Date(poll.expiresAt).toLocaleDateString("pt-BR")} às {new Date(poll.expiresAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</small>}
            <div className="mt-2 space-y-2">
              {poll.results.map((r, index) => {
                const pct = poll.totalVotes ? Math.round((r.votes / poll.totalVotes) * 100) : 0;
                const voted = poll.myVote === index;
                return (
                  <div key={index}>
                    <div className="flex items-center justify-between text-xs"><span>{r.option}{voted && <b className="ml-1 text-green-600">(Seu voto ✓)</b>}</span><span className="text-slate-500">{r.votes} voto(s) · {pct}%</span></div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${voted ? "bg-green-500" : "bg-blue-600"}`} style={{ width: `${pct}%` }} /></div>
                    <button onClick={() => vote(poll.id, index)} className={`mt-1 rounded-lg px-3 py-1 text-[11px] font-bold ${voted ? "bg-green-50 text-green-700" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{voted ? "✓ Opção votada" : "Votar"}</button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </Panel>

      <Panel eyebrow="Diretoria" title="Demandas do dia" action={<a href="/gestao/tarefas" className="text-xs font-bold text-blue-700">Abrir quadro →</a>}>
        {!extra && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
        {extra && extra.todayTasks.length === 0 && <p className="text-xs text-slate-400">Nenhuma demanda com prazo para hoje.</p>}
        {extra?.todayTasks.map((t) => (
          <div key={t.id} className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0">
            <button onClick={() => completeTask(t.id)} className="h-4 w-4 shrink-0 rounded border border-slate-300 hover:border-blue-600" aria-label="Marcar como concluída" />
            <div><strong className="block text-sm text-slate-900">{t.title}</strong><small className="text-xs text-slate-500">{t.team}{t.owner ? ` · ${t.owner}` : ""}</small></div>
          </div>
        ))}
      </Panel>

      <div className="grid gap-4 sm:grid-cols-2">
        <Panel eyebrow="Equipe" title="Mural de recados" action={<button onClick={() => { setBoardModal("RECADO"); setBoardMessage(""); setBoardError(""); }} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><MessageSquarePlus size={14} /> Recado</button>}>
          {recados === null && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          {recados !== null && recados.length === 0 && <p className="text-xs text-slate-400">Nada por aqui ainda.</p>}
          {recados?.map((p) => <div key={p.id} className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0"><span className="text-blue-600">✉</span><div><strong className="block text-sm text-slate-900">{p.message}</strong><small className="text-xs text-slate-500">{p.authorName} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}</small></div></div>)}
        </Panel>
        <Panel eyebrow="Equipe" title="Mural de elogios" action={<button onClick={() => { setBoardModal("ELOGIO"); setBoardMessage(""); setBoardError(""); }} className="inline-flex items-center gap-1 text-xs font-bold text-blue-700"><Sparkles size={14} /> Elogio</button>}>
          {elogios === null && <LoaderCircle className="h-4 w-4 animate-spin text-slate-400" />}
          {elogios !== null && elogios.length === 0 && <p className="text-xs text-slate-400">Nada por aqui ainda.</p>}
          {elogios?.map((p) => <div key={p.id} className="flex items-start gap-3 border-b border-slate-100 py-2 last:border-0"><span className="text-amber-500">★</span><div><strong className="block text-sm text-slate-900">{p.message}</strong><small className="text-xs text-slate-500">{p.authorName} · {new Date(p.createdAt).toLocaleDateString("pt-BR")}</small></div></div>)}
        </Panel>
      </div>

      {boardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setBoardModal(null); }}>
          <form onSubmit={submitBoard} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">{boardModal === "ELOGIO" ? "Novo elogio" : "Novo recado"}</h2>
            <textarea required rows={4} value={boardMessage} onChange={(e) => setBoardMessage(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            {boardError && <p className="text-xs font-bold text-red-600">{boardError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setBoardModal(null)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={posting} className="rounded-lg bg-[#0b2265] px-4 py-2 text-xs font-bold text-white hover:bg-[#071745] disabled:opacity-60">Publicar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default function GestaoPage() {
  return <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}><GestaoHome /></GestaoGuard>;
}
