"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, UserRound, LogOut } from "lucide-react";
import { useState } from "react";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import { compexApi } from "@/lib/compex-api";

export default function AssociateShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const [open, setOpen] = useState(false);
  const { profile } = useAssociateSession();
  const isAvulso = profile.membershipKind === "AVULSO";
  const active = (href: string) => pathname === href || (href !== "/associado" && pathname.startsWith(`${href}/`)) ? "is-current" : "";
  const logout = async () => {
    try { await compexApi("/auth/logout", { method: "POST" }); } catch { /* a sessão local também será removida */ }
    sessionStorage.removeItem("compex-token");
    sessionStorage.removeItem("compex-session");
    window.location.href = "/login";
  };
  return <div className="associate-shell"><header className="member-topbar"><Link href="/associado" className="brand" onClick={() => setOpen(false)}><img src="/compex-logo.png" alt="CompExatas" /><span>ATLÉTICA<br /><b>COMPUTAÇÃO<br />E EXATAS</b><small>UFU</small></span></Link><nav className={open ? "open" : ""}><Link className={active("/associado")} href="/associado" onClick={() => setOpen(false)}>Início</Link><Link className={active("/associado/agenda")} href="/associado/agenda" onClick={() => setOpen(false)}>Eventos</Link>{isAvulso ? <><Link className={active("/associado/modalidade")} href="/associado/modalidade" onClick={() => setOpen(false)}>Modalidades</Link><Link className={active("/associado/cobrancas")} href="/associado/cobrancas" onClick={() => setOpen(false)}>Cobranças</Link></> : <><Link className={`nav-card-link ${active("/associado/carteirinha")}`} href="/associado/carteirinha" onClick={() => setOpen(false)}>Carteirinha</Link><Link className={active("/associado/gamificacao")} href="/associado/gamificacao" onClick={() => setOpen(false)}>Gamificação</Link><Link className={active("/associado/beneficios")} href="/associado/beneficios" onClick={() => setOpen(false)}>Benefícios</Link></>}<Link className={active("/associado/notificacoes")} href="/associado/notificacoes" onClick={() => setOpen(false)}>Notificações</Link></nav><div className="associate-account-actions"><Link href="/associado/configuracoes" className="profile-link"><UserRound size={17} /> {profile.name} · Minha conta</Link><button type="button" className="exit" onClick={logout}><LogOut size={16} /> Sair</button></div><button className="associate-menu" onClick={() => setOpen(!open)} aria-label="Abrir menu">{open ? <X size={20} /> : <Menu size={20} />}</button></header><main>{children}</main><footer className="associate-footer"><div><Link href="/associado" className="associate-footer-brand"><span>CX</span><b>COMPEXATAS <small>UFU</small></b></Link><p>Seu espaço para viver o esporte, a integração e a universidade.</p></div><nav><b>Minha CompEx</b>{isAvulso ? <><Link href="/associado/modalidade">Modalidades</Link><Link href="/associado/cobrancas">Cobranças</Link></> : <><Link href="/associado/carteirinha">Carteirinha</Link><Link href="/associado/beneficios">Benefícios</Link></>}<Link href="/associado/agenda">Agenda</Link></nav><nav><b>Conta</b><Link href="/associado/configuracoes">Configurações</Link><Link href="/associado/notificacoes">Notificações</Link><Link href="/">Voltar ao site</Link></nav><div className="associate-footer-bottom">Esporte · Integração · Universidade · © {new Date().getFullYear()} CompExatas</div></footer></div>;
}
