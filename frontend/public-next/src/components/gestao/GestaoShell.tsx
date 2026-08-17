"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { compexApi, sessionToken } from "@/lib/compex-api";
import NotificationBell from "./NotificationBell";
import PendencyPopup from "./PendencyPopup";
import "./gestao-shell.css";

const ALL_ROLES = ["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"];

// allow[] espelha o GestaoGuard de cada página em /gestao/*, para que o menu nunca mostre
// um item que vai só redirecionar o usuário de volta ao clicar.
const NAV = [
  { href: "/gestao", icon: "⌂", label: "Início", allow: ALL_ROLES },
  { href: "/gestao/presidencia", icon: "◉", label: "Central da Presidência", allow: ["PRESIDENCIA"] },
  { href: "/gestao/associados", icon: "◎", label: "Associados", allow: ALL_ROLES },
  { href: "/gestao/financeiro", icon: "R$", label: "Financeiro", allow: ["PRESIDENCIA", "FINANCEIRO"] },
  { href: "/gestao/planos", icon: "♛", label: "Planos de Sócio", allow: ["PRESIDENCIA", "FINANCEIRO"] },
  { href: "/gestao/esportes", icon: "⌁", label: "Esportes", allow: ["PRESIDENCIA", "ESPORTES"] },
  { href: "/gestao/campeonatos", icon: "🏆", label: "Campeonatos", allow: ["PRESIDENCIA", "ESPORTES"] },
  { href: "/gestao/escalas", icon: "☰", label: "Escalas", allow: ["PRESIDENCIA", "ESPORTES", "EVENTOS", "MARKETING"] },
  { href: "/gestao/eventos", icon: "◷", label: "Eventos", allow: ["PRESIDENCIA", "EVENTOS", "MARKETING"] },
  { href: "/gestao/patrocinadores", icon: "◈", label: "Patrocinadores", allow: ["PRESIDENCIA", "MARKETING", "EVENTOS"] },
  { href: "/gestao/beneficios", icon: "◇", label: "Benefícios", allow: ["PRESIDENCIA", "MARKETING"] },
  { href: "/gestao/produtos", icon: "⛁", label: "Produtos & Pedidos", allow: ["PRESIDENCIA", "PRODUTOS"] },
  { href: "/gestao/patrimonio", icon: "▨", label: "Patrimônio", allow: ["PRESIDENCIA", "PATRIMONIO", "ESPORTES", "EVENTOS", "FINANCEIRO", "MARKETING"] },
  { href: "/gestao/comunicacao", icon: "✦", label: "Comunicação", allow: ALL_ROLES },
  { href: "/gestao/noticias", icon: "📰", label: "Notícias & Comunicados", allow: ["PRESIDENCIA", "MARKETING"] },
  { href: "/gestao/enquetes", icon: "☑", label: "Enquetes", allow: ALL_ROLES },
  { href: "/gestao/tarefas", icon: "✓", label: "Tarefas", allow: ["PRESIDENCIA", "ESPORTES", "FINANCEIRO", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"] },
  { href: "/gestao/departamentos", icon: "▦", label: "Departamentos", allow: ALL_ROLES },
  { href: "/gestao/solicitacoes", icon: "✉", label: "Solicitações", allow: ALL_ROLES },
  { href: "/gestao/reunioes", icon: "▥", label: "Reuniões e Atas", allow: ALL_ROLES },
  { href: "/gestao/disponibilidade", icon: "◔", label: "Minha Disponibilidade", allow: ALL_ROLES },
  { href: "/gestao/descanso", icon: "☾", label: "Descanso da Gestão", allow: ALL_ROLES },
  { href: "/gestao/desligamento", icon: "⇥", label: "Desligamento", allow: ALL_ROLES },
  { href: "/gestao/documentos", icon: "▤", label: "Documentos", allow: ALL_ROLES },
  { href: "/gestao/checkin", icon: "▣", label: "Check-in", allow: ["PRESIDENCIA", "EVENTOS", "ESPORTES"] },
  { href: "/gestao/metricas", icon: "📊", label: "Métricas", allow: ["PRESIDENCIA"] },
  { href: "/gestao/whatsapp", icon: "💬", label: "Integração WhatsApp", allow: ["PRESIDENCIA"] },
  { href: "/gestao/permissoes", icon: "⚙", label: "Permissões", allow: ["PRESIDENCIA"] },
  { href: "/gestao/auditoria", icon: "▧", label: "Auditoria", allow: ["PRESIDENCIA"] },
  { href: "/gestao/advertencias", icon: "⚠", label: "Advertências", allow: ALL_ROLES },
];

function readRole(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("compex-session");
    return raw ? JSON.parse(raw).role : null;
  } catch {
    return null;
  }
}

export default function GestaoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [role, setRole] = useState<string | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    setRole(readRole());
  }, []);

  const visibleNav = role ? NAV.filter((item) => item.allow.includes(role)) : NAV;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const isActive = (href: string) => href.startsWith("/gestao") && (pathname === href || (href !== "/gestao" && pathname.startsWith(`${href}/`)));

  const logout = async () => {
    try { await compexApi("/auth/logout", { method: "POST" }); } catch {}
    sessionStorage.removeItem("compex-token");
    sessionStorage.removeItem("compex-session");
    window.location.href = "/login";
  };

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setSavingPassword(true);
    setPasswordError("");
    try {
      const token = sessionToken();
      const response = await fetch("/api/backend/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token || ""}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setPasswordError(data.error || "Não foi possível trocar a senha."); return; }
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
    } catch {
      setPasswordError("Erro de conexão.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="gestao-root">
      <aside className="shell-sidebar">
        <Link href="/gestao" className="shell-brand">
          <img src="/compex-logo.png" alt="CompExatas" />
          <span className="shell-brand-text"><strong>COMPEX</strong><span>GESTÃO 2026</span></span>
        </Link>
        <nav className="shell-nav">
          {visibleNav.map((item) => (
            <a key={item.label} href={item.href} className={isActive(item.href) ? "active" : ""}>
              <span className="ic">{item.icon}</span><span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="shell-bottom">
          <NotificationBell />
          <button type="button" onClick={() => setPasswordOpen(true)}><span className="ic"><KeyRound size={14} /></span><span>Trocar senha</span></button>
          <button type="button" onClick={logout}><span className="ic"><LogOut size={14} /></span><span>Sair</span></button>
        </div>
      </aside>

      <main className="shell-main">{children}</main>

      <PendencyPopup />

      {passwordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setPasswordOpen(false); }}>
          <form onSubmit={changePassword} className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl space-y-4">
            <h2 className="text-lg font-black text-slate-900">Trocar senha</h2>
            <p className="text-xs text-slate-500">Sua nova senha precisa ter pelo menos 8 caracteres.</p>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Senha atual</label>
              <input required type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-600">Nova senha</label>
              <input required type="password" minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
            </div>
            {passwordError && <p className="text-xs font-bold text-red-600">{passwordError}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPasswordOpen(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">Cancelar</button>
              <button type="submit" disabled={savingPassword} className="rounded-lg bg-[#0b2265] px-4 py-2 text-xs font-bold text-white hover:bg-[#071745] disabled:opacity-60">Salvar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
