import Link from "next/link";
import { Instagram, Mail, MapPin, ArrowUpRight } from "lucide-react";

const links = [
  ["Sobre a Atlética", "/sobre"],
  ["Eventos", "/eventos"],
  ["Modalidades", "/modalidades"],
  ["Benefícios", "/beneficios"],
];

export default function Footer() {
  return (
    <footer className="mt-12 bg-[#081426] text-slate-300">
      <div className="mx-auto grid w-full max-w-[1440px] gap-10 px-6 py-11 sm:px-8 md:grid-cols-2 lg:grid-cols-[1.25fr_.65fr_1fr] lg:gap-16 lg:px-12 xl:px-16">
        <div className="md:col-span-2 lg:col-span-1">
          <Link href="/" className="mb-5 flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white text-xs font-black text-[#081426]">CX</span>
            <span><b className="block text-sm tracking-wide text-white">COMPEXATAS</b><small className="text-[10px] font-bold tracking-[.25em] text-blue-300">UFU</small></span>
          </Link>
          <p className="max-w-md text-sm leading-6 text-slate-400">A Associação Atlética Acadêmica que representa Computação e Exatas dentro e fora das quadras.</p>
          <Link href="/cadastro" className="mt-6 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-xs font-bold text-white hover:bg-blue-500">Faça parte da CompExatas <ArrowUpRight size={15} /></Link>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Portal público</h3>
          <nav className="grid gap-3 text-sm">{links.map(([label, href]) => <Link className="text-slate-400 transition hover:text-white" key={href} href={href}>{label}</Link>)}</nav>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-white">Fale com a gente</h3>
          <div className="grid gap-3 text-sm text-slate-400"><span className="flex items-center gap-3"><MapPin size={16} className="shrink-0 text-blue-400" /> Uberlândia, MG · UFU</span><a className="flex items-center gap-3 hover:text-white" href="mailto:contato@compexatas.com.br"><Mail size={16} className="shrink-0 text-blue-400" /> contato@compexatas.com.br</a><a className="flex items-center gap-3 hover:text-white" href="https://instagram.com/compexatas" target="_blank" rel="noreferrer"><Instagram size={16} className="shrink-0 text-blue-400" /> @compexatas</a></div>
        </div>
      </div>
      <div className="border-t border-white/10"><div className="mx-auto flex w-full max-w-[1440px] flex-col gap-2 px-6 py-5 text-[11px] text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-12 xl:px-16"><span>Esporte · Integração · Universidade</span><span>© {new Date().getFullYear()} CompExatas. Todos os direitos reservados.</span></div></div>
    </footer>
  );
}
