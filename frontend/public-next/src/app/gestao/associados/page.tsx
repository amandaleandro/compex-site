"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Search, Users, X } from "lucide-react";
import GestaoGuard from "@/components/gestao/GestaoGuard";
import { compexApi } from "@/lib/compex-api";

type MemberStatus = "active" | "pending" | "expired";
type MemberKind = "SOCIO" | "AVULSO";

type Member = {
  id: string;
  name: string;
  email: string;
  course: string;
  plan: string;
  status: MemberStatus;
  membershipKind: MemberKind;
  pendingCharges: number;
  teams: string[];
  createdAt: string;
};

const statusConfig: Record<MemberStatus, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-emerald-50 text-emerald-700" },
  pending: { label: "Pendente", className: "bg-amber-50 text-amber-700" },
  expired: { label: "Vencido", className: "bg-red-50 text-red-700" },
};

const kindConfig: Record<MemberKind, string> = {
  SOCIO: "Sócio",
  AVULSO: "Avulso",
};

type MemberCharge = {
  id: string;
  amountCents: number;
  breakdown: string;
  status: string;
  teamName: string;
  sessionType: string;
  sessionDate: string;
  createdAt: string;
};

type MemberDetail = Member & {
  socialName: string | null;
  nickname: string | null;
  instagram: string | null;
  teams: { teamId: string; teamName: string; gender: string }[] | string[];
  charges: MemberCharge[];
};

const money = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function AssociadosPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | MemberStatus>("all");
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MemberDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError("");
      try {
        const result = await compexApi<MemberDetail>(`/members?id=${selectedId}`);
        setDetail(result);
      } catch (reason) {
        setDetailError(reason instanceof Error ? reason.message : "Não foi possível carregar o associado.");
      } finally {
        setDetailLoading(false);
      }
    };
    loadDetail();
  }, [selectedId]);

  useEffect(() => {
    const loadMembers = async () => {
      try {
        const result = await compexApi<Member[]>("/members");
        setMembers(Array.isArray(result) ? result : []);
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar os associados.");
      } finally {
        setLoading(false);
      }
    };

    loadMembers();
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return members.filter((member) => {
      const matchesStatus = status === "all" || member.status === status;
      const matchesQuery = !query || [member.name, member.email, member.course, member.teams.join(" ")].some((value) => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [members, search, status]);

  const stats = useMemo(() => ({
    total: members.length,
    active: members.filter((member) => member.status === "active").length,
    pending: members.filter((member) => member.status === "pending").length,
    withCharges: members.filter((member) => member.pendingCharges > 0).length,
  }), [members]);

  return (
    <GestaoGuard allow={["PRESIDENCIA", "FINANCEIRO", "ESPORTES", "EVENTOS", "MARKETING", "PRODUTOS", "PATRIMONIO"]}>
      <div className="mx-auto max-w-7xl px-6 py-7 sm:px-9">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Gestão</span>
            <h1 className="mt-1 text-2xl font-black text-slate-900">Associados</h1>
            <p className="text-sm text-slate-500">Painel operacional com resumo da base de sócios e status da associação.</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">
            <Users size={16} className="text-blue-700" />
            <span>{stats.total} registros</span>
          </div>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Ativos</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{stats.active}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Pendentes</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{stats.pending}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Cobranças</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{stats.withCharges}</strong>
          </div>
          <div className="compex-card p-4">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Total</p>
            <strong className="mt-2 block text-2xl font-black text-slate-900">{stats.total}</strong>
          </div>
        </div>

        <div className="compex-card mb-6 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar por nome, curso ou modalidade"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-700 outline-none ring-0 transition focus:border-blue-500 focus:bg-white"
              />
            </div>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | MemberStatus)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="pending">Pendentes</option>
              <option value="expired">Vencidos</option>
            </select>
          </div>
        </div>

        <div className="compex-card overflow-hidden">
          {loading ? (
            <div className="flex min-h-[220px] items-center justify-center gap-2 text-sm text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" />
              Carregando associados...
            </div>
          ) : error ? (
            <div className="flex min-h-[220px] items-center justify-center px-6 text-sm font-medium text-red-600">{error}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-5 py-3">Associado</th>
                    <th className="px-5 py-3">Curso</th>
                    <th className="px-5 py-3">Tipo</th>
                    <th className="px-5 py-3">Modalidades</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Cobranças</th>
                    <th className="px-5 py-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-sm text-slate-500">
                        Nenhum associado encontrado para a busca atual.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member) => (
                      <tr key={member.id} className="border-t border-slate-100">
                        <td className="px-5 py-4">
                          <div>
                            <div className="font-bold text-slate-900">{member.name}</div>
                            <div className="text-xs text-slate-500">{member.email}</div>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-slate-700">{member.course || "—"}</td>
                        <td className="px-5 py-4 text-slate-700">{kindConfig[member.membershipKind] || member.membershipKind}</td>
                        <td className="px-5 py-4 text-slate-700">
                          {member.teams.length > 0 ? member.teams.join(", ") : <span className="text-slate-400">Sem vínculo</span>}
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusConfig[member.status].className}`}>
                            {statusConfig[member.status].label}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-slate-700">
                            <span className="font-semibold">{member.pendingCharges}</span>
                            {member.pendingCharges > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">pendente</span>}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <button type="button" onClick={() => setSelectedId(member.id)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50">
                            Ver detalhes
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selectedId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={() => setSelectedId(null)}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between">
              <h2 className="text-lg font-black text-slate-900">Detalhes do associado</h2>
              <button type="button" onClick={() => setSelectedId(null)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 hover:bg-slate-50">
                <X size={16} />
              </button>
            </div>

            {detailLoading ? (
              <div className="flex min-h-[160px] items-center justify-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : detailError ? (
              <p className="text-sm font-medium text-red-600">{detailError}</p>
            ) : detail ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Nome</p>
                    <p className="font-bold text-slate-900">{detail.name}{detail.nickname ? ` (${detail.nickname})` : ""}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">E-mail</p>
                    <p className="text-slate-800">{detail.email}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Curso</p>
                    <p className="text-slate-800">{detail.course || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Plano</p>
                    <p className="text-slate-800">{detail.plan} · {kindConfig[detail.membershipKind] || detail.membershipKind}</p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Status</p>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${statusConfig[detail.status].className}`}>
                      {statusConfig[detail.status].label}
                    </span>
                  </div>
                  {detail.instagram && (
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Instagram</p>
                      <p className="text-slate-800">@{detail.instagram}</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Modalidades</p>
                  {detail.teams.length === 0 ? (
                    <p className="text-sm text-slate-500">Sem vínculo com modalidades.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {detail.teams.map((team: any) => (
                        <span key={team.teamId || team} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">
                          {team.teamName || team}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">Cobranças</p>
                  {detail.charges.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma cobrança registrada.</p>
                  ) : (
                    <div className="space-y-2">
                      {detail.charges.map((charge) => (
                        <div key={charge.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                          <div>
                            <div className="font-bold text-slate-900">{charge.teamName} · {charge.sessionType}</div>
                            <div className="text-[11px] text-slate-500">{charge.breakdown} · {new Date(charge.sessionDate).toLocaleDateString("pt-BR")}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-black text-slate-900">{money(charge.amountCents)}</div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${charge.status === "paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                              {charge.status === "paid" ? "Pago" : "Pendente"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </GestaoGuard>
  );
}
