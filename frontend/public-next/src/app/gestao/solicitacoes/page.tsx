"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Paperclip, Plus, Search } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi, sessionToken } from "@/lib/compex-api";

type RequestStatus = "RASCUNHO" | "SOLICITADO" | "APROVACAO_DIRETOR" | "FINANCEIRO" | "PRESIDENCIA" | "APROVADO" | "PAGO" | "FINALIZADO" | "REJEITADO";
type RequestType =
  | "PAGAMENTO_TECNICO" | "PAGAMENTO_ARBITRAGEM" | "COMPRA_MATERIAIS" | "FERRAMENTA_SOFTWARE"
  | "CONTRATACAO_FORNECEDOR" | "TRANSPORTE" | "ALIMENTACAO" | "INSCRICAO_CAMPEONATO" | "REEMBOLSO"
  | "EVENTO" | "MATERIAL_ESPORTIVO" | "DESPESA_ADMINISTRATIVA" | "OUTRAS_DESPESAS";

type Req = {
  id: string;
  type: RequestType;
  requesterName: string;
  requesterEmail: string;
  department: string;
  description: string;
  justification: string | null;
  valuePlanned: number | null;
  valueFinal: number | null;
  favorecido: string | null;
  dueDate: string | null;
  priority: "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";
  attachments: { name: string; url: string }[] | null;
  observations: string | null;
  status: RequestStatus;
  proofUrl: string | null;
  rejectedReason: string | null;
  items: { name: string; quantity: number; unit?: string }[] | null;
  quotations: { supplier: string; value: number; notes: string | null; addedBy: string; addedAt: string }[] | null;
  invoiceUrl: string | null;
  purchaseResponsibleName: string | null;
  receivedByName: string | null;
  receivedAt: string | null;
  createdAt: string;
};

const PURCHASE_TYPES: RequestType[] = ["COMPRA_MATERIAIS", "MATERIAL_ESPORTIVO", "FERRAMENTA_SOFTWARE", "CONTRATACAO_FORNECEDOR"];

const TYPE_LABEL: Record<RequestType, string> = {
  PAGAMENTO_TECNICO: "Pagamento de técnico",
  PAGAMENTO_ARBITRAGEM: "Pagamento de arbitragem",
  COMPRA_MATERIAIS: "Compra de materiais",
  FERRAMENTA_SOFTWARE: "Ferramenta/software",
  CONTRATACAO_FORNECEDOR: "Contratação de fornecedor",
  TRANSPORTE: "Transporte",
  ALIMENTACAO: "Alimentação",
  INSCRICAO_CAMPEONATO: "Inscrição em campeonato",
  REEMBOLSO: "Reembolso",
  EVENTO: "Evento",
  MATERIAL_ESPORTIVO: "Material esportivo",
  DESPESA_ADMINISTRATIVA: "Despesa administrativa",
  OUTRAS_DESPESAS: "Outras despesas",
};

const STATUS_LABEL: Record<RequestStatus, string> = {
  RASCUNHO: "Rascunho",
  SOLICITADO: "Solicitado",
  APROVACAO_DIRETOR: "Aprovação do diretor",
  FINANCEIRO: "Financeiro",
  PRESIDENCIA: "Presidência",
  APROVADO: "Aprovado",
  PAGO: "Pago",
  FINALIZADO: "Finalizado",
  REJEITADO: "Rejeitado",
};

const STATUS_CLASS: Record<RequestStatus, string> = {
  RASCUNHO: "bg-slate-100 text-slate-600",
  SOLICITADO: "bg-blue-50 text-blue-700",
  APROVACAO_DIRETOR: "bg-amber-50 text-amber-700",
  FINANCEIRO: "bg-amber-50 text-amber-700",
  PRESIDENCIA: "bg-amber-50 text-amber-700",
  APROVADO: "bg-emerald-50 text-emerald-700",
  PAGO: "bg-emerald-50 text-emerald-700",
  FINALIZADO: "bg-emerald-100 text-emerald-800",
  REJEITADO: "bg-red-50 text-red-700",
};

const NEXT_ACTION: Partial<Record<RequestStatus, { action: string; label: string }>> = {
  SOLICITADO: { action: "approve_director", label: "Aprovar (diretoria)" },
  APROVACAO_DIRETOR: { action: "approve_finance", label: "Aprovar (financeiro)" },
  FINANCEIRO: { action: "approve_presidency", label: "Enviar à presidência" },
  PRESIDENCIA: { action: "approve_presidency", label: "Aprovar (presidência)" },
  APROVADO: { action: "pay", label: "Marcar como pago" },
  PAGO: { action: "finalize", label: "Finalizar" },
};

