"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, BadgeCheck, CalendarDays, Check, ChevronRight,
  CircleDollarSign, Clock, LoaderCircle, ShieldCheck, Trophy, Users, X,
} from "lucide-react";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import { compexApi } from "@/lib/compex-api";
import "./modalidade.css";

type Team = {
  id: string;
  name: string;
  sport: string;
  gender: "MASCULINO" | "FEMININO" | "MISTA";
  description: string | null;
  trainingDay: string | null;
  dropInPriceCents: number | null;
};

type Enrollment = {
  id: string;
  memberId: string;
  teamId: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  team: Team;
};

const statusLabel = { PENDING: "Aguardando aprovação", APPROVED: "Participação aprovada", REJECTED: "Solicitação não aprovada" } as const;
const genderLabel = { MASCULINO: "Masculina", FEMININO: "Feminina", MISTA: "Mista" } as const;

function money(cents: number | null) {
  if (cents === null || cents === undefined) return "Valor informado na convocação";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

export default function ModalidadePage() {
  const { profile, refresh } = useAssociateSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [selected, setSelected] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      const [available, current] = await Promise.all([
        compexApi<Team[]>("/teams"),
        compexApi<Enrollment[]>("/me/enrollments"),
      ]);
      setTeams(Array.isArray(available) ? available : []);
      setEnrollments(Array.isArray(current) ? current : []);
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as modalidades.");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", close); };
  }, [selected]);

  const enrollmentByTeam = useMemo(() => new Map(enrollments.map(item => [item.teamId, item])), [enrollments]);
  const approved = enrollments.filter(item => item.status === "APPROVED");
  const pending = enrollments.filter(item => item.status === "PENDING");

  const enroll = async (team: Team) => {
    setSubmitting(team.id); setMessage(""); setError("");
    try {
      await compexApi(`/teams/${team.id}/enroll`, { method: "POST" });
      await Promise.all([load(), refresh()]);
      setMessage(`Solicitação enviada para ${team.name}. A diretoria fará a aprovação.`);
      setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível solicitar a vaga.");
    } finally { setSubmitting(""); }
  };

  return <div className="sport-page">
    <Link className="sport-back" href="/associado"><ArrowLeft size={16}/> Voltar ao portal</Link>
    <section className="sport-hero"><div><p>MINHA COMPEX / ESPORTES</p><h1>Encontre sua<br/><em>modalidade.</em></h1><span>{profile.membershipKind === "SOCIO" ? "Escolha uma equipe, solicite sua vaga e acompanhe a aprovação da diretoria." : "Escolha uma equipe e participe pagando somente os treinos e jogos confirmados."}</span></div><div className="sport-hero-badge"><Trophy/><b>{approved.length}</b><small>{approved.length === 1 ? "modalidade ativa" : "modalidades ativas"}</small></div><img src="/compex-logo.png" alt="" aria-hidden="true"/></section>

    <section className="sport-flow"><article><span>1</span><div><b>Conheça a equipe</b><small>Veja esporte, categoria e rotina de treinos.</small></div></article><article><span>2</span><div><b>Solicite sua vaga</b><small>A diretoria recebe e analisa o pedido.</small></div></article><article><span>3</span><div><b>Valide sua presença</b><small>No treino, o coordenador lê o QR Code da sua carteirinha.</small></div></article></section>

    {profile.membershipKind === "AVULSO" && <section className="sport-casual-note"><CircleDollarSign/><div><b>Participação avulsa</b><span>Solicitar entrada na equipe não gera cobrança. Você paga individualmente somente quando confirmar presença em um treino ou jogo com valor definido.</span></div><Link href="/associado/cobrancas">Minhas cobranças <ArrowRight size={15}/></Link></section>}

    {message && <div className="sport-message success"><Check size={17}/>{message}</div>}
    {error && <div className="sport-message error"><ShieldCheck size={17}/>{error}</div>}

    {(approved.length > 0 || pending.length > 0) && <section className="sport-current"><div className="sport-section-head"><div><p>MINHAS EQUIPES</p><h2>Acompanhamento</h2></div><Link href="/associado/convocacoes">Ver convocações <ArrowRight size={15}/></Link></div><div className="sport-current-grid">{enrollments.filter(item => item.status !== "REJECTED").map(item => <article key={item.id}><span className={item.status.toLowerCase()}>{item.status === "APPROVED" ? <BadgeCheck/> : <Clock/>}</span><div><small>{item.team.sport} · {genderLabel[item.team.gender]}</small><b>{item.team.name}</b><p>{item.team.trainingDay || "Treinos a confirmar"}</p></div><strong className={item.status.toLowerCase()}>{statusLabel[item.status]}</strong></article>)}</div></section>}

    <section className="sport-catalog"><div className="sport-section-head"><div><p>MODALIDADES DISPONÍVEIS</p><h2>Escolha onde jogar</h2></div><span>{teams.length} {teams.length === 1 ? "equipe" : "equipes"}</span></div>
      {loading && <div className="sport-state"><LoaderCircle className="sport-spin"/><b>Buscando as equipes...</b></div>}
      {!loading && !error && teams.length === 0 && <div className="sport-state"><Trophy/><b>Nenhuma modalidade disponível agora.</b><span>As equipes aparecerão assim que a diretoria abrir as inscrições.</span></div>}
      {!loading && <div className="sport-grid">{teams.map(team => { const enrollment = enrollmentByTeam.get(team.id); return <article key={team.id}><div className="sport-card-top"><span><Trophy/></span><small>{team.sport}</small></div><h3>{team.name}</h3><p>{team.description || "Faça parte da equipe e acompanhe treinos, jogos e convocações."}</p><div className="sport-card-meta"><span><Users/> {genderLabel[team.gender]}</span><span><CalendarDays/> {team.trainingDay || "Horário a confirmar"}</span></div><button type="button" onClick={() => setSelected(team)}><span>{enrollment ? statusLabel[enrollment.status] : "Conhecer modalidade"}</span><ChevronRight size={17}/></button></article>; })}</div>}
    </section>

    {selected && <div className="sport-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="sport-modal" role="dialog" aria-modal="true" aria-labelledby="sport-modal-title"><button className="sport-close" type="button" onClick={() => setSelected(null)} aria-label="Fechar"><X size={20}/></button><div className="sport-modal-icon"><Trophy/></div><p>MODALIDADE / {selected.sport.toUpperCase()}</p><h2 id="sport-modal-title">{selected.name}</h2><span>{selected.description || "Uma equipe CompExatas para treinar, competir e viver o esporte universitário."}</span><div className="sport-modal-info"><div><Users/><small>CATEGORIA</small><b>{genderLabel[selected.gender]}</b></div><div><CalendarDays/><small>TREINOS</small><b>{selected.trainingDay || "A confirmar"}</b></div>{profile.membershipKind === "AVULSO" && <div><CircleDollarSign/><small>VALOR AVULSO</small><b>{money(selected.dropInPriceCents)}</b></div>}</div>{(() => { const enrollment = enrollmentByTeam.get(selected.id); if (enrollment?.status === "APPROVED") return <Link className="sport-modal-action" href="/associado/convocacoes">Participação aprovada · Ver convocações <ArrowRight size={16}/></Link>; if (enrollment?.status === "PENDING") return <button className="sport-modal-action disabled" type="button" disabled><Clock size={16}/> Solicitação aguardando aprovação</button>; return <button className="sport-modal-action" type="button" disabled={submitting === selected.id} onClick={() => void enroll(selected)}>{submitting === selected.id ? <><LoaderCircle className="sport-spin"/> Enviando solicitação...</> : <>{enrollment?.status === "REJECTED" ? "Solicitar nova análise" : "Solicitar vaga na equipe"}<ArrowRight size={16}/></>}</button>; })()}<small><ShieldCheck size={14}/> A solicitação precisa ser aprovada pela diretoria de esportes.</small></section></div>}
  </div>;
}
