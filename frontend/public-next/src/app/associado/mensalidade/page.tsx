"use client";

import { CheckCircle2, CreditCard } from "lucide-react";
import AssociatePage from "@/components/associate/AssociatePage";
import { useAssociateSession } from "@/components/associate/AssociateSession";

function dateLabel(value: string | null) {
  if (!value) return "Vigência não informada";
  return `Válido até ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(new Date(value))}`;
}

export default function MensalidadePage() {
  const { profile, subscription } = useAssociateSession();
  const active = profile.status === "ACTIVE" || subscription.status === "ACTIVE";
  return <AssociatePage eyebrow="FINANCEIRO" title="Minha mensalidade" description="Consulte o status do seu plano e o histórico de pagamentos.">
    <div className="mt-6 grid gap-4 sm:grid-cols-2"><div className="rounded-xl bg-blue-50 p-6"><CreditCard className="text-blue-700"/><span className="mt-5 block text-xs text-slate-500">Plano atual</span><b className="mt-1 block text-2xl text-slate-900">{subscription.plan || profile.plan}</b><small className="mt-2 block text-slate-600">{dateLabel(subscription.currentPeriodEnd)}</small></div><div className={`rounded-xl border p-6 ${active ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-slate-50"}`}><CheckCircle2 className={active ? "text-blue-600" : "text-slate-500"}/><span className="mt-5 block text-xs text-slate-500">Situação</span><b className={`mt-1 block text-2xl ${active ? "text-blue-800" : "text-slate-700"}`}>{active ? "Em dia" : "Em análise"}</b><small className="mt-2 block text-slate-600">{subscription.subscriptionStatus || "Consulte os pagamentos da associação"}</small></div></div>
    <h2 className="mt-8 text-xl font-black text-slate-900">Histórico</h2><div className="associate-list"><div className="associate-list-item"><div><b>{subscription.plan || profile.plan}</b><small>As cobranças confirmadas aparecerão aqui.</small></div><span className="text-xs font-bold text-blue-700">{subscription.subscriptionStatus || "Sem cobrança registrada"}</span></div></div>
  </AssociatePage>;
}
