"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity, BookOpenText, CalendarCheck, Check, ChevronRight, CircleDollarSign, Crown, Flame,
  History, LoaderCircle, Medal, ShoppingBag, Sparkles, Star, Trophy, Users,
} from "lucide-react";
import MembershipGate from "@/components/associate/MembershipGate";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import { compexApi } from "@/lib/compex-api";
import { courseName } from "@/lib/course-name";
import "./gamification.css";

type GamificationData = {
  total: number;
  position: number | null;
  level: string;
  nextLevel: string | null;
  nextLevelAt: number | null;
  progress: number;
  history: Array<{ id: string; label: string; points: number; note: string | null; createdAt: string }>;
  ranking: Array<{ position: number; name: string; course: string; points: number; level: string; isCurrent: boolean }>;
  achievements: Array<{ id: string; name: string; description: string; unlocked: boolean }>;
};

const rules = [
  { title: "Check-in em evento", points: "+80", description: "Faça o check-in oficial com sua carteirinha.", icon: CalendarCheck, automatic: true },
  { title: "Mensalidade em dia", points: "+100", description: "Crédito mensal após a confirmação do pagamento.", icon: CircleDollarSign, automatic: true },
  { title: "Compra na loja", points: "1 por R$", description: "Mínimo de 20 pontos por pedido aprovado.", icon: ShoppingBag, automatic: true },
  { title: "Presença em treino", points: "+50", description: "O coordenador lê o QR Code da sua carteirinha no treino.", icon: Activity, automatic: true },
  { title: "Ações da comunidade", points: "Variável", description: "Campanhas e desafios divulgados pela CompExatas.", icon: Sparkles, automatic: false },
];

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function AssociateGamificacao() {
  const { profile } = useAssociateSession();
  const [tab, setTab] = useState<"overview" | "ranking" | "rules">("overview");
  const [data, setData] = useState<GamificationData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile.membershipKind !== "SOCIO") return;
    compexApi<GamificationData>("/me/gamification")
      .then(setData)
      .catch(reason => setError(reason instanceof Error ? reason.message : "Não foi possível carregar seus pontos."));
  }, [profile.membershipKind]);

  if (profile.membershipKind !== "SOCIO") return <MembershipGate feature="A gamificação" />;
  if (error) return <section className="game-state"><Trophy size={34}/><h1>Seus pontos estão no intervalo.</h1><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></section>;
  if (!data) return <section className="game-state"><LoaderCircle className="game-spin" size={34}/><h1>Montando seu placar...</h1><p>Buscando pontos, nível e conquistas.</p></section>;

  const pointsToNext = data.nextLevelAt ? Math.max(0, data.nextLevelAt - data.total) : 0;

  return <div className="game-page">
    <section className="game-hero">
      <div className="game-hero-copy"><p className="game-kicker">MINHA COMPEX / GAMIFICAÇÃO</p><h1>Viva a comunidade.<br/><em>Conquiste seu lugar.</em></h1><p>Seu envolvimento vira pontos, níveis e conquistas. O placar usa somente atividades confirmadas pela CompExatas.</p></div>
      <div className="game-score"><span><Flame size={18}/> SALDO ATUAL</span><strong>{data.total.toLocaleString("pt-BR")}<small>PTS</small></strong><p><Medal size={16}/> {data.level}</p></div>
      <img src="/compex-logo.png" alt="CompExatas" />
    </section>

    <section className="game-progress">
      <div><span>NÍVEL ATUAL</span><b>{data.level}</b></div>
      <div className="game-progress-track"><i style={{ width: `${data.progress}%` }}/></div>
      <p>{data.nextLevel ? <><strong>{pointsToNext} pontos</strong> para chegar a {data.nextLevel}</> : <><Crown size={15}/> Você alcançou o nível máximo</>}</p>
    </section>

    <nav className="game-tabs" aria-label="Seções da gamificação">
      <button className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><Star size={16}/> Meu placar</button>
      <button className={tab === "ranking" ? "active" : ""} onClick={() => setTab("ranking")}><Users size={16}/> Ranking</button>
      <button className={tab === "rules" ? "active" : ""} onClick={() => setTab("rules")}><Sparkles size={16}/> Como pontuar</button>
      <Link className="game-regulation-link" href="/associado/gamificacao/regulamento"><BookOpenText size={16}/> Regulamento completo</Link>
    </nav>

    {tab === "overview" && <>
      <section className="game-stats"><article><Trophy/><span>Posição no ranking<b>{data.position ? `#${data.position}` : "—"}</b></span></article><article><Flame/><span>Pontos acumulados<b>{data.total.toLocaleString("pt-BR")}</b></span></article><article><Medal/><span>Conquistas liberadas<b>{data.achievements.filter(item => item.unlocked).length}/{data.achievements.length}</b></span></article></section>
      <section className="game-content-grid">
        <article className="game-panel"><div className="game-panel-head"><div><p className="game-kicker">MOVIMENTAÇÕES</p><h2>Histórico de pontos</h2></div><History size={22}/></div>{data.history.length ? <div className="game-history">{data.history.map(item => <div key={item.id}><span className={item.points >= 0 ? "positive" : "negative"}>{item.points > 0 ? "+" : ""}{item.points}</span><div><b>{item.label}</b><small>{item.note || "Registro confirmado pela CompExatas"}</small></div><time>{dateLabel(item.createdAt)}</time></div>)}</div> : <div className="game-empty"><Star size={25}/><b>Seu placar começa agora.</b><p>Quando uma atividade elegível for confirmada, ela aparecerá aqui.</p></div>}</article>
        <article className="game-panel"><div className="game-panel-head"><div><p className="game-kicker">COLEÇÃO</p><h2>Conquistas</h2></div><Medal size={22}/></div><div className="game-achievements">{data.achievements.map(item => <div className={item.unlocked ? "unlocked" : ""} key={item.id}><span>{item.unlocked ? <Check size={17}/> : <Trophy size={17}/>}</span><div><b>{item.name}</b><small>{item.description}</small></div></div>)}</div></article>
      </section>
    </>}

    {tab === "ranking" && <section className="game-panel game-ranking"><div className="game-panel-head"><div><p className="game-kicker">TEMPORADA ATUAL</p><h2>Ranking da matilha</h2><small>Exclusivo para sócios com pontos confirmados.</small></div><Trophy size={23}/></div>{data.ranking.length ? <div className="game-ranking-list">{data.ranking.map(item => <article className={item.isCurrent ? "current" : ""} key={`${item.position}-${item.name}`}><strong>{item.position <= 3 ? ["🥇","🥈","🥉"][item.position - 1] : `#${item.position}`}</strong><div><b>{item.name}{item.isCurrent && <em>VOCÊ</em>}</b><small>{courseName(item.course)} · {item.level}</small></div><span>{item.points.toLocaleString("pt-BR")} <small>PTS</small></span></article>)}</div> : <div className="game-empty"><Users size={26}/><b>O ranking ainda está aberto.</b><p>Os primeiros pontos confirmados inauguram a temporada.</p></div>}</section>}

    {tab === "rules" && <section className="game-rules">{rules.map(({title, points, description, icon: Icon, automatic}) => <article key={title}><div><Icon size={22}/></div><span className="game-rule-points">{points} PTS</span><h3>{title}</h3><p>{description}</p><small>{automatic ? <><Check size={13}/> Crédito automático</> : <><ChevronRight size={13}/> Confirmação da diretoria</>}</small></article>)}</section>}
  </div>;
}
