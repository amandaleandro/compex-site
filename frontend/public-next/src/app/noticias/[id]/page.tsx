import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";

const news = ["CompExatas confirma presença no Intercomp 2026", "Abertura dos treinos oficiais da temporada", "Novos parceiros garantem descontos em academias"];

export default async function NoticiaDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const title = news[Number(id) - 1] ?? "Notícia CompExatas";
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8"><Link href="/noticias" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15} /> Voltar para notícias</Link><article className="compex-card p-8 sm:p-12"><span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Comunicação CompExatas</span><h1 className="mt-4 text-4xl font-black leading-tight text-slate-900">{title}</h1><div className="mt-5 flex items-center gap-2 text-xs font-bold text-slate-400"><Calendar size={15} className="text-blue-700" /> 10 de setembro de 2026</div><div className="mt-8 border-t border-slate-100 pt-8 text-sm leading-7 text-slate-600"><p>A CompExatas segue construindo sua história com a participação dos estudantes de Computação e Exatas da UFU. Acompanhe esta atualização e fique por dentro das próximas atividades da Atlética.</p><p className="mt-4">Novas informações, horários e orientações serão publicados nos canais oficiais do portal.</p></div></article></div>;
}
