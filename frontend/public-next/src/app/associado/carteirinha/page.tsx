"use client";

import Link from "next/link";
import { ArrowLeft, Bell, CalendarDays, CheckCircle2, Gift, Newspaper, Share2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import MembershipGate from "@/components/associate/MembershipGate";
import { courseName } from "@/lib/course-name";
import "./member.css";
import "./card-polish.css";
import "./card-fixes.css";
import "./photo-avatar.css";

export default function CarteirinhaPage() {
  const { profile, subscription } = useAssociateSession();
  const [back, setBack] = useState(false);
  const [copied, setCopied] = useState(false);
  if (profile.membershipKind === "AVULSO") return <MembershipGate feature="A carteirinha digital" />;
  const displayName = profile.socialName || profile.name;
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  const hasWrappedName = displayName.length > 28;
  const profilePhoto = profile.photoUrl?.startsWith("/uploads/") ? `/backend-assets${profile.photoUrl}` : profile.photoUrl;
  const memberLabel = profile.sex === "Masculino" ? "Associado" : "Associada";
  const activeLabel = profile.sex === "Masculino" ? "Ativo" : "Ativa";
  const cardCode = profile.registration ? `CMPX-${profile.registration}` : `CMPX-${profile.id.slice(-8).toUpperCase()}`;
  const validUntil = subscription.currentPeriodEnd
    ? new Intl.DateTimeFormat("pt-BR", { month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(subscription.currentPeriodEnd))
    : "Consulte o plano";
  const memberSince = new Date(profile.createdAt).getUTCFullYear();
  const sport = profile.sports[0] || "Não informada";
  const active = profile.status === "ACTIVE" || subscription.status === "ACTIVE";

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "Carteirinha CompExatas", text: `Carteirinha digital de ${displayName}`, url: window.location.href });
    } else {
      await navigator.clipboard?.writeText(window.location.href);
      setCopied(true);
    }
  };

  return (
    <div className="app-shell">
      <main>
        <section className="card-intro">
          <div>
            <p className="eyebrow">MINHA COMPEX / DOCUMENTO DIGITAL</p>
            <h1>Sua carteirinha,<br /><em>sempre com você.</em></h1>
            <p>Use o QR Code para validar sua associação e acessar os benefícios da comunidade.</p>
          </div>
          <div className="card-intro-status"><CheckCircle2 size={18} /><span><b>Associação {active ? "ativa" : "em análise"}</b><small>Válida até {validUntil}</small></span></div>
        </section>

        <section className="card-stage" aria-label="Carteirinha digital">
          <div id="id-card" className={`id-card ${back ? "is-back" : ""}`}>
            <article className="card-face card-front">
              <div className="card-brand"><img src="/compex-logo.png" alt="CompExatas" /><div className="brand-copy"><strong>CompExatas</strong><span>ASSOCIAÇÃO ATLÉTICA ACADÊMICA<br />COMPUTAÇÃO E EXATAS UFU</span></div></div>
              <div className="card-body"><div className={`avatar ${profilePhoto ? "has-photo" : ""}`}>{profilePhoto ? <img src={profilePhoto} alt={`Foto de perfil de ${displayName}`} /> : initials}</div><div className="person"><p className="card-kicker">{memberLabel.toUpperCase()} COMPEXATAS</p><h2>{displayName}</h2><p>{courseName(profile.course)} · UFU</p><div className="identity"><span>MATRÍCULA<strong>{profile.registration || "Não informada"}</strong></span><span>SEXO<strong>{profile.sex || "Não informado"}</strong></span><span>{memberLabel.toUpperCase()} DESDE<strong>{memberSince}</strong></span></div><div className="identity identity-secondary"><span>MODALIDADE<strong>{sport}</strong></span><span>PLANO CONTRATADO<strong>{subscription.plan || profile.plan}</strong></span></div></div></div>
              <div className={`active ${hasWrappedName ? "after-wrapped-name" : ""}`}><span>✓</span>{memberLabel} {active ? activeLabel : "Em análise"}</div>
              <div className="barcode"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><div><span>{cardCode}</span><span>Válida até {validUntil}</span></div></div>
            </article>
            <article className="card-face card-back"><div className="qr-frame"><img src={`/api/qr?text=${encodeURIComponent(`COMPEX:${profile.id}:${cardCode}`)}&transparent=1&v=6`} alt="QR Code para validar a carteirinha" /></div><p className="card-back-message">É A COMPEX NÉ VIDA</p></article>
          </div>
        </section>

        <div className="flip-actions"><button className="primary" onClick={() => setBack(!back)}>{back && <ArrowLeft size={17} />}{back ? "Voltar para frente" : "Ver QR Code →"}</button><button className="share" onClick={share}><Share2 size={17} /> {copied ? "Link copiado" : "Compartilhar"}</button></div>
        <div className="card-security"><ShieldCheck size={19} /><span><b>Documento digital protegido</b><small>Apresente esta carteirinha somente em canais oficiais da CompExatas.</small></span></div>
        <section className="quick"><p className="quick-kicker">MINHA COMPEX</p><h2>Acesso rápido</h2><div className="quick-grid"><Link href="/associado/agenda"><span className="quick-icon"><CalendarDays size={22} /></span><b>Eventos</b><small>Confira sua agenda</small></Link><Link href="/associado/beneficios"><span className="quick-icon"><Gift size={22} /></span><b>Benefícios</b><small>Veja suas vantagens</small></Link><Link href="/noticias"><span className="quick-icon"><Newspaper size={22} /></span><b>Notícias</b><small>Novidades da atlética</small></Link><Link href="/associado/notificacoes"><span className="quick-icon"><Bell size={22} /></span><b>Notificações</b><small>Acompanhe seus avisos</small></Link></div></section>
      </main>
    </div>
  );
}
