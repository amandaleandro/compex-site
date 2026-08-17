"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, BarChart3 } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Metrics = {
  tasks: { completedOnTime: number; completedLate: number; onTimeRate: number | null; overdueOpen: number };
  pendencies: { open: number; resolvedLast30d: number; avgResolutionHours: number | null };
  notifications: { sentLast30d: number };
  operational: { schedulesAwaitingConfirmation: number; pollsAwaitingValidation: number; requestsAwaitingApproval: number };
};

function Stat({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="compex-card p-4">
      <p className="text-xs font-bold text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function formatHours(hours: number | null) {
  if (hours === null) return "—";
  if (hours < 24) return `${hours}h`;
  return `${Math.round((hours / 24) * 10) / 10} dias`;
}

export default function MetricasPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    compexApi<Metrics>("/metrics")
      .then(setMetrics)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar as métricas."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <GestaoGuard allow={["PRESIDENCIA"]}>
      <div className="mx-auto max-w-5xl px-6 py-7 sm:px-9">
        <header className="mb-6">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão · Presidência</span>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900"><BarChart3 size={22} className="text-blue-700" /> Métricas operacionais</h1>
          <p className="text-sm text-slate-500">Uma noção de saúde da operação — não é ranking de pessoas.</p>
        </header>

        {loading ? (
          <div className="compex-card flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : error || !metrics ? (
          <div className="compex-card p-6 text-sm font-medium text-red-600">{error || "Sem dados."}</div>
        ) : (
          <div className="space-y-6">
            <div>
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-600">Tarefas</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Stat label="Concluídas no prazo" value={metrics.tasks.completedOnTime} />
                <Stat label="Concluídas com atraso" value={metrics.tasks.completedLate} />
                <Stat label="Taxa no prazo" value={metrics.tasks.onTimeRate !== null ? `${metrics.tasks.onTimeRate}%` : "—"} />
                <Stat label="Abertas e atrasadas" value={metrics.tasks.overdueOpen} />
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-600">Pendências</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Abertas agora" value={metrics.pendencies.open} />
                <Stat label="Resolvidas (30 dias)" value={metrics.pendencies.resolvedLast30d} />
                <Stat label="Tempo médio até resolver" value={formatHours(metrics.pendencies.avgResolutionHours)} />
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-600">Comunicação</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Notificações enviadas (30 dias)" value={metrics.notifications.sentLast30d} />
                <Stat label="Escalas aguardando resposta" value={metrics.operational.schedulesAwaitingConfirmation} />
                <Stat label="Enquetes aguardando validação" value={metrics.operational.pollsAwaitingValidation} />
              </div>
            </div>

            <div>
              <h2 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-600">Aprovações</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Solicitações aguardando aprovação" value={metrics.operational.requestsAwaitingApproval} />
              </div>
            </div>
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
