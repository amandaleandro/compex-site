"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { KeyRound, LogOut } from "lucide-react";
import { compexApi, sessionToken } from "@/lib/compex-api";
import "./gestao-shell.css";

const NAV = [
  { href: "/gestao", icon: "⌂", label: "Início" },
  { href: "/gestao/associados", icon: "◎", label: "Associados" },
  { href: "/gestao/financeiro", icon: "R$", label: "Financeiro" },
  { href: "/gestao/esportes", icon: "⌁", label: "Esportes" },
  { href: "/gestao/campeonatos", icon: "🏆", label: "Campeonatos" },
  { href: "/gestao/eventos", icon: "◷", label: "Eventos" },
  { href: "/gestao/patrocinadores", icon: "◈", label: "Patrocinadores" },
  { href: "/gestao/beneficios", icon: "◇", label: "Benefícios" },
  { href: "/gestao/produtos", icon: "⛁", label: "Produtos & Pedidos" },
  { href: "/gestao/patrimonio", icon: "▨", label: "Patrimônio" },
  { href: "/gestao/comunicacao", icon: "✦", label: "Comunicação" },
  { href: "/gestao/tarefas", icon: "✓", label: "Tarefas" },
  { href: "/gestao/documentos", icon: "▤", label: "Documentos" },
  { href: "/gestao/checkin", icon: "▣", label: "Check-in" },
  { href: "/gestao/permissoes", icon: "⚙", label: "Permissões" },
  { href: "/gestao/advertencias", icon: "⚠", label: "Advertências" },
];

export default function GestaoShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [passwordOpen, setPasswordOpen] = useState(false);
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
          {NAV.map((item) => (
            <a key={item.label} href={item.href} className={isActive(item.href) ? "active" : ""}>
              <span className="ic">{item.icon}</span><span>{item.label}</span>
            </a>
          ))}
        </nav>
        <div className="shell-bottom">
          <button type="button" onClick={() => setPasswordOpen(true)}><span className="ic"><KeyRound size={14} /></span><span>Trocar senha</span></button>
          <button type="button" onClick={logout}><span className="ic"><LogOut size={14} /></span><span>Sair</span></button>
        </div>
      </aside>

      <main className="shell-main">{children}</main>

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
