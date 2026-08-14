"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BadgePercent, Check, Gift, LoaderCircle, ShieldCheck, X } from "lucide-react";
import MembershipGate from "@/components/associate/MembershipGate";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import { compexApi } from "@/lib/compex-api";
import "./benefits.css";

type Benefit = {
  id: string;
  name: string;
  category: string;
  discount: string;
  description: string | null;
  icon: string | null;
};

function BenefitIcon({ benefit, large = false }: { benefit: Benefit; large?: boolean }) {
  const value = benefit.icon?.trim();
  if (value?.startsWith("/") || value?.startsWith("http")) {
    return <span className={`benefit-icon ${large ? "large" : ""}`}><img src={value} alt="" /></span>;
  }
  return <span className={`benefit-icon ${large ? "large" : ""}`}>{value || <Gift size={large ? 31 : 25}/>}</span>;
}

export default function BeneficiosPage() {
  const { profile } = useAssociateSession();
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [category, setCategory] = useState("Todos");
  const [selected, setSelected] = useState<Benefit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (profile.membershipKind !== "SOCIO") return;
    compexApi<Benefit[]>("/benefits")
      .then(items => { setBenefits(Array.isArray(items) ? items : []); setError(""); })
      .catch(reason => setError(reason instanceof Error ? reason.message : "Não foi possível carregar os benefícios."))
      .finally(() => setLoading(false));
  }, [profile.membershipKind]);

  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", close); };
  }, [selected]);

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(benefits.map(item => item.category).filter(Boolean)))], [benefits]);
  const visibleBenefits = category === "Todos" ? benefits : benefits.filter(item => item.category === category);

  if (profile.membershipKind !== "SOCIO") return <MembershipGate feature="A área de benefícios" />;

  return <>
    <section className="benefit-hero"><div><p className="eyebrow">MINHA COMPEX / BENEFÍCIOS</p><h1>Vantagens para<br /><em>quem faz parte.</em></h1><p>Descontos e experiências especiais para aproveitar sua vida acadêmica com a comunidade CompExatas.</p></div><img src="/compex-logo.png" alt="Mascote CompExatas"/></section>

    <section className="benefit-content">
      <div className="section-head"><div><p className="eyebrow">REDE COMPEX</p><h2>Seus benefícios</h2><p>Escolha uma vantagem para conferir as condições e abra sua carteirinha na hora de usar.</p></div><Link className="card-action" href="/associado/carteirinha">Abrir carteirinha <ArrowRight size={15}/></Link></div>

      {!loading && !error && benefits.length > 0 && <div className="filters" role="tablist" aria-label="Filtrar benefícios">{categories.map(item => <button type="button" role="tab" aria-selected={category === item} className={category === item ? "active" : ""} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div>}

      {loading && <div className="benefit-state"><LoaderCircle className="benefit-spin"/><b>Buscando suas vantagens...</b><span>Carregando os parceiros cadastrados pela CompExatas.</span></div>}
      {error && <div className="benefit-state error"><BadgePercent/><b>Não conseguimos abrir a rede de parceiros.</b><span>{error}</span><button type="button" onClick={() => window.location.reload()}>Tentar novamente</button></div>}
      {!loading && !error && benefits.length === 0 && <div className="benefit-state"><Gift/><b>Novas vantagens estão chegando.</b><span>Assim que a diretoria cadastrar um parceiro, ele aparecerá aqui.</span></div>}

      {!loading && !error && <div className="benefit-cards">{visibleBenefits.map(benefit => <button type="button" className="benefit" key={benefit.id} onClick={() => setSelected(benefit)} aria-label={`Ver benefício ${benefit.name}`}><BenefitIcon benefit={benefit}/><small>{benefit.category}</small><b>{benefit.name}</b><p>{benefit.description || "Apresente sua carteirinha digital válida e aproveite esta condição especial."}</p><strong className="use"><span>Ver como usar</span><span>{benefit.discount}</span></strong></button>)}</div>}
    </section>

    {selected && <div className="benefit-backdrop open" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section className="benefit-modal" role="dialog" aria-modal="true" aria-labelledby="benefit-modal-title">
      <button className="benefit-close" type="button" onClick={() => setSelected(null)} aria-label="Fechar"><X size={20}/></button>
      <p className="eyebrow">BENEFÍCIO DE SÓCIO</p>
      <BenefitIcon benefit={selected} large/>
      <span className="benefit-modal-category">{selected.category}</span>
      <h2 id="benefit-modal-title">{selected.name}</h2>
      <strong className="benefit-modal-discount">{selected.discount}</strong>
      <p>{selected.description || "Apresente sua carteirinha digital válida no estabelecimento parceiro para aproveitar a condição."}</p>
      <div className="benefit-instructions"><b>Como usar</b><span><Check size={15}/> Abra sua carteirinha digital.</span><span><Check size={15}/> Apresente-a antes de realizar o pagamento.</span><span><Check size={15}/> Confirme as condições diretamente com o parceiro.</span></div>
      <Link className="benefit-modal-action" href="/associado/carteirinha">Abrir minha carteirinha <ArrowRight size={16}/></Link>
      <small><ShieldCheck size={14}/> Benefício pessoal e exclusivo para associação ativa.</small>
    </section></div>}
  </>;
}
