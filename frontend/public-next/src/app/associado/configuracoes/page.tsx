"use client";

import Link from "next/link";
import {
  Bell, Camera, CheckCircle2, ChevronRight, CreditCard, Download, Laptop,
  LockKeyhole, LogOut, Save, ShieldCheck, Smartphone, Trash2, UserRound,
} from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { compexApi, sessionToken } from "@/lib/compex-api";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import { courseName } from "@/lib/course-name";
import "./settings.css";
import "./settings-extra.css";

type Tab = "perfil" | "notificacoes" | "seguranca" | "privacidade" | "conta";
type Preferences = {
  comunicados: boolean; eventos: boolean; beneficios: boolean; email: boolean;
  whatsapp: boolean; push: boolean; equipes: boolean; presenca: boolean;
};
type Profile = {
  id: string; name: string; email: string; course: string; registration: string | null;
  cpf: string | null; socialName: string | null; nickname: string | null;
  instagram: string | null; phone: string | null; birthDate: string | null; sex: string | null;
  shift: string | null; photoUrl: string | null; sports: string[]; preferences: Partial<Preferences> | null;
  plan: string; status: string; createdAt: string;
};
type Subscription = { plan: string; status: string; subscriptionStatus: string | null; currentPeriodEnd: string | null };

const defaultPreferences: Preferences = {
  comunicados: true, eventos: true, beneficios: false, email: true,
  whatsapp: true, push: false, equipes: true, presenca: false,
};
const emptyProfile: Profile = {
  id: "", name: "", email: "", course: "Ciência da Computação", registration: "",
  cpf: "", socialName: "", nickname: "",
  instagram: "", phone: "", birthDate: "", sex: "", shift: "Integral", photoUrl: null,
  sports: ["Futsal"], preferences: null, plan: "", status: "", createdAt: "",
};
const courses = [
  "Sistemas de Informação", "Física Médica", "Química Industrial", "Química", "Matemática",
  "Estatística", "Física", "Inteligência Artificial", "Ciência da Computação",
  "Física de Materiais", "Pós-graduação",
];
const tabs = [
  { id: "perfil" as const, label: "Perfil", icon: UserRound },
  { id: "notificacoes" as const, label: "Notificações", icon: Bell },
  { id: "seguranca" as const, label: "Segurança", icon: LockKeyhole },
  { id: "privacidade" as const, label: "Privacidade", icon: ShieldCheck },
  { id: "conta" as const, label: "Conta e plano", icon: CreditCard },
];

function Toggle({ checked, onChange, label, disabled = false }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean }) {
  return <button className={`settings-toggle ${checked ? "is-on" : ""}`} disabled={disabled} type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange}><span /></button>;
}

function assetUrl(value: string | null) {
  if (!value) return null;
  if (value.startsWith("/uploads/")) return `/backend-assets${value}`;
  return value;
}

function formatDate(value: string | null, fallback = "Não informada") {
  if (!value) return fallback;
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value));
}

