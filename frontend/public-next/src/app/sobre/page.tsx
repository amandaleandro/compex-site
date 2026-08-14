"use client";

import Link from "next/link";
import { ArrowRight, Heart, ShieldCheck, Trophy, Users, Target, Eye } from "lucide-react";
import { motion } from "framer-motion";

const values = [
  ["Espírito esportivo", "Garra, respeito e responsabilidade em cada treino e competição.", Trophy],
  ["Integração", "Conectamos estudantes de Computação, Engenharias e Exatas da UFU.", Users],
  ["Transparência", "Uma gestão próxima, organizada e aberta à comunidade acadêmica.", ShieldCheck],
  ["Paixão pelo manto", "Orgulho de representar nossas áreas dentro e fora do campus.", Heart],
];

export default function SobrePage() {
  return <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
    <section className="relative overflow-hidden rounded-[18px] bg-gradient-to-br from-[#071426] via-[#102653] to-[#1e40af] p-8 text-white sm:p-12"><div className="relative z-10 max-w-2xl"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-300">Desde 2005 representando as Exatas UFU</span><h1 className="mt-5 text-4xl font-black tracking-tight sm:text-6xl">Mais que uma atlética.<br /><span className="text-blue-400">Uma comunidade.</span></h1><p className="mt-5 max-w-xl text-sm leading-6 text-slate-300">A CompExatas existe para aproximar pessoas, incentivar o esporte universitário e criar experiências que ficam para a vida.</p></div></section>
    <section className="grid gap-6 lg:grid-cols-[1.25fr_.75fr]">
      <article className="compex-card p-7 sm:p-9"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-700">Sobre a Atlética</span><h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Representatividade, esporte e integração</h2><div className="mt-5 space-y-4 text-sm leading-7 text-slate-600"><p>A Associação Atlética Acadêmica de Computação e Exatas da UFU reúne estudantes que acreditam que a universidade também se constrói nos encontros, nos treinos, nas arquibancadas e nas amizades.</p><p>Organizamos modalidades esportivas, eventos, ações de integração e benefícios para associados. Tudo isso com o compromisso de fortalecer a identidade das Exatas e dar espaço para que mais pessoas participem.</p></div><Link href="/cadastro" className="mt-7 inline-flex items-center gap-2 text-xs font-bold text-blue-700 hover:text-blue-900">Quero fazer parte <ArrowRight size={15} /></Link></article>
      <aside className="rounded-[14px] bg-[#0b1b3d] p-7 text-white sm:p-9"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-300">Nossa atuação</span><div className="mt-7 grid gap-6"><div className="flex gap-4"><Target className="mt-1 text-blue-400" size={22} /><div><h3 className="font-bold">Missão</h3><p className="mt-1 text-sm leading-6 text-slate-300">Promover esporte, pertencimento e oportunidades para a comunidade das Exatas.</p></div></div><div className="flex gap-4"><Eye className="mt-1 text-blue-400" size={22} /><div><h3 className="font-bold">Visão</h3><p className="mt-1 text-sm leading-6 text-slate-300">Ser uma atlética presente, inclusiva e reconhecida dentro da UFU.</p></div></div></div></aside>
    </section>
    <section><div className="mb-5"><span className="text-[10px] font-bold uppercase tracking-[.18em] text-blue-700">O que nos move</span><h2 className="mt-2 text-2xl font-black text-slate-900">Valores que vestimos</h2></div><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{values.map(([title, desc, Icon], i) => { const ValueIcon = Icon as typeof Trophy; return <motion.article key={i} whileHover={{ y: -3 }} className="compex-card p-6"><div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><ValueIcon size={21} /></div><h3 className="mt-5 font-bold text-slate-900">{title as string}</h3><p className="mt-2 text-xs leading-6 text-slate-500">{desc as string}</p></motion.article>; })}</div></section>
  </div>;
}
