"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, CreditCard, Gift, Store, Trophy, Sparkles, CircleDollarSign, Bell, Crown } from "lucide-react";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import { courseName } from "@/lib/course-name";
import { compexApi } from "@/lib/compex-api";
import { AgendaEvent, eventCategory, eventDateParts } from "./agenda/event-data";

const memberShortcuts = [
  ["Carteirinha digital", "Validade e QR Code para acesso", "Ver carteirinha", "/associado/carteirinha", CreditCard],
  ["Próximos eventos", "Competições, treinos e encontros", "Ver agenda", "/associado/agenda", CalendarDays],
  ["Seus benefícios", "Descontos exclusivos de parceiros", "Explorar benefícios", "/associado/beneficios", Gift],
  ["Minha mensalidade", "Status de pagamento e histórico", "Ver mensalidade", "/associado/mensalidade", CreditCard],
  ["Minha modalidade", "Inscreva-se num time e veja seus treinos", "Ver modalidades", "/associado/modalidade", Trophy],
  ["Loja", "Camisas, ingressos e produtos oficiais", "Abrir loja", "/associado/loja", Store],
  ["Indicar amigo", "Compartilhe seu código e convide a galera", "Ver meu código", "/associado/indicar", Sparkles],
  ["Pontos e conquistas", "Acompanhe seu nível e posição na matilha", "Abrir gamificação", "/associado/gamificacao", Crown],
] as const;

const casualShortcuts = [
  ["Próximos eventos", "Competições, treinos e encontros", "Ver agenda", "/associado/agenda", CalendarDays],
  ["Escolher modalidade", "Encontre um time e solicite sua participação", "Ver modalidades", "/associado/modalidade", Trophy],
  ["Minhas cobranças", "Treinos e jogos pagos individualmente", "Acompanhar pagamentos", "/associado/cobrancas", CircleDollarSign],
  ["Loja", "Camisas, ingressos e produtos oficiais", "Abrir loja", "/associado/loja", Store],
  ["Notificações", "Não perca convocações e novidades", "Ver notificações", "/associado/notificacoes", Bell],
] as const;

function dateLabel(value: string | null) {
  if (!value) return "Consulte o plano";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export default function AssociateHome() {
  const { profile, subscription } = useAssociateSession();
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const displayName = profile.socialName || profile.name;
  const greetingName = profile.nickname?.trim()
    || profile.socialName?.trim()
    || profile.name.trim().split(/\s+/).slice(0, 2).join(" ");
  const active = subscription.status === "ACTIVE" || profile.status === "ACTIVE";
  const isAvulso = profile.membershipKind === "AVULSO";
  const shortcuts = isAvulso ? casualShortcuts : memberShortcuts;

  useEffect(() => {
    compexApi<AgendaEvent[]>("/events")
      .then((items) => {
        const now = new Date();
        const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const upcoming = (Array.isArray(items) ? items : [])
          .filter((item) => item.published !== false)
          .filter((item) => new Date(item.date).getTime() >= todayUtc)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
          .slice(0, 2);
        setEvents(upcoming);
      })
      .catch(() => setEvents([]));
  }, []);

  const visibleEvents = useMemo(() => events.map((event) => {
    const date = eventDateParts(event.date);
    const category = eventCategory(event);
    return {
      ...event,
      day: date.day,
      month: date.month,
      summary: `${event.description || event.type || category}${event.time ? ` · ${event.time}` : ""}`,
      location: event.location || "Local a confirmar",
    };
  }), [events]);

  return <>
    <section className="welcome"><div><p className="eyebrow">MINHA COMPEX / {isAvulso ? "PARTICIPAÇÃO AVULSA" : "ÁREA DO ASSOCIADO"}</p><h1>Olá, {greetingName}.<br /><em>Bom ter você aqui.</em></h1><p>{isAvulso ? "Escolha modalidades, acompanhe a agenda e pague somente pelos treinos e jogos dos quais participar." : "Acompanhe sua carteirinha, eventos, benefícios e novidades da comunidade."}</p></div><Link href={isAvulso ? "/associado/modalidade" : "/associado/carteirinha"} className="primary">{isAvulso ? "♜  Escolher modalidade" : "▣  Abrir minha carteirinha"} <b>→</b></Link><div className="hero-mark"><img src="/compex-logo.png" alt="CompExatas" /></div></section>
    <section className="quick-grid">{shortcuts.map(([title, desc, action, href, Icon]) => <Link href={href} key={href}><span className="icon blue"><Icon size={25}/></span><b>{title}</b><small>{desc}</small><strong>{action} →</strong></Link>)}</section>
    <section className="content-grid"><article className="panel"><div className="panel-head"><div><p className="eyebrow">AGENDA</p><h2>Próximos eventos</h2></div><Link href="/associado/agenda">Ver todos →</Link></div>{visibleEvents.length === 0 ? <div className="event"><b>--<small>--</small></b><div><strong>Nenhum evento publicado</strong><span>Assim que a diretoria publicar novos eventos, eles aparecem aqui.</span><small>⌖ Agenda CompExatas</small></div><Link href="/associado/agenda">Detalhes</Link></div> : visibleEvents.map((event) => <div className="event" key={event.id}><b>{event.day}<small>{event.month}</small></b><div><strong>{event.name}</strong><span>◷ {event.summary}</span><small>⌖ {event.location}</small></div><Link href={`/associado/agenda/${event.id}`}>Detalhes</Link></div>)}</article><article className="panel profile-card"><p className="eyebrow">MEU STATUS</p><h2>{isAvulso ? "Participação avulsa" : `Associação ${active ? "ativa" : "em análise"}`}</h2><div className="status"><span>✓</span><div><b>{displayName}</b><small>{courseName(profile.course)} · UFU</small></div></div><div className="meta"><span>Participação<b>{isAvulso ? "Avulsa" : (subscription.plan || profile.plan)}</b></span><span>{isAvulso ? "Mensalidade" : "Válida até"}<b>{isAvulso ? "R$ 0" : dateLabel(subscription.currentPeriodEnd)}</b></span></div><Link href="/associado/configuracoes">Atualizar meus dados →</Link></article></section>
  </>;
}
