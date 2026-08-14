"use client";

import Link from "next/link";
import { CalendarDays, CheckCircle2, CreditCard, Eye, Gift, LockKeyhole, Mail, ReceiptText, ShieldCheck } from "lucide-react";
import { FormEvent, useState } from "react";
import { compexApi } from "@/lib/compex-api";
import "./login.css";
import "./login-polish.css";

type LoginResponse = { user: { name: string; email: string; role: string }; token: string };

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [entered, setEntered] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setLoading(true); setError("");
    try {
      const result = await compexApi<LoginResponse>("/auth/login", {
        method: "POST", body: JSON.stringify({ email, password }),
      });
      sessionStorage.setItem("compex-token", result.token);
      sessionStorage.setItem("compex-session", JSON.stringify(result.user));
      setEntered(true);
      window.location.href = result.user.role === "ASSOCIADO" ? "/associado" : "/gestao/portal.html";
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível entrar.");
    } finally { setLoading(false); }
  };

  return <div className="login-page">
    <main className="login-layout">
      <section className="welcome"><div className="welcome-content"><div className="welcome-copy"><p className="eyebrow">ÁREA EXCLUSIVA DO ASSOCIADO</p><h1>Sua vida COMPEX,<br /><em>em um só lugar.</em></h1><p>Entre para acessar sua identificação digital, acompanhar eventos e aproveitar tudo que faz parte da sua associação.</p></div><div className="feature-row"><div><b><CreditCard size={18}/></b><span>Carteirinha<br />digital</span></div><div><b><Gift size={18}/></b><span>Benefícios<br />exclusivos</span></div><div><b><CalendarDays size={18}/></b><span>Agenda e<br />inscrições</span></div><div><b><ReceiptText size={18}/></b><span>Plano e<br />pagamentos</span></div></div><div className="welcome-callout"><span><ShieldCheck size={27}/></span><div><b>Seu acesso protegido e conectado à associação</b><small>Os dados exibidos no portal são os dados oficiais do seu cadastro.</small></div><strong>→</strong></div></div><div className="welcome-logo"><img src="/compex-logo.png" alt="Logo CompExatas" /></div></section>
      <section className="login-side">{entered ? <div className="login-card login-success"><CheckCircle2 size={52} /><h2>Acesso liberado</h2><p className="subtitle">Carregando seu portal...</p><Link className="submit success-link" href="/associado">Continuar <b>→</b></Link></div> : <form className="login-card" onSubmit={login}><div className="login-card-mark"><LockKeyhole size={21} /></div><h2>Entre na sua conta</h2><p className="subtitle">Use o e-mail cadastrado na sua associação.</p>{error && <p className="login-error" role="alert">{error}</p>}<label>E-mail<div className="input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" required placeholder="seu@email.com" value={email} onChange={(event) => setEmail(event.target.value)} /></div></label><label>Senha<div className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required placeholder="••••••••" value={password} onChange={(event) => setPassword(event.target.value)} /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}><Eye size={17} /></button></div></label><div className="login-options"><label><input type="checkbox" defaultChecked /> Manter conectado</label><a href="mailto:suporte@compexatas.com.br?subject=Recuperação de senha">Esqueci minha senha</a></div><button className="submit" disabled={loading} type="submit">{loading ? "Validando acesso..." : "Entrar no portal"} <b>→</b></button><div className="or"><span />ou<span /></div><p className="first-access">Ainda não faz parte? <Link href="/cadastro">Criar minha conta →</Link></p><p className="first-access">Faz parte da diretoria? <a href="/login">Acessar gestão →</a></p><div className="support"><ShieldCheck size={21} /><span><strong>Precisa de ajuda para entrar?</strong><br />Fale com a gente em suporte@compexatas.com.br</span></div></form>}</section>
    </main>
  </div>;
}
