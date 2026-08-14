import Link from "next/link";
import { ArrowRight, Check, ShieldCheck } from "lucide-react";

export default function MembershipGate({ feature }: { feature: string }) {
  return <section className="membership-gate">
    <div className="membership-gate-mark"><img src="/compex-logo.png" alt="CompExatas" /></div>
    <div className="membership-gate-copy">
      <p className="eyebrow">RECURSO PARA ASSOCIADOS</p>
      <h1>{feature} faz parte da<br /><em>experiência completa.</em></h1>
      <p>Sua conta avulsa continua ativa para eventos, modalidades e cobranças. Para acessar este recurso e as vantagens exclusivas, solicite sua associação.</p>
      <div className="membership-gate-points"><span><Check size={15}/> Carteirinha digital</span><span><Check size={15}/> Benefícios de parceiros</span><span><Check size={15}/> Condições especiais</span></div>
      <div className="membership-gate-actions"><a href="mailto:suporte@compexatas.com.br?subject=Quero%20me%20associar%20à%20CompExatas">Solicitar associação <ArrowRight size={16}/></a><Link href="/associado">Voltar ao portal</Link></div>
      <small><ShieldCheck size={14}/> Você pode continuar usando sua conta avulsa sem mensalidade.</small>
    </div>
  </section>;
}
