"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Summary = {
  approvals: {
    requests: { id: string; description: string; department: string; status: string; valuePlanned: number | null; createdAt: string }[];
    departures: { id: string; requesterName: string; department: string; status: string; createdAt: string }[];
    rests: { id: string; requesterName: string; department: string; days: number; createdAt: string }[];
  };
  finance: { overdueCount: number; overdue: { id: string; description: string; amount: number; dueDate: string | null }[] };
  departments: { overdueTasksCount: number };
  esportes: {
    incompleteSchedulesCount: number;
    incompleteSchedules: { id: string; referenceLabel: string; function: string; status: string; date: string }[];
    upcomingGames: { id: string; teamName: string; date: string; location: string | null }[];
  };
  alerts: {
    overdueLoansCount: number;
    overdueLoans: { id: string; assetName: string; borrowerName: string; expectedReturn: string | null }[];
    unpaidProofTransactionsCount: number;
    unpaidProofTransactions: { id: string; description: string; amount: number; favorecido: string | null }[];
    overdueRequestsCount: number;
    overdueRequests: { id: string; description: string; department: string; status: string; dueDate: string | null }[];
    pendingConfirmationsCount: number;
    pendingConfirmations: { sessionId: string; teamName: string; date: string; pendingCount: number }[];
  };
};

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function Section({ title, count, tone, children }: { title: string; count: number; tone: "red" | "amber" | "blue"; children: React.ReactNode }) {
  const toneClass = { red: "text-red-700 bg-red-50", amber: "text-amber-700 bg-amber-50", blue: "text-blue-700 bg-blue-50" }[tone];
  return (
    <div className="compex-card p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-[0.14em] text-slate-600">{title}</h2>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${toneClass}`}>{count}</span>
      </div>
      {count === 0 ? <p className="text-sm text-slate-500">Nada pendente aqui.</p> : <div className="space-y-2">{children}</div>}
    </div>
  );
}

function PresidenciaContent() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    compexApi<Summary>("/presidencia-summary")
      .then(setSummary)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar o painel."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-slate-500">
        <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando painel...
      </div>
    );
  }

  if (error || !summary) {
    return <div className="mx-auto max-w-3xl px-6 py-10 text-sm font-medium text-red-600">{error || "Sem dados."}</div>;
  }

  const totalApprovals = summary.approvals.requests.length + summary.approvals.departures.length + summary.approvals.rests.length;
  const totalAlerts = summary.alerts.overdueLoansCount + summary.alerts.unpaidProofTransactionsCount + summary.alerts.overdueRequestsCount + summary.alerts.pendingConfirmationsCount;

  return (
    <div className="mx-auto max-w-6xl px-6 py-7 sm:px-9">
      <header className="mb-6">
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
        <h1 className="mt-1 text-2xl font-black text-slate-900">Central da Presidência</h1>
        <p className="text-sm text-slate-500">O que precisa da sua atenção agora — não é um dashboard de números, é uma lista de pendências.</p>
      </header>

      {totalApprovals === 0 && totalAlerts === 0 && summary.finance.overdueCount === 0 && summary.departments.overdueTasksCount === 0 && summary.esportes.incompleteSchedulesCount === 0 && (
        <div className="compex-card mb-6 flex items-center gap-3 p-5 text-emerald-700">
          <CheckCircle2 size={18} />
          Tudo em dia. Nenhuma pendência no momento.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Solicitações aguardando aprovação" count={summary.approvals.requests.length} tone="amber">
          {summary.approvals.requests.map((r) => (
            <Link key={r.id} href="/gestao/solicitacoes" className="block rounded-xl border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50">
              <p className="font-bold text-slate-900">{r.description}</p>
              <p className="text-xs text-slate-500">{r.department} · {r.status}{r.valuePlanned ? ` · ${money(r.valuePlanned)}` : ""}</p>
            </Link>
          ))}
        </Section>

        <Section title="Desligamentos e descansos pendentes" count={summary.approvals.departures.length + summary.approvals.rests.length} tone="amber">
          {summary.approvals.departures.map((d) => (
            <Link key={d.id} href="/gestao/desligamento" className="block rounded-xl border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50">
              <p className="font-bold text-slate-900">Desligamento · {d.requesterName}</p>
              <p className="text-xs text-slate-500">{d.department} · {d.status}</p>
            </Link>
          ))}
          {summary.approvals.rests.map((r) => (
            <Link key={r.id} href="/gestao/descanso" className="block rounded-xl border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50">
              <p className="font-bold text-slate-900">Descanso · {r.requesterName}</p>
              <p className="text-xs text-slate-500">{r.department} · {r.days} dias</p>
            </Link>
          ))}
        </Section>

        <Section title="Contas vencidas sem pagamento" count={summary.finance.overdueCount} tone="red">
          {summary.finance.overdue.map((t) => (
            <Link key={t.id} href="/gestao/financeiro" className="block rounded-xl border border-red-100 bg-red-50/50 p-3 hover:bg-red-50">
              <p className="font-bold text-slate-900">{t.description}</p>
              <p className="text-xs text-slate-500">{money(t.amount)}{t.dueDate ? ` · venceu em ${new Date(t.dueDate).toLocaleDateString("pt-BR")}` : ""}</p>
            </Link>
          ))}
        </Section>

        <Section title="Tarefas atrasadas" count={summary.departments.overdueTasksCount} tone="red">
          <Link href="/gestao/tarefas" className="block rounded-xl border border-red-100 bg-red-50/50 p-3 text-sm font-bold text-red-700 hover:bg-red-50">
            Ver tarefas atrasadas na tela de Tarefas
          </Link>
        </Section>

        <Section title="Escalas incompletas (súmula, bandeirão etc.)" count={summary.esportes.incompleteSchedulesCount} tone="amber">
          {summary.esportes.incompleteSchedules.map((s) => (
            <Link key={s.id} href="/gestao/escalas" className="block rounded-xl border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50">
              <p className="font-bold text-slate-900">{s.referenceLabel}</p>
              <p className="text-xs text-slate-500">{s.function} · {s.status} · {new Date(s.date).toLocaleDateString("pt-BR")}</p>
            </Link>
          ))}
        </Section>

        <Section title="Próximos jogos" count={summary.esportes.upcomingGames.length} tone="blue">
          {summary.esportes.upcomingGames.map((g) => (
            <Link key={g.id} href="/gestao/esportes" className="block rounded-xl border border-blue-100 bg-blue-50/50 p-3 hover:bg-blue-50">
              <p className="font-bold text-slate-900">{g.teamName}</p>
              <p className="text-xs text-slate-500">{new Date(g.date).toLocaleDateString("pt-BR")}{g.location ? ` · ${g.location}` : ""}</p>
            </Link>
          ))}
        </Section>
      </div>

      {totalAlerts > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-black uppercase tracking-[0.14em] text-slate-600">Alertas</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <Section title="Material do patrimônio não devolvido" count={summary.alerts.overdueLoansCount} tone="red">
              {summary.alerts.overdueLoans.map((l) => (
                <Link key={l.id} href="/gestao/patrimonio" className="block rounded-xl border border-red-100 bg-red-50/50 p-3 hover:bg-red-50">
                  <p className="font-bold text-slate-900">{l.assetName}</p>
                  <p className="text-xs text-slate-500">Com {l.borrowerName}{l.expectedReturn ? ` · devolução prevista ${new Date(l.expectedReturn).toLocaleDateString("pt-BR")}` : ""}</p>
                </Link>
              ))}
            </Section>

            <Section title="Pagamentos sem comprovante" count={summary.alerts.unpaidProofTransactionsCount} tone="red">
              {summary.alerts.unpaidProofTransactions.map((t) => (
                <Link key={t.id} href="/gestao/financeiro" className="block rounded-xl border border-red-100 bg-red-50/50 p-3 hover:bg-red-50">
                  <p className="font-bold text-slate-900">{t.description}</p>
                  <p className="text-xs text-slate-500">{money(t.amount)}{t.favorecido ? ` · ${t.favorecido}` : ""}</p>
                </Link>
              ))}
            </Section>

            <Section title="Solicitações com vencimento passado" count={summary.alerts.overdueRequestsCount} tone="amber">
              {summary.alerts.overdueRequests.map((r) => (
                <Link key={r.id} href="/gestao/solicitacoes" className="block rounded-xl border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50">
                  <p className="font-bold text-slate-900">{r.description}</p>
                  <p className="text-xs text-slate-500">{r.department} · {r.status}{r.dueDate ? ` · venceu em ${new Date(r.dueDate).toLocaleDateString("pt-BR")}` : ""}</p>
                </Link>
              ))}
            </Section>

            <Section title="Atletas sem confirmação de presença" count={summary.alerts.pendingConfirmationsCount} tone="amber">
              {summary.alerts.pendingConfirmations.map((p) => (
                <Link key={p.sessionId} href="/gestao/esportes" className="block rounded-xl border border-amber-100 bg-amber-50/50 p-3 hover:bg-amber-50">
                  <p className="font-bold text-slate-900">{p.teamName}</p>
                  <p className="text-xs text-slate-500">{new Date(p.date).toLocaleDateString("pt-BR")} · {p.pendingCount} sem resposta</p>
                </Link>
              ))}
            </Section>
          </div>
        </>
      )}
    </div>
  );
}

export default function PresidenciaPage() {
  return (
    <GestaoGuard allow={["PRESIDENCIA"]}>
      <PresidenciaContent />
    </GestaoGuard>
  );
}
