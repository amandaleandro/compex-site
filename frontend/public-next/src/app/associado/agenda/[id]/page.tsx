"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ArrowRight, Bell, CalendarDays, Clock, ExternalLink, LoaderCircle, MapPin, ShieldCheck, Tag } from "lucide-react";
import { compexApi } from "@/lib/compex-api";
import { AgendaEvent, eventCategory, eventDateParts, eventExternalLink } from "../event-data";
import "../agenda.css";

export default function AssociateEventDetailPage() {
  const params = useParams<{ id: string }>();
  const [event, setEvent] = useState<AgendaEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    compexApi<AgendaEvent[]>("/events")
      .then(items => {
        const found = (Array.isArray(items) ? items : []).find(item => item.id === params.id && item.published !== false);
        if (!found) throw new Error("Este evento não foi encontrado ou ainda não está publicado.");
        setEvent(found);
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Não foi possível abrir o evento."))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <section className="agenda-detail-state"><LoaderCircle className="agenda-spin"/><b>Abrindo os detalhes...</b></section>;
  if (error || !event) return <section className="agenda-detail-state"><CalendarDays/><h1>Esse momento não está na agenda.</h1><p>{error}</p><Link href="/associado/agenda"><ArrowLeft size={15}/> Voltar para a agenda</Link></section>;

  const date = eventDateParts(event.date);
  const externalLink = eventExternalLink(event);

  return <div className="agenda-detail-page">
    <Link className="agenda-detail-back" href="/associado/agenda"><ArrowLeft size={16}/> Voltar para a agenda</Link>
    <section className="agenda-detail-hero"><div><p>MINHA COMPEX / {eventCategory(event).toUpperCase()}</p><h1>{event.name}</h1><span>{event.description || "Um encontro preparado para viver a comunidade CompExatas de perto."}</span></div><div className="agenda-detail-date"><strong>{date.day}</strong><b>{date.month}</b><small>{new Date(event.date).getUTCFullYear()}</small></div><img src="/compex-logo.png" alt="" aria-hidden="true"/></section>

    <section className="agenda-detail-grid">
      <article className="agenda-detail-main"><p className="eyebrow">INFORMAÇÕES DO EVENTO</p><h2>Tudo o que você precisa saber</h2><div className="agenda-detail-facts"><span><CalendarDays/><small>DATA</small><b>{date.full}</b></span><span><Clock/><small>HORÁRIO</small><b>{event.time || "A confirmar"}</b></span><span><MapPin/><small>LOCAL</small><b>{event.location || "A confirmar"}</b></span><span><Tag/><small>CATEGORIA</small><b>{event.type || eventCategory(event)}</b></span></div><div className="agenda-detail-description"><h3>Sobre este evento</h3><p>{event.description || "As informações complementares serão divulgadas pela diretoria da CompExatas nos canais oficiais."}</p></div></article>
      <aside className="agenda-detail-aside"><ShieldCheck/><p className="eyebrow">PARTICIPAÇÃO</p><h2>Prepare-se para viver esse momento.</h2><p>Confira data e local, acompanhe os avisos oficiais e leve sua carteirinha quando ela for solicitada.</p>{externalLink ? <a href={externalLink} target="_blank" rel="noreferrer">Acessar inscrição <ExternalLink size={15}/></a> : <Link href="/associado/notificacoes">Receber atualizações <Bell size={15}/></Link>}<Link className="secondary" href="/associado/carteirinha">Abrir carteirinha <ArrowRight size={15}/></Link></aside>
    </section>
  </div>;
}