export default function ConfiguracoesPage() {
  const { refresh } = useAssociateSession();
  const [tab, setTab] = useState<Tab>("perfil");
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("aba");
    if (tabs.some(item => item.id === requested)) setTab(requested as Tab);
  }, []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!sessionToken()) {
      setError("Entre na sua conta para carregar e alterar as configurações.");
      setLoading(false);
      return;
    }
    Promise.all([compexApi<Profile>("/me/profile"), compexApi<Subscription>("/me/subscription")])
      .then(([member, plan]) => {
        setProfile({ ...emptyProfile, ...member, course: courseName(member.course), birthDate: member.birthDate?.slice(0, 10) || "", sports: member.sports || [] });
        setPhoto(assetUrl(member.photoUrl));
        setPreferences({ ...defaultPreferences, ...(member.preferences || {}) });
        setSubscription(plan);
      })
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const flash = (value: string) => {
    setMessage(value);
    window.setTimeout(() => setMessage(""), 3500);
  };
  const toggle = (key: keyof Preferences) => setPreferences((current) => ({ ...current, [key]: !current[key] }));
  const field = (key: keyof Profile, value: string) => setProfile((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true); setError("");
    try {
      await compexApi("/me/profile", {
        method: "PUT",
        body: JSON.stringify({
          name: profile.name, socialName: profile.socialName, nickname: profile.nickname,
          email: profile.email, course: profile.course, cpf: profile.cpf,
          registration: profile.registration, instagram: profile.instagram, phone: profile.phone,
          birthDate: profile.birthDate || null, sex: profile.sex, shift: profile.shift,
          sports: profile.sports, preferences,
        }),
      });
      await refresh();
      flash("Alterações salvas no seu perfil.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível salvar."); }
    finally { setSaving(false); }
  };

  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setPhoto(preview); setError("");
    const data = new FormData(); data.append("photo", file);
    try {
      const result = await compexApi<{ url: string }>("/me/photo", { method: "POST", body: data });
      setPhoto(assetUrl(result.url));
      await refresh();
      flash("Foto atualizada com sucesso e aplicada à carteirinha.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível enviar a foto."); }
    finally { URL.revokeObjectURL(preview); }
  };

  const updatePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setError("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (newPassword !== confirmation) { setError("A confirmação não corresponde à nova senha."); return; }
    try {
      await compexApi("/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword, newPassword }) });
      event.currentTarget.reset(); flash("Senha atualizada com sucesso.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a senha."); }
  };

  const logout = async () => {
    try { await compexApi("/auth/logout", { method: "POST" }); } catch { /* limpa a sessão local mesmo se o servidor estiver indisponível */ }
    sessionStorage.removeItem("compex-token"); sessionStorage.removeItem("compex-session");
    window.location.href = "/login";
  };

  const downloadData = () => {
    const blob = new Blob([JSON.stringify({ profile, preferences, subscription }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const link = document.createElement("a");
    link.href = url; link.download = "meus-dados-compex.json"; link.click(); URL.revokeObjectURL(url);
  };

  const preferredName = profile.nickname?.trim()
    || profile.socialName?.trim()
    || profile.name.trim().split(/\s+/).slice(0, 2).join(" ");
  const memberSinceLabel = /^masculino$/i.test(profile.sex || "")
    ? "Associado"
    : /^feminino$/i.test(profile.sex || "") ? "Associada" : "Pessoa associada";

  if (loading) return <div className="settings-page"><section className="settings-panel"><p>Carregando suas configurações...</p></section></div>;
  if (!sessionToken() || (error && !profile.id)) return <div className="settings-page"><section className="settings-panel"><h2>Configurações da conta</h2><p className="settings-description">{error || "Entre na sua conta para continuar."}</p><Link className="settings-save" href="/login">Entrar novamente</Link></section></div>;

  return <div className="settings-page">
    <section className="settings-hero">
      <div><p className="settings-eyebrow">MINHA COMPEX / CONTA</p><h1>Seu espaço,<br /><em>do seu jeito.</em></h1><p>Atualize seus dados, sua segurança e as preferências da conta.</p></div>
      <button className="settings-save" disabled={saving} type="button" onClick={save}><Save size={17} /> {saving ? "Salvando..." : "Salvar alterações"}</button>
    </section>

    {message && <div className="settings-feedback" role="status"><CheckCircle2 size={17} />{message}</div>}
    {error && <div className="settings-feedback" role="alert">{error}</div>}

    <section className="settings-layout">
      <nav className="settings-tabs" aria-label="Configurações da conta"><p>CONFIGURAÇÕES</p>{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "is-active" : ""} type="button" onClick={() => setTab(id)}><Icon size={17} /><span>{label}</span><ChevronRight size={15} /></button>)}</nav>
      <div className="settings-content">
        {tab === "perfil" && <section className="settings-panel">
          <div className="settings-panel-head"><div><p className="settings-eyebrow">INFORMAÇÕES PESSOAIS</p><h2>Perfil</h2></div><span className="settings-active"><i /> Associação {profile.status === "ACTIVE" ? "ativa" : profile.status?.toLowerCase()}</span></div>
          <div className="settings-profile"><div className="settings-photo" style={photo ? { backgroundImage: `url(${photo})` } : undefined}>{!photo && (preferredName ? preferredName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("") : "CX")}<label title="Alterar foto"><Camera size={15} /><input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => uploadPhoto(event.target.files?.[0])} /></label></div><div className="settings-profile-copy"><b title={profile.name}>{preferredName}</b><small>{courseName(profile.course)} · UFU</small><span>{memberSinceLabel} desde {formatDate(profile.createdAt)}</span></div></div>
          <form className="settings-form" onSubmit={(event) => { event.preventDefault(); save(); }}>
            <label>Nome completo<input value={profile.name} onChange={(e) => field("name", e.target.value)} required /></label>
            <label>Nome social<input value={profile.socialName || ""} onChange={(e) => field("socialName", e.target.value)} placeholder="Como você prefere ser identificado" /></label>
            <label>Apelido<input value={profile.nickname || ""} onChange={(e) => field("nickname", e.target.value)} placeholder="Como a galera te chama" /></label>
            <label>E-mail<input type="email" value={profile.email} onChange={(e) => field("email", e.target.value)} required /></label>
            <label>Curso<select value={profile.course} onChange={(e) => field("course", e.target.value)}>{courses.map((course) => <option key={course}>{course}</option>)}</select></label>
            <label>Matrícula<input value={profile.registration || ""} onChange={(e) => field("registration", e.target.value)} /></label>
            <label>CPF<input inputMode="numeric" maxLength={14} value={profile.cpf || ""} onChange={(e) => field("cpf", e.target.value)} placeholder="000.000.000-00" /></label>
            <label>Instagram<input value={profile.instagram || ""} onChange={(e) => field("instagram", e.target.value)} placeholder="@seuusuario" /></label>
            <label>Telefone<input value={profile.phone || ""} onChange={(e) => field("phone", e.target.value)} placeholder="(34) 99999-9999" /></label>
            <label>Data de nascimento<input type="date" value={profile.birthDate || ""} onChange={(e) => field("birthDate", e.target.value)} /></label>
            <label>Sexo<select value={profile.sex || ""} onChange={(e) => field("sex", e.target.value)}><option value="">Selecione</option><option>Feminino</option><option>Masculino</option><option>Não binário</option><option>Prefiro não informar</option></select></label>
            <label>Modalidade preferida<select value={profile.sports[0] || "Nenhuma"} onChange={(e) => setProfile((current) => ({ ...current, sports: e.target.value === "Nenhuma" ? [] : [e.target.value] }))}><option>Futsal</option><option>Vôlei</option><option>Handebol</option><option>Basquete</option><option>Peteca</option><option>Nenhuma</option></select></label>
            <label>Turno<select value={profile.shift || ""} onChange={(e) => field("shift", e.target.value)}><option value="">Selecione</option><option>Integral</option><option>Matutino</option><option>Noturno</option></select></label>
            <button className="settings-mobile-save" disabled={saving} type="submit"><Save size={16} /> Salvar perfil</button>
          </form>
        </section>}

        {tab === "notificacoes" && <section className="settings-panel"><div className="settings-panel-head"><div><p className="settings-eyebrow">PREFERÊNCIAS</p><h2>Notificações</h2></div><Bell size={23} /></div><p className="settings-description">Escolha quais novidades você deseja receber. As opções são salvas no seu perfil.</p><div className="settings-options">
          <div><span><b>Comunicados da COMPEX</b><small>Informações importantes da diretoria</small></span><Toggle checked={preferences.comunicados} onChange={() => toggle("comunicados")} label="Comunicados da COMPEX" /></div>
          <div><span><b>Eventos e festas</b><small>Novidades, datas e lembretes</small></span><Toggle checked={preferences.eventos} onChange={() => toggle("eventos")} label="Eventos e festas" /></div>
          <div><span><b>Oportunidades e benefícios</b><small>Descontos e parceiros da atlética</small></span><Toggle checked={preferences.beneficios} onChange={() => toggle("beneficios")} label="Oportunidades e benefícios" /></div>
        </div><h3 className="settings-subtitle">Canais de recebimento</h3><div className="settings-channel-grid"><button className={preferences.email ? "is-selected" : ""} type="button" onClick={() => toggle("email")}><Bell size={18} /><span><b>E-mail</b><small>{profile.email}</small></span></button><button className={preferences.whatsapp ? "is-selected" : ""} type="button" onClick={() => toggle("whatsapp")}><Smartphone size={18} /><span><b>WhatsApp</b><small>{profile.phone || "Cadastre seu telefone"}</small></span></button><button className={preferences.push ? "is-selected" : ""} type="button" onClick={() => toggle("push")}><Bell size={18} /><span><b>Push</b><small>Neste navegador</small></span></button></div></section>}

        {tab === "seguranca" && <section className="settings-panel"><div className="settings-panel-head"><div><p className="settings-eyebrow">PROTEÇÃO DA CONTA</p><h2>Segurança</h2></div><LockKeyhole size={23} /></div><p className="settings-description">Use uma senha forte e acompanhe o dispositivo conectado.</p><div className="settings-feature-row"><span><ShieldCheck size={21} /></span><div><b>Autenticação em duas etapas</b><small>Em breve no portal do associado</small></div><Toggle checked={false} disabled onChange={() => undefined} label="Autenticação em duas etapas indisponível" /></div><form className="settings-security" onSubmit={updatePassword}><h3 className="settings-subtitle">Alterar senha</h3><label>Senha atual<input name="currentPassword" type="password" autoComplete="current-password" required /></label><label>Nova senha<input name="newPassword" type="password" minLength={8} autoComplete="new-password" required /></label><label>Confirmar nova senha<input name="confirmation" type="password" minLength={8} autoComplete="new-password" required /></label><button type="submit">Atualizar senha</button></form><h3 className="settings-subtitle">Sessão conectada</h3><div className="settings-sessions"><div><Laptop size={20} /><span><b>Este navegador</b><small>Sessão atual do portal</small></span><em>ATUAL</em></div></div><button className="settings-text-button" type="button" onClick={logout}><LogOut size={15} /> Sair deste dispositivo</button></section>}

        {tab === "privacidade" && <section className="settings-panel"><div className="settings-panel-head"><div><p className="settings-eyebrow">CONTROLE DE DADOS</p><h2>Privacidade</h2></div><ShieldCheck size={23} /></div><p className="settings-description">Controle como suas informações aparecem na comunidade.</p><div className="settings-options"><div><span><b>Exibir meu perfil nos times</b><small>Permite que associados encontrem você nas modalidades</small></span><Toggle checked={preferences.equipes} onChange={() => toggle("equipes")} label="Exibir perfil nos times" /></div><div><span><b>Compartilhar presença em eventos</b><small>Mostra sua confirmação para a organização</small></span><Toggle checked={preferences.presenca} onChange={() => toggle("presenca")} label="Compartilhar presença" /></div></div><div className="settings-data-box"><Download size={22} /><div><b>Baixar meus dados</b><small>Baixe uma cópia das informações carregadas nesta conta.</small></div><button type="button" onClick={downloadData}>Baixar arquivo</button></div></section>}

        {tab === "conta" && <section className="settings-panel"><div className="settings-panel-head"><div><p className="settings-eyebrow">ASSOCIAÇÃO</p><h2>Conta e plano</h2></div><CreditCard size={23} /></div><div className="settings-plan"><div><p>PLANO ATUAL</p><h3>{subscription?.plan || profile.plan || "Não informado"}</h3><span><i /> {subscription?.status === "ACTIVE" ? "Associação ativa" : subscription?.status || "Situação não informada"}</span></div></div><div className="settings-account-grid"><div><span>MATRÍCULA</span><b>{profile.registration || "Não informada"}</b></div><div><span>VIGÊNCIA ATUAL</span><b>{formatDate(subscription?.currentPeriodEnd || null)}</b></div><div><span>ASSINATURA</span><b>{subscription?.subscriptionStatus || "Sem cobrança recorrente"}</b></div><div><span>SITUAÇÃO</span><b className="is-paid">{subscription?.status === "ACTIVE" ? "Em dia" : subscription?.status || "Não informada"}</b></div></div><div className="settings-plan-actions"><Link href="/associado/mensalidade">Ver pagamentos <ChevronRight size={15} /></Link><Link href="/associado/carteirinha">Abrir carteirinha <ChevronRight size={15} /></Link></div></section>}
      </div>
    </section>

    <section className="settings-danger"><span><Trash2 size={20} /></span><div><p className="settings-eyebrow">ZONA DE SEGURANÇA</p><b>Excluir minha conta</b><small>Solicite a exclusão diretamente à diretoria para confirmar sua identidade.</small></div><a href="mailto:suporte@compexatas.com.br?subject=Solicitação de exclusão de conta">Falar com a diretoria</a></section>
  </div>;
}
