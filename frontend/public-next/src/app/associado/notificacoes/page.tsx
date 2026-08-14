"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, ArrowRight, Bell, CalendarDays, Check, CheckCheck, CircleDollarSign,
  Clock, Gift, LoaderCircle, Settings, ShoppingBag, Trophy, Users,
} from "lucide-react";
import { compexApi } from "@/lib/compex-api";
import "./notifications.css";

type Notification = {
  id: string;
  type: "MODALIDADE" | "CONVOCACAO" | "COBRANCA" | "PEDIDO" | "EVENTO";
  title: string;
  message: string;
  href: string;
  status: string;
  createdAt: string;
  read: boolean;
};

const icons = { MODALIDADE: Trophy, CONVOCACAO: Users, COBRANCA: CircleDollarSign, PEDIDO: ShoppingBag, EVENTO: CalendarDays };
const typeLabel = { MODALIDADE: "Modalidade", CONVOCACAO: "Convocação", COBRANCA: "Pagamento", PEDIDO: "Loja", EVENTO: "Evento" };

function relativeDate(value: string) {
  const difference = new Date(value).getTime() - Date.now();
  const minutes = Math.round(difference / 60000);
  if (Math.abs(minutes) < 60) return new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(hours, "hour");
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" }).format(days, "day");
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default function NotificacoesPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    compexApi<Notification[]>("/me/notifications")
      .then(items => { setNotifications(Array.isArray(items) ? items : []); setError(""); })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Não foi possível carregar os avisos."))
      .finally(() => setLoading(false));
  }, []);

  const unread = notifications.filter(item => !item.read);
  const visible = useMemo(() => filter === "unread" ? notifications.filter(item => !item.read) : notifications, [filter, notifications]);

  const markRead = async (ids: string[]) => {
    if (!ids.length) return;
    const previous = notifications;
    setNotifications(current => current.map(item => ids.includes(item.id) ? { ...item, read: true } : item));
    try { await compexApi("/me/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }); }
    catch (reason) { setNotifications(previous); setError(reason instanceof Error ? reason.message : "Não foi possível atualizar os avisos."); }
  };

  const markAll = async () => {
    setSaving(true);
    await markRead(unread.map(item => item.id));
    setSaving(false);
  };

  return <div className="notice-page">
    <Link className="notice-back" href="/associado"><ArrowLeft size={16}/> Voltar ao portal</Link>
    <section className="notice-hero"><div><p>MINHA COMPEX / CENTRAL DE AVISOS</p><h1>Nada passa<br/><em>batido.</em></h1><span>Acompanhe atualizações de eventos, equipes, convocações, pagamentos e pedidos em um só lugar.</span></div><div className="notice-counter"><Bell/><strong>{unread.length}</strong><small>{unread.length === 1 ? "aviso não lido" : "avisos não lidos"}</small></div><img src="/compex-logo.png" alt="" aria-hidden="true"/></section>

    <section className="notice-toolbar"><div className="notice-filters"><button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Todos <span>{notifications.length}</span></button><button type="button" className={filter === "unread" ? "active" : ""} onClick={() => setFilter("unread")}>Não lidos <span>{unread.length}</span></button></div><div><button type="button" disabled={!unread.length || saving} onClick={() => void markAll()}>{saving ? <LoaderCircle className="notice-spin"/> : <CheckCheck/>} Marcar todas como lidas</button><Link href="/associado/configuracoes?aba=notificacoes"><Settings/> Preferências</Link></div></section>

    {error && <div className="notice-error">{error}<button type="button" onClick={() => setError("")}>Fechar</button></div>}
    {loading && <section className="notice-state"><LoaderCircle className="notice-spin"/><b>Buscando seus avisos...</b><span>Organizando as atualizações da sua conta.</span></section>}
    {!loading && notifications.length === 0 && <section className="notice-state"><Bell/><b>Sua central está tranquila.</b><span>Quando houver uma atualização real, ela aparecerá aqui.</span><Link href="/associado/agenda">Ver próximos eventos <ArrowRight size={15}/></Link></section>}
    {!loading && notifications.length > 0 && visible.length === 0 && <section className="notice-state"><CheckCheck/><b>Tudo em dia por aqui.</b><span>Você já leu todos os avisos.</span><button type="button" onClick={() => setFilter("all")}>Ver todos</button></section>}

    {!loading && visible.length > 0 && <section className="notice-list">{visible.map(item => { const Icon = icons[item.type] || Gift; return <article className={item.read ? "read" : "unread"} key={item.id}><div className={`notice-icon ${item.type.toLowerCase()}`}><Icon/></div><div className="notice-copy"><div><span>{typeLabel[item.type]}</span>{!item.read && <i>NOVO</i>}<time><Clock size={12}/>{relativeDate(item.createdAt)}</time></div><h2>{item.title}</h2><p>{item.message}</p><Link href={item.href} onClick={() => { if (!item.read) void markRead([item.id]); }}>Abrir detalhes <ArrowRight size={14}/></Link></div>{item.read ? <span className="notice-read"><Check size={14}/> Lida</span> : <button className="notice-mark" type="button" onClick={() => void markRead([item.id])}><Check size={15}/> Marcar como lida</button>}</article>; })}</section>}
  </div>;
}