const emptyForm = {
  type: "OUTRAS_DESPESAS" as RequestType,
  department: "Presidência",
  description: "",
  justification: "",
  valuePlanned: "",
  favorecido: "",
  dueDate: "",
  priority: "MEDIA" as Req["priority"],
  observations: "",
};

const money = (value: number | null) => (value === null ? "—" : value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }));

function readRole(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("compex-session");
    return raw ? JSON.parse(raw).role : null;
  } catch {
    return null;
  }
}

export default function SolicitacoesPage() {
  const [requests, setRequests] = useState<Req[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [form, setForm] = useState(emptyForm);
  const [attachments, setAttachments] = useState<{ name: string; url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const role = readRole();
  const isPresidencia = role === "PRESIDENCIA";

  const load = async () => {
    try {
      const result = await compexApi<Req[]>(`/requests${statusFilter ? `?status=${statusFilter}` : ""}`);
      setRequests(Array.isArray(result) ? result : []);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as solicitações.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return requests;
    return requests.filter((r) => [r.description, r.department, r.requesterName, TYPE_LABEL[r.type]].join(" ").toLowerCase().includes(q));
  }, [requests, query]);

  const pendingCount = requests.filter((r) => !["RASCUNHO", "FINALIZADO", "REJEITADO"].includes(r.status)).length;

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await fetch("/api/backend/requests/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken()}` },
        body: formData,
      }).then((r) => r.json());
      if (result.error) throw new Error(result.error);
      setAttachments((prev) => [...prev, { name: result.name, url: result.url }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível anexar o arquivo.");
    } finally {
      setUploading(false);
    }
  };

  const createRequest = async (submit: boolean) => {
    if (!form.department.trim() || !form.description.trim()) {
      setError("Informe departamento e descrição.");
      return;
    }
    setSaving(true);
    try {
      await compexApi("/requests", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          valuePlanned: form.valuePlanned || undefined,
          dueDate: form.dueDate || undefined,
          attachments,
          submit,
        }),
      });
      setForm(emptyForm);
      setAttachments([]);
      setError("");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível criar a solicitação.");
    } finally {
      setSaving(false);
    }
  };

  const runAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      await compexApi("/requests", { method: "PUT", body: JSON.stringify({ id, action, ...extra }) });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível executar a ação.");
    }
  };

  const markPaid = async (r: Req) => {
    const proofUrl = window.prompt("Cole a URL do comprovante já anexado, ou anexe um arquivo abaixo antes de marcar como pago.", r.proofUrl || "");
    if (proofUrl === null) return;
    await runAction(r.id, "pay", { proofUrl: proofUrl || undefined });
  };

  const reject = async (r: Req) => {
    const reason = window.prompt("Motivo da rejeição:");
    if (!reason) return;
    await runAction(r.id, "reject", { rejectedReason: reason });
  };

  const addQuote = async (r: Req) => {
    const supplier = window.prompt("Fornecedor da cotação:");
    if (!supplier) return;
    const valueRaw = window.prompt("Valor da cotação (R$):");
    if (!valueRaw) return;
    const notes = window.prompt("Observações (opcional):") || undefined;
    await runAction(r.id, "add_quote", { quotation: { supplier, value: valueRaw, notes } });
  };

  return (
    <GestaoGuard allow={["PRESIDENCIA", "ESPORTES", "FINANCEIRO", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Central de Solicitações</h1>
            <p className="text-sm text-slate-500">Pagamentos, compras, reembolsos e outros pedidos internos — com histórico e aprovação, sem depender de WhatsApp.</p>
          </div>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Total</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{requests.length}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Em aprovação</p>
            <strong className="mt-2 block text-2xl font-black text-amber-600">{pendingCount}</strong>
          </div>
        </div>

        <div className="compex-card mb-6 p-4">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por descrição, departamento ou solicitante"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="">Todos os status</option>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="compex-card flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Carregando solicitações...
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="compex-card flex min-h-[160px] items-center justify-center text-sm text-slate-500">Nenhuma solicitação encontrada.</div>
            ) : (
              filtered.map((r) => {
                const nextAction = NEXT_ACTION[r.status];
                return (
                  <div key={r.id} className="compex-card p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-slate-900">{TYPE_LABEL[r.type]}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        </div>
                        <p className="mt-1 text-sm text-slate-600">{r.description}</p>
                        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-blue-700">{r.department}</p>
                      </div>
                      <div className="text-right text-xs text-slate-500">
                        <div>Solicitante: <span className="font-bold text-slate-800">{r.requesterName}</span></div>
                        <div>Previsto: <span className="font-bold text-slate-800">{money(r.valuePlanned)}</span></div>
                        {r.valueFinal !== null && <div>Pago: <span className="font-bold text-slate-800">{money(r.valueFinal)}</span></div>}
                      </div>
                    </div>

                    {r.rejectedReason && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">Rejeitado: {r.rejectedReason}</p>}
                    {r.proofUrl && (
                      <a href={r.proofUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:underline">
                        <Paperclip size={12} /> Ver comprovante
                      </a>
                    )}

                    {PURCHASE_TYPES.includes(r.type) && r.quotations && r.quotations.length > 0 && (
                      <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-2">
                        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Cotações</p>
                        <ul className="mt-1 space-y-0.5">
                          {r.quotations.map((q, i) => (
                            <li key={i} className="text-xs text-slate-700">
                              {q.supplier} — {money(q.value)}{q.notes ? ` (${q.notes})` : ""}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {r.receivedByName && (
                      <p className="mt-2 text-xs font-bold text-emerald-700">
                        Recebido por {r.receivedByName}{r.receivedAt ? ` em ${new Date(r.receivedAt).toLocaleDateString("pt-BR")}` : ""}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {nextAction && (
                        <button
                          type="button"
                          onClick={() => (r.status === "APROVADO" ? markPaid(r) : runAction(r.id, nextAction.action))}
                          className="rounded-lg bg-[#0b2265] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#071745]"
                        >
                          {r.status === "PAGO" && PURCHASE_TYPES.includes(r.type) ? "Confirmar recebimento" : nextAction.label}
                        </button>
                      )}
                      {PURCHASE_TYPES.includes(r.type) && ["SOLICITADO", "APROVACAO_DIRETOR", "FINANCEIRO"].includes(r.status) && (
                        <button type="button" onClick={() => addQuote(r)} className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-[11px] font-bold text-blue-700 hover:bg-blue-100">
                          Registrar cotação
                        </button>
                      )}
                      {!["FINALIZADO", "REJEITADO", "RASCUNHO"].includes(r.status) && (
                        <button type="button" onClick={() => reject(r)} className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-700 hover:bg-red-100">
                          Rejeitar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        <div className="mt-6 compex-card p-5">
          <h2 className="mb-4 text-lg font-black text-slate-900">Nova solicitação</h2>
          {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm font-bold text-slate-700">
              Tipo
              <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as RequestType })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Departamento
              <select value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                {["Presidência", "Financeiro", "Esportes", "Eventos", "Marketing", "Produtos", "Patrimônio"].map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700 md:col-span-2">
              Descrição
              <input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" placeholder="Ex.: Pagamento do técnico de vôlei — outubro" />
            </label>

            <label className="block text-sm font-bold text-slate-700 md:col-span-2">
              Justificativa
              <textarea value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" rows={2} />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Valor previsto (R$)
              <input type="number" step="0.01" value={form.valuePlanned} onChange={(event) => setForm({ ...form, valuePlanned: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Favorecido
              <input value={form.favorecido} onChange={(event) => setForm({ ...form, favorecido: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Vencimento
              <input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" />
            </label>

            <label className="block text-sm font-bold text-slate-700">
              Prioridade
              <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Req["priority"] })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500">
                <option value="BAIXA">Baixa</option>
                <option value="MEDIA">Média</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </label>

            <label className="block text-sm font-bold text-slate-700 md:col-span-2">
              Anexos
              <input
                type="file"
                onChange={(event) => { const file = event.target.files?.[0]; if (file) uploadFile(file); event.target.value = ""; }}
                disabled={uploading}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
              />
              {uploading && <span className="mt-1 block text-xs text-slate-500">Enviando...</span>}
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((a) => (
                    <li key={a.url} className="flex items-center gap-1 text-xs text-blue-700"><Paperclip size={12} /> {a.name}</li>
                  ))}
                </ul>
              )}
            </label>

            <label className="block text-sm font-bold text-slate-700 md:col-span-2">
              Observações
              <textarea value={form.observations} onChange={(event) => setForm({ ...form, observations: event.target.value })} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-500" rows={2} />
            </label>
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <button type="button" disabled={saving} onClick={() => createRequest(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
              Salvar rascunho
            </button>
            <button type="button" disabled={saving} onClick={() => createRequest(true)} className="inline-flex items-center gap-2 rounded-xl bg-[#0b2265] px-4 py-2 text-sm font-bold text-white hover:bg-[#071745] disabled:opacity-50">
              <Plus size={16} /> Enviar solicitação
            </button>
          </div>
        </div>
        {isPresidencia && <p className="mt-3 text-xs text-slate-400">Como Presidência, você pode aprovar solicitações em qualquer etapa do fluxo.</p>}
      </div>
    </GestaoGuard>
  );
}
