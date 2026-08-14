import Link from "next/link";
import { ArrowLeft, Check, ShoppingBag } from "lucide-react";

const products = ["Camisa Oficial CompExatas 2026", "Tirante Oficial CompExatas + Porta Caneca", "Caneca Alumínio 850ml UFU", "Moletom Canguru Exatas UFU", "Boné Strapback CompExatas", "Squeeze Térmico Inox 750ml"];

export default async function ProdutoDetalhe({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const name = products[Number(id) - 1] ?? "Produto oficial CompExatas";
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
    <Link href="/loja" className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-blue-700"><ArrowLeft size={15} /> Voltar para loja</Link>
    <article className="compex-card grid gap-8 p-8 sm:grid-cols-[.8fr_1.2fr] sm:p-12"><div className="grid min-h-64 place-items-center rounded-2xl bg-slate-100 text-7xl">🛍️</div><div><span className="text-[10px] font-bold uppercase tracking-widest text-blue-700">Produto oficial</span><h1 className="mt-4 text-3xl font-black text-slate-900">{name}</h1><p className="mt-4 text-sm leading-6 text-slate-600">Produto oficial da Atlética CompExatas. Consulte disponibilidade e reserve diretamente com a diretoria.</p><div className="mt-6 grid gap-3 text-sm text-slate-600"><span className="flex gap-2"><Check className="text-blue-700" size={18} /> Condição especial para associados</span><span className="flex gap-2"><Check className="text-blue-700" size={18} /> Retirada em Uberlândia</span></div><Link href="/cadastro" className="mt-8 inline-flex items-center gap-2 rounded-lg bg-[#0b1b3d] px-5 py-3 text-xs font-bold text-white"><ShoppingBag size={16} /> Fazer meu cadastro</Link></div></article>
  </div>;
}
