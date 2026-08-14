"use client";

import Link from "next/link";
import {
  AlertTriangle, ArrowLeft, ArrowRight, BadgeCheck, CalendarCheck, Check,
  CircleDollarSign, Crown, Gift, Medal, RotateCcw, ShieldCheck, ShoppingBag,
  Sparkles, Trophy,
} from "lucide-react";
import MembershipGate from "@/components/associate/MembershipGate";
import { useAssociateSession } from "@/components/associate/AssociateSession";
import "./regulation.css";

const earningRules = [
  { icon: CalendarCheck, title: "Check-in em evento", points: "+80 pontos", text: "Crédito automático após o check-in oficial e validado no evento." },
  { icon: CircleDollarSign, title: "Mensalidade em dia", points: "+100 pontos", text: "Crédito mensal depois da confirmação do pagamento da associação." },
  { icon: ShoppingBag, title: "Compra na loja", points: "1 ponto por R$ 1", text: "Mínimo de 20 pontos por pedido aprovado. Frete não gera pontos." },
  { icon: Trophy, title: "Presença em treino", points: "+50 pontos", text: "O coordenador da modalidade lê o QR Code da carteirinha durante o treino. Cada treino pontua uma única vez." },
  { icon: Sparkles, title: "Ações da comunidade", points: "Valor divulgado", text: "Campanhas, desafios e trabalhos voluntários informam a pontuação antes da participação." },
];

const deductionRules = [
  { title: "Compra cancelada ou estornada", text: "Os pontos concedidos pelo pedido são retirados depois da confirmação do cancelamento." },
  { title: "Check-in inválido ou duplicado", text: "Registros feitos por engano, duplicados ou sem presença comprovada podem ser revertidos." },
  { title: "Fraude ou uso indevido", text: "Compartilhar acesso, adulterar comprovantes ou tentar obter pontos indevidos gera estorno e revisão da conta." },
  { title: "Correção administrativa", text: "A diretoria pode corrigir um lançamento incorreto. Todo ajuste aparece no histórico com valor e justificativa." },
];

const levels = [
  { name: "Calouro", range: "0 a 299 pts", benefit: "Entrada no placar e primeira coleção de conquistas." },
  { name: "Parte da Matilha", range: "300 a 699 pts", benefit: "Selo de nível e acesso a campanhas exclusivas quando divulgadas." },
  { name: "Destaque Compex", range: "700 a 1.499 pts", benefit: "Destaque no ranking e prioridade em ações especiais com vagas limitadas." },
  { name: "Lenda Compex", range: "1.500+ pts", benefit: "Maior selo da temporada e reconhecimento nas ações oficiais da atlética." },
];

export default function GamificationRegulationPage() {
  const { profile } = useAssociateSession();
  if (profile.membershipKind !== "SOCIO") return <MembershipGate feature="O regulamento da gamificação" />;

  return <div className="reg-page">
    <Link className="reg-back" href="/associado/gamificacao"><ArrowLeft size={16}/> Voltar ao meu placar</Link>

    <section className="reg-hero">
      <div><p>MINHA COMPEX / REGULAMENTO</p><h1>Jogue limpo.<br/><em>Viva a matilha.</em></h1><span>Entenda como os pontos são registrados, quando podem ser retirados e o que cada nível representa.</span></div>
      <div className="reg-hero-seal"><ShieldCheck/><b>Regras claras</b><small>Exclusivo para sócios</small></div>
      <img src="/compex-logo.png" alt="" aria-hidden="true" />
    </section>

    <section className="reg-summary" aria-label="Resumo do regulamento">
      <article><BadgeCheck/><div><b>Pontos confirmados</b><span>Nenhuma atividade entra no placar sem validação.</span></div></article>
      <article><RotateCcw/><div><b>Ajustes transparentes</b><span>Estornos ficam identificados no seu histórico.</span></div></article>
      <article><Gift/><div><b>Benefícios por campanha</b><span>Prêmios e vantagens são anunciados com regras próprias.</span></div></article>
    </section>

    <section className="reg-section">
      <div className="reg-heading"><span>01</span><div><p>COMO GANHAR</p><h2>Atitudes que viram pontos</h2></div></div>
      <div className="reg-earn-grid">{earningRules.map(({icon: Icon, title, points, text}) => <article key={title}><Icon/><strong>{points}</strong><h3>{title}</h3><p>{text}</p></article>)}</div>
    </section>

    <section className="reg-section">
      <div className="reg-heading"><span>02</span><div><p>COMO PERDER</p><h2>Quando acontece um estorno</h2></div></div>
      <div className="reg-deduction-list">{deductionRules.map((item, index) => <article key={item.title}><span>{String(index + 1).padStart(2, "0")}</span><div><h3>{item.title}</h3><p>{item.text}</p></div><AlertTriangle/></article>)}</div>
      <div className="reg-notice"><ShieldCheck/><p><b>Não existe perda automática por inatividade.</b> Uma dedução só pode ocorrer pelos motivos descritos acima e deve aparecer no histórico do sócio com justificativa.</p></div>
    </section>

    <section className="reg-section">
      <div className="reg-heading"><span>03</span><div><p>NÍVEIS E VANTAGENS</p><h2>Seu caminho dentro da matilha</h2></div></div>
      <div className="reg-levels">{levels.map((level, index) => <article key={level.name}><div><Medal/><span>{index + 1}</span></div><p>{level.range}</p><h3>{level.name}</h3><span>{level.benefit}</span></article>)}</div>
    </section>

    <section className="reg-terms">
      <div><Crown/><h2>O que mais preciso saber?</h2></div>
      <ul>
        <li><Check/> A gamificação é exclusiva para contas com associação ativa.</li>
        <li><Check/> Pontos são pessoais, intransferíveis e não possuem valor em dinheiro.</li>
        <li><Check/> Cada campanha pode ter prazo, vagas e benefícios próprios, informados antes do início.</li>
        <li><Check/> Os pontos permanecem durante a temporada; qualquer encerramento será comunicado com antecedência.</li>
        <li><Check/> Dúvidas ou contestações podem ser enviadas pelos canais oficiais da CompExatas.</li>
      </ul>
      <Link href="/associado/gamificacao">Entendi, abrir meu placar <ArrowRight size={15}/></Link>
    </section>
  </div>;
}
