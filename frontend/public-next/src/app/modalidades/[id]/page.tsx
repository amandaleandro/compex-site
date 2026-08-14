import Link from "next/link";
import { ArrowLeft, CalendarDays, MapPin, UserRound } from "lucide-react";

export default async function ModalidadeDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const names: Record<string, string> = { "futsal-masc": "Futsal Masculino", "futsal-fem": "Futsal Feminino", "volei-misto": "Vôlei Misto", "esports-valorant": "eSports — Valorant & LoL", peteca: "Peteca Mista" };
  const name = names[id] ?? "Modalidade CompExatas";
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/modalidades" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15} /> Voltar para modalidades</Link>
    <article className="compex-card overflow-hidden"><div className="bg-gradient-to-r from-[#071745] to-[#1e40af] p-8 text-white sm:p-12"><span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Treinos oficiais</span><h1 className="mt-4 text-4xl font-black">{name}</h1><p className="mt-4 text-sm leading-6 text-slate-300">Faça parte da equipe e acompanhe a rotina de treinos da Atlética.</p></div><div className="grid gap-4 p-8 sm:grid-cols-3"><div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><CalendarDays className="mb-2 text-blue-700" size={19} /> Terças e quintas<br />20h às 22h</div><div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><MapPin className="mb-2 text-blue-700" size={19} /> Ginásio UFU<br />Quadra principal</div><div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><UserRound className="mb-2 text-blue-700" size={19} /> Treinos abertos<br />aos associados</div></div><div className="border-t border-slate-100 p-8"><Link href="/cadastro" className="inline-flex rounded-lg bg-[#0b1b3d] px-5 py-3 text-xs font-bold text-white">Quero participar dos treinos</Link></div></article>
  </div>;
}
