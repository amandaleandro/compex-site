"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, MessageCircle, CheckCircle2, XCircle, Clock } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type Status = {
  configured: boolean;
  instance: string | null;
  webhookConfigured: boolean;
  connected: boolean;
  lastEventType: string | null;
  lastEventAt: string | null;
  counts: { pending: number; failed: number; sent: number };
};

type Message = {
  id: string;
  toPhone: string;
  templateKey: string;
  content: string;
  status: "PENDENTE" | "PROCESSANDO" | "ENVIADO" | "ENTREGUE" | "FALHOU" | "CANCELADO";
  attempts: number;
  maxAttempts: number;
  error: string | null;
  linkedEntity: string | null;
  createdAt: string;
  sentAt: string | null;
};

const STATUS_COLOR: Record<string, string> = {
  PENDENTE: "bg-slate-100 text-slate-600", PROCESSANDO: "bg-blue-50 text-blue-700",
  ENVIADO: "bg-emerald-50 text-emerald-700", ENTREGUE: "bg-emerald-100 text-emerald-800",
  FALHOU: "bg-red-50 text-red-700", CANCELADO: "bg-slate-100 text-slate-500",
};

function maskPhone(phone: string) {
  return phone.length > 4 ? `${phone.slice(0, -4).replace(/\d/g, "•")}${phone.slice(-4)}` : phone;
}

export default function WhatsAppStatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([compexApi<Status>("/whatsapp/status"), compexApi<Message[]>("/whatsapp/messages")])
      .then(([s, m]) => { setStatus(s); setMessages(m); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <GestaoGuard allow={["PRESIDENCIA"]}>
      <div className="mx-auto max-w-5xl px-6 py-7 sm:px-9">
        <header className="mb-6">
          <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão · Presidência</span>
          <h1 className="mt-1 flex items-center gap-2 text-2xl font-black text-slate-900"><MessageCircle size={22} className="text-emerald-600" /> Integração WhatsApp</h1>
          <p className="text-sm text-slate-500">Status da conexão com a Evolution API e histórico de envios. Credenciais nunca aparecem aqui — ficam só no backend.</p>
        </header>

        {loading ? (
          <div className="compex-card flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...
          </div>
        ) : error ? (
          <div className="compex-card p-6 text-sm font-medium text-red-600">{error}</div>
        ) : status && (
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="compex-card p-4">
                <p className="text-xs font-bold text-slate-500">Instância</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-slate-900">
                  {status.configured ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-500" />}
                  {status.configured ? (status.instance || "configurada") : "Não configurada"}
                </p>
                {!status.configured && <p className="mt-1 text-[11px] text-slate-400">Defina EVOLUTION_API_URL, EVOLUTION_API_KEY e EVOLUTION_INSTANCE no backend.</p>}
              </div>
              <div className="compex-card p-4">
                <p className="text-xs font-bold text-slate-500">Conexão</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-slate-900">
                  {status.connected ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-slate-400" />}
                  {status.connected ? "Conectado" : "Desconectado"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">
                  {status.lastEventAt ? `Último evento: ${status.lastEventType} em ${new Date(status.lastEventAt).toLocaleString("pt-BR")}` : "Nenhum evento de webhook recebido ainda."}
                </p>
              </div>
              <div className="compex-card p-4">
                <p className="text-xs font-bold text-slate-500">Webhook</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm font-black text-slate-900">
                  {status.webhookConfigured ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-slate-400" />}
                  {status.webhookConfigured ? "Protegido por token" : "Sem token definido"}
                </p>
                <p className="mt-1 text-[11px] text-slate-400">Endpoint: /api/webhooks/evolution</p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-4">
              <div className="compex-card p-4 text-center">
                <p className="text-2xl font-black text-slate-900">{status.counts.pending}</p>
                <p className="text-xs font-bold text-slate-500">Na fila</p>
              </div>
              <div className="compex-card p-4 text-center">
                <p className="text-2xl font-black text-emerald-700">{status.counts.sent}</p>
                <p className="text-xs font-bold text-slate-500">Enviadas</p>
              </div>
              <div className="compex-card p-4 text-center">
                <p className="text-2xl font-black text-red-700">{status.counts.failed}</p>
                <p className="text-xs font-bold text-slate-500">Falharam</p>
              </div>
            </div>
          </>
        )}

        <h2 className="mb-3 text-lg font-black text-slate-900">Histórico recente</h2>
        {messages.length === 0 ? (
          <div className="compex-card p-6 text-sm text-slate-500">Nenhuma mensagem na fila ainda.</div>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <div key={m.id} className="compex-card p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_COLOR[m.status]}`}>{m.status}</span>
                    <span className="text-xs font-bold text-slate-700">{m.templateKey}</span>
                    <span className="text-xs text-slate-400">→ {maskPhone(m.toPhone)}</span>
                  </div>
                  <span className="flex items-center gap-1 text-[11px] text-slate-400"><Clock size={11} /> {new Date(m.createdAt).toLocaleString("pt-BR")}</span>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-xs text-slate-600">{m.content}</p>
                {m.error && <p className="mt-1 text-[11px] font-bold text-red-600">Erro: {m.error} ({m.attempts}/{m.maxAttempts} tentativas)</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </GestaoGuard>
  );
}
