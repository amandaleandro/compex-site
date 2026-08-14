import Link from "next/link";
import { ArrowLeft, Calendar, MapPin, Users } from "lucide-react";

const events = ["Intercomp 2026", "Cervejada de Recepção 2026.1", "Assembleia Geral de Atletas"];

export default async function EventoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const title = events[Number(id) - 1] ?? "Evento CompExatas";
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/eventos" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15} /> Voltar para eventos</Link>
    <article className="compex-card overflow-hidden"><div className="bg-gradient-to-r from-[#071745] to-[#1e40af] p-8 text-white sm:p-12"><span className="text-[10px] font-bold uppercase tracking-widest text-blue-200">Evento CompExatas</span><h1 className="mt-4 text-4xl font-black sm:text-5xl">{title}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-slate-300">Confira as informações, horários e orientações para participar deste evento da Atlética.</p></div><div className="grid gap-5 p-8 text-sm text-slate-600 sm:grid-cols-3"><span className="flex items-center gap-2"><Calendar className="text-blue-700" size={18} /> 20 de setembro de 2026</span><span className="flex items-center gap-2"><MapPin className="text-blue-700" size={18} /> Uberlândia, MG</span><span className="flex items-center gap-2"><Users className="text-blue-700" size={18} /> Comunidade CompExatas</span></div><div className="border-t border-slate-100 p-8"><h2 className="text-xl font-black text-slate-900">Como participar</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">As inscrições e os detalhes finais são divulgados pela diretoria conforme a programação. Para receber avisos, faça seu cadastro ou acompanhe nossas notícias.</p><Link href="/cadastro" className="mt-6 inline-flex rounded-lg bg-[#0b1b3d] px-5 py-3 text-xs font-bold text-white">Quero participar</Link></div></article>
  </div>;
}
