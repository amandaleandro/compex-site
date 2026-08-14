"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bell, CalendarDays, CreditCard, LoaderCircle, MapPin } from "lucide-react";
import { compexApi } from "@/lib/compex-api";
import { AgendaEvent, AgendaFilter, eventCategory, eventDateParts } from "./event-data";
import "./agenda.css";

const filters: AgendaFilter[] = ["Todos", "Competições", "Treinos", "Encontros"];

export default function AgendaPage() {
  const [events, setEvents] = useState<AgendaEvent[]>([]);
  const [filter, setFilter] = useState<AgendaFilter>("Todos");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    compexApi<AgendaEvent[]>("/events")
      .then(items => {
        const published = (Array.isArray(items) ? items : []).filter(item => item.published !== false);
        setEvents(published.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setError("");
      })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Não foi possível carregar a agenda."))
      .finally(() => setLoading(false));
  }, []);

  const visibleEvents = useMemo(() => filter === "Todos" ? events : events.filter(event => eventCategory(event) === filter), [events, filter]);

  return <>
    <section className="intro"><div><p className="eyebrow">MINHA COMPEX / AGENDA</p><h1>Viva os próximos<br /><em>momentos.</em></h1><p>Confira os eventos disponíveis para associados, competições, treinos e encontros da comunidade.</p><Link className="intro-action" href="/associado/carteirinha"><CreditCard size={17}/> Abrir minha carteirinha <span>→</span></Link></div></section>

    <section className="toolbar"><div><p className="eyebrow">SUA AGENDA</p><h2>Próximos eventos</h2></div><div className="filters" role="tablist" aria-label="Filtrar eventos">{filters.map(item => <button type="button" role="tab" aria-selected={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></section>

    {loading && <section className="agenda-state"><LoaderCircle className="agenda-spin"/><b>Organizando sua agenda...</b><span>Buscando os eventos cadastrados pela CompExatas.</span></section>}
    {error && <section className="agenda-state"><CalendarDays/><b>A agenda não carregou.</b><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></section>}
    {!loading && !error && visibleEvents.length === 0 && <section className="agenda-state"><CalendarDays/><b>Nenhum evento nesta categoria.</b><span>Novos momentos aparecerão aqui assim que forem publicados.</span></section>}

    {!loading && !error && visibleEvents.length > 0 && <section className="event-list">{visibleEvents.map(event => { const date = eventDateParts(event.date); const category = eventCategory(event); return <article className={`agenda-event ${category === "Treinos" ? "training-row" : ""}`} key={event.id}><strong>{date.day}<small>{date.month}</small></strong><div><em className={category === "Treinos" ? "training" : ""}>{category}</em><b>{event.name}</b><span>{event.description || event.type || "Evento da comunidade CompExatas"}{event.time ? ` · ${event.time}` : ""}</span><small><MapPin size={12}/> {event.location || "Local a confirmar"}</small></div><Link href={`/associado/agenda/${event.id}`}>Ver detalhes <ArrowRight size={15}/></Link></article>; })}</section>}

    <section className="notification-callout"><div className="notification-icon"><Bell size={25}/></div><div className="notification-copy"><b>Quer acompanhar tudo mais rápido?</b><span>Receba notificações dos próximos eventos.</span></div><Link href="/associado/notificacoes">Ativar notificações <ArrowRight size={17}/></Link></section>
  </>;
}
