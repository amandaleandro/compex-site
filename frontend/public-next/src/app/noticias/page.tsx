"use client";

import React from "react";
import Link from "next/link";
import { Newspaper, Calendar, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

const news = [
  {
    id: 1,
    title: "COMPEX confirma presença no Intercomp 2026",
    date: "10 SET, 2026",
    category: "Campeonato",
    summary: "Nossa equipe já está se preparando para viver mais uma grande edição do campeonato esportivo das exatas."
  },
  {
    id: 2,
    title: "Abertura dos Treinos Oficiais da Temporada",
    date: "02 SET, 2026",
    category: "Treinos",
    summary: "Todos os alunos matriculados nos cursos de exatas da UFU podem participar das seletivas de futsal, vôlei e eSports."
  },
  {
    id: 3,
    title: "Novos Parceiros Garantem Descontos em Academias",
    date: "25 AGO, 2026",
    category: "Benefícios",
    summary: "A diretoria firmou acordo com novos estabelecimentos na região universitária oferecendo até 25% OFF para sócios."
  }
];

export default function NoticiasPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Top Banner */}
      <section className="bg-gradient-to-r from-[#071745] via-[#0b2265] to-[#0f2c7a] rounded-3xl p-8 sm:p-12 text-white shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block">
            COMUNICAÇÃO & NOTÍCIAS COMPEX
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Fique por Dentro <br />
            <span className="text-[#3b82f6]">das Novidades da UFU</span>
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            Acompanhe os resultados das competições, anúncios da diretoria e comunicados oficiais.
          </p>
        </div>
      </section>

      {/* Grid de Notícias */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {news.map((n) => (
          <motion.div
            key={n.id}
            whileHover={{ y: -4 }}
            className="compex-card p-6 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-lg">
                {n.category}
              </span>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                {n.title}
              </h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {n.summary}
              </p>
              <div className="flex items-center gap-2 text-xs text-slate-400 pt-2 border-t border-slate-100 font-bold">
                <Calendar className="w-3.5 h-3.5 text-blue-600" />
                <span>{n.date}</span>
              </div>
            </div>

            <Link href={`/noticias/${n.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline pt-2"
            >
              Ler matéria <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
