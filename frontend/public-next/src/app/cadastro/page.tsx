"use client";

import Link from "next/link";
import {
  ArrowRight, CalendarDays, Check, CheckCircle2, CircleDollarSign, Eye, EyeOff,
  Gift, LoaderCircle, LockKeyhole, Mail, ShieldCheck, Sparkles, Trophy, UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { compexApi } from "@/lib/compex-api";
import "./signup.css";

type Participation = "SOCIO" | "AVULSO";

type ApiPlan = { id: string; name: string; priceCents: number; period: string; description: string | null };

const courses = [
  "Ciência da Computação", "Sistemas de Informação", "Inteligência Artificial", "Física",
  "Física Médica", "Física de Materiais", "Matemática", "Estatística", "Química",
  "Química Industrial", "Pós-graduação",
];

type CreatedMember = { id: string; membershipKind: Participation; status: string };

export default function CadastroPage() {
  const [participation, setParticipation] = useState<Participation>("SOCIO");
  const [plans, setPlans] = useState<ApiPlan[]>([]);
  const [planId, setPlanId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isMember = participation === "SOCIO";
  const selectedPlan = plans.find((item) => item.id === planId);

  useEffect(() => {
    compexApi<ApiPlan[]>("/plans").then((data) => {
      setPlans(data);
      if (data.length > 0) setPlanId((current) => current || data[0].id);
    }).catch(() => setPlans([]));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") || "").trim(),
      socialName: String(form.get("socialName") || "").trim() || null,
      nickname: String(form.get("nickname") || "").trim() || null,
      email: String(form.get("email") || "").trim().toLowerCase(),
      password: String(form.get("password") || ""),
      course: String(form.get("course") || ""),
      registration: String(form.get("registration") || "").trim(),
      cpf: String(form.get("cpf") || "").replace(/\D/g, ""),
      sex: String(form.get("sex") || "") || null,
      birthDate: String(form.get("birthDate") || "") || null,
      phone: String(form.get("phone") || "").trim() || null,
      membershipKind: participation,
      planId: isMember ? planId : undefined,
      memberType: "TORCEDOR",
      status: isMember ? "pending" : "active",
    };
    try {
      await compexApi<CreatedMember>("/members", { method: "POST", body: JSON.stringify(payload) });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível concluir seu cadastro.");
    } finally {
      setLoading(false);
    }
  }

  return <div className="signup-page"><main>
    <section className="hero"><div><p className="signup-kicker">SUA COMPEX COMEÇA AQUI</p><h1>Do seu jeito.<br /><em>Dentro da comunidade.</em></h1><p>Crie sua conta para acompanhar a Atlética. Você decide se quer se associar e aproveitar todos os benefícios ou participar de forma avulsa.</p></div><img src="/compex-logo.png" alt="CompExatas" /></section>

    {submitted ? <section className="form-card signup-success">
      <span className="success-icon"><CheckCircle2 size={37}/></span>
      <p className="eyebrow">CADASTRO CONCLUÍDO</p>
      <h2>{isMember ? "Sua solicitação está com a matilha." : "Você já faz parte do sistema."}</h2>
      <p>{isMember
        ? `Recebemos seus dados e a escolha do ${selectedPlan ? selectedPlan.name.toLowerCase() : "plano"}. A equipe da CompExatas vai analisar sua associação e orientar os próximos passos.`
        : "Sua conta avulsa foi criada. Você pode entrar no portal, escolher modalidades e pagar somente pelos treinos e jogos dos quais participar."}</p>
      <div className="success-summary"><Check size={16}/><span>{isMember ? "Aguarde a aprovação para liberar carteirinha e benefícios." : "Sem mensalidade e sem cobrança automática."}</span></div>
      <Link className="primary" href="/login">Entrar no portal <ArrowRight size={16}/></Link>
    </section> : <>
      <section className="signup-progress" aria-label="Etapas do cadastro"><span className="active"><b>1</b>Escolha como participar</span><i/><span><b>2</b>Complete seus dados</span><i/><span><b>3</b>Acesse o portal</span></section>

      <section className="participation-section">
        <div className="section-heading"><div><p className="eyebrow">COMO VOCÊ QUER PARTICIPAR?</p><h2>Escolha sem complicação.</h2></div><p>Sua escolha define os recursos liberados e a forma de cobrança no portal.</p></div>
        <div className="participation-options">
          <label className={`participation-option ${isMember ? "selected" : ""}`}>
            <input type="radio" name="participation" value="SOCIO" checked={isMember} onChange={() => setParticipation("SOCIO")}/>
            <span className="choice-icon"><Sparkles size={24}/></span><span className="choice-copy"><small>EXPERIÊNCIA COMPLETA</small><b>Quero ser associado</b><p>Tenha carteirinha digital, benefícios, descontos e condições especiais nas atividades.</p><strong><Check size={14}/> Melhor para quem participa sempre</strong></span><span className="choice-radio"/>
          </label>
          <label className={`participation-option ${!isMember ? "selected avulso" : ""}`}>
            <input type="radio" name="participation" value="AVULSO" checked={!isMember} onChange={() => setParticipation("AVULSO")}/>
            <span className="choice-icon"><CircleDollarSign size={24}/></span><span className="choice-copy"><small>SEM MENSALIDADE</small><b>Quero participar avulso</b><p>Acesse o sistema sem se associar. Treinos, jogos e atividades são pagos individualmente.</p><strong><Check size={14}/> Pague somente quando participar</strong></span><span className="choice-radio"/>
          </label>
        </div>
      </section>

      <section className="signup-grid">
        <form className="form-card" onSubmit={submit}>
          <div className="card-title"><span><UserRound size={20}/></span><div><p className="eyebrow">SEUS DADOS</p><h2>Vamos criar sua conta.</h2><small>Leva só alguns minutos. Use dados que você reconheça facilmente.</small></div></div>
          <label>Nome completo<div className="field"><UserRound size={15}/><input name="name" required autoComplete="name" placeholder="Como aparece nos seus documentos" /></div></label>
          <div className="two"><label>Nome social <small className="optional">opcional</small><div className="field"><input name="socialName" autoComplete="nickname" placeholder="Como você prefere ser identificado" /></div></label><label>Apelido <small className="optional">opcional</small><div className="field"><input name="nickname" placeholder="Como a galera te chama" /></div></label></div>
          <label>E-mail<div className="field"><Mail size={15}/><input name="email" required type="email" autoComplete="email" placeholder="voce@universidade.br" /></div></label>
          <div className="three"><label>Curso<div className="field"><select name="course" required defaultValue=""><option value="" disabled>Selecione seu curso</option>{courses.map((course) => <option key={course}>{course}</option>)}</select></div></label><label>Matrícula<div className="field"><input name="registration" required inputMode="numeric" placeholder="Ex.: 123456" /></div></label><label>CPF<div className="field"><input name="cpf" required inputMode="numeric" autoComplete="off" maxLength={14} pattern="\d{3}\.?\d{3}\.?\d{3}-?\d{2}" title="Digite um CPF válido" placeholder="000.000.000-00" /></div></label></div>
          <div className="three"><label>Data de nascimento<div className="field"><input name="birthDate" type="date" /></div></label><label>Gênero<div className="field"><select name="sex" defaultValue=""><option value="">Prefiro não informar</option><option>Feminino</option><option>Masculino</option><option>Não binário</option><option>Outro</option></select></div></label><label>Telefone<div className="field"><input name="phone" type="tel" autoComplete="tel" placeholder="(34) 99999-9999" /></div></label></div>
          <label>Crie uma senha<div className="field"><LockKeyhole size={15}/><input name="password" required minLength={8} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Mínimo de 8 caracteres" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>{showPassword ? <EyeOff size={15}/> : <Eye size={15}/>}</button></div><small className="field-hint">Use pelo menos 8 caracteres. Evite matrícula, nome ou data de nascimento.</small></label>
          <label className="check"><input required type="checkbox" /> Li e aceito os <Link href="/sobre">termos de uso e privacidade.</Link></label>
          {error && <div className="form-error" role="alert">{error}</div>}
          <button className="primary" type="submit" disabled={loading}>{loading ? <><LoaderCircle className="spin" size={16}/> Criando sua conta...</> : <>{isMember ? "Enviar solicitação de associação" : "Criar minha conta avulsa"}<ArrowRight size={16}/></>}</button>
          <div className="or"><span />ou<span /></div><p className="login-note">Já possui uma conta? <Link href="/login">Entrar no portal →</Link></p>
          <div className="safe"><ShieldCheck size={19}/><span><strong>Seus dados ficam protegidos</strong><small>Nome, CPF e matrícula são usados somente para validar sua identidade e operar o portal.</small></span></div>
        </form>

        <aside className={`plans ${!isMember ? "avulso-panel" : ""}`}>
          {isMember ? <>
            <div className="plans-title"><span>✦</span><div><p className="eyebrow">PLANOS COMPEX</p><h2>Escolha seu plano.</h2></div></div>
            {plans.length === 0 && <p className="field-hint">Nenhum plano disponível no momento.</p>}
            {plans.map((item) => <label className={`plan ${planId === item.id ? "selected" : ""}`} key={item.id}><input type="radio" name="plan" checked={planId === item.id} onChange={() => setPlanId(item.id)} /><span className="plan-icon">{planId === item.id ? "☆" : "◇"}</span><span className="plan-copy"><b>{item.name}</b><small>{item.description}</small></span><strong>{(item.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}<small>{item.period}</small></strong></label>)}
            <div className="included"><h3>O que sua associação libera</h3><span><Check size={13}/> Carteirinha digital com QR Code</span><span><Check size={13}/> Condições especiais em treinos</span><span><Check size={13}/> Benefícios dos parceiros</span><span><Check size={13}/> Descontos e experiências exclusivas</span></div>
            <div className="plan-features"><span>▣<small>Carteirinha</small></span><span>♧<small>Benefícios</small></span><span>◇<small>Eventos</small></span><span>♙<small>Comunidade</small></span></div>
          </> : <>
            <div className="plans-title"><span><CircleDollarSign size={21}/></span><div><p className="eyebrow">PARTICIPAÇÃO AVULSA</p><h2>Liberdade para escolher.</h2></div></div>
            <p className="avulso-intro">Você entra na comunidade e acompanha as oportunidades, mas só paga quando decidir participar de uma atividade.</p>
            <div className="avulso-list">
              <span><CalendarDays size={19}/><span><b>Agenda e eventos</b><small>Acompanhe datas, jogos e treinos disponíveis.</small></span></span>
              <span><Trophy size={19}/><span><b>Modalidades esportivas</b><small>Solicite participação nos times da CompExatas.</small></span></span>
              <span><CircleDollarSign size={19}/><span><b>Cobranças transparentes</b><small>Cada treino ou jogo gera sua própria cobrança avulsa.</small></span></span>
            </div>
            <div className="not-included"><h3>Importante saber</h3><p><Gift size={16}/> A conta avulsa não inclui carteirinha de associado, benefícios de parceiros nem descontos exclusivos.</p><p><ShieldCheck size={16}/> Não há mensalidade, fidelidade ou cobrança automática.</p></div>
            <div className="avulso-price"><small>MENSALIDADE</small><b>R$ 0</b><span>atividades cobradas à parte</span></div>
          </>}
        </aside>
      </section>
    </>}
  </main></div>;
}
