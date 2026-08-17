"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Users,
  Star,
  ArrowUpRight,
  Gamepad2,
  Activity,
  Trophy,
  ArrowRight,
  Sparkles,
  Newspaper,
} from "lucide-react";
import { motion } from "framer-motion";
import { compexApi } from "@/lib/compex-api";

type HomeNews = { id: string; slug: string; title: string; summary: string | null; content: string };

export default function Home() {
  const [news, setNews] = useState<HomeNews[]>([]);

  useEffect(() => {
    compexApi<HomeNews[]>("/public-news?channel=HOME")
      .then((items) => setNews(items.slice(0, 1)))
      .catch(() => setNews([]));
  }, []);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      {/* 1. Hero Banner Principal (Azul Marinho UFU + Mascote Lobo) */}
      <section className="relative bg-gradient-to-r from-[#071745] via-[#0b2265] to-[#0f2c7a] rounded-3xl p-8 sm:p-12 text-white overflow-hidden shadow-lg">
        
        {/* Subtle grid lines background pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Main Text Content */}
          <div className="lg:col-span-7 space-y-6">
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300 block">
              ASSOCIAÇÃO ATLÉTICA ACADÊMICA
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-tight">
              esporte, integração <br />
              e gestão em um <br />
              <span className="text-[#3b82f6]">só lugar.</span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base max-w-xl leading-relaxed">
              Desde 2005 representando Computação e Exatas dentro e fora das quadras, unindo pessoas e construindo resultados.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/eventos"
                className="px-6 py-3 rounded-xl bg-[#2563eb] text-white font-bold text-xs hover:bg-blue-600 transition-colors shadow-md flex items-center gap-2"
              >
                <Calendar className="w-4 h-4" />
                Ver eventos
              </Link>
              
              <Link
                href="/cadastro"
                className="px-6 py-3 rounded-xl border border-white/20 hover:bg-white/10 text-white font-bold text-xs transition-colors flex items-center gap-2"
              >
                <Users className="w-4 h-4" />
                Se associar
              </Link>
            </div>
          </div>

          {/* Wolf Mascot Right Graphic */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="w-72 h-72 sm:w-80 sm:h-80 relative flex items-center justify-center">
              {/* Glow backdrop */}
              <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
              
              <img src="/compex-logo.png" alt="Mascote da CompExatas" className="relative z-10 h-64 w-64 object-contain drop-shadow-[0_25px_35px_rgba(0,4,20,.55)] sm:h-80 sm:w-80" />
            </div>
          </div>

        </div>
      </section>

      {/* 2. Banner Evento em Destaque (Intercomp 2026) */}
      <section className="bg-[#071745] rounded-3xl p-6 sm:p-8 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-sm border border-slate-800">
        <div className="space-y-2 text-center sm:text-left">
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block">
            EVENTO EM DESTAQUE
          </span>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
            Intercomp 2026
          </h2>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-300 pt-1">
            <span>Uberlândia, MG</span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              20 SET
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] font-bold text-slate-300 block uppercase">
              COMPEXATAS UFU
            </span>
          </div>
          <Link
            href="/eventos"
            className="w-16 h-16 rounded-2xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 flex flex-col items-center justify-center font-bold text-[10px] transition-transform hover:scale-105 shadow-md"
          >
            <ArrowUpRight className="w-5 h-5 mb-0.5" />
            VER EVENTO
          </Link>
        </div>
      </section>

      {/* 3. Métricas Principais (Cards Brancos com Número Grande) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Card 1 */}
        <div className="compex-card p-6 flex flex-col justify-between space-y-6 relative overflow-hidden group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              EVENTOS PUBLICADOS
            </span>
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              1
            </div>
          </div>
          <Link href="/eventos" className="absolute bottom-6 right-6 text-slate-400 group-hover:text-blue-600 transition-colors">
            <ArrowUpRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Card 2 */}
        <div className="compex-card p-6 flex flex-col justify-between space-y-6 relative overflow-hidden group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              ASSOCIADOS ATIVOS
            </span>
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              2
            </div>
          </div>
          <Link href="/beneficios" className="absolute bottom-6 right-6 text-slate-400 group-hover:text-blue-600 transition-colors">
            <ArrowUpRight className="w-5 h-5" />
          </Link>
        </div>

        {/* Card 3 */}
        <div className="compex-card p-6 flex flex-col justify-between space-y-6 relative overflow-hidden group">
          <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Star className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              ANOS DE HISTÓRIA
            </span>
            <div className="text-4xl font-black text-slate-900 tracking-tight">
              05+
            </div>
          </div>
          <Link href="/sobre" className="absolute bottom-6 right-6 text-slate-400 group-hover:text-blue-600 transition-colors">
            <ArrowUpRight className="w-5 h-5" />
          </Link>
        </div>

      </section>

      {/* 4. Grade de Seções Inferiores (Próximos Eventos, Modalidades, Parceiros) */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Próximos Eventos (4 cols) */}
        <div className="lg:col-span-4 compex-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Próximos eventos</h3>
            <Link href="/eventos" className="text-xs font-semibold text-blue-600 hover:underline px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
              Ver todos
            </Link>
          </div>

          <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <div className="bg-white border border-slate-200 rounded-xl p-2.5 text-center min-w-[56px]">
              <span className="block text-base font-black text-blue-600 leading-none">20</span>
              <span className="block text-[9px] font-bold text-slate-400 uppercase mt-0.5">SET</span>
            </div>
            <div>
              <h4 className="font-bold text-slate-900 text-sm leading-snug">Intercomp 2026</h4>
              <p className="text-xs text-slate-500">Campeonato · Uberlândia, MG</p>
            </div>
          </div>
        </div>

        {/* Modalidades (5 cols) */}
        <div className="lg:col-span-5 compex-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Modalidades</h3>
            <Link href="/modalidades" className="text-xs font-semibold text-blue-600 hover:underline px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
              Ver todas
            </Link>
          </div>

          <div className="grid grid-cols-4 gap-3">
            {[
              { name: "E-sports", icon: Gamepad2 },
              { name: "Futsal", icon: Activity },
              { name: "Peteca", icon: Trophy },
              { name: "Vôlei", icon: Activity },
            ].map((m, idx) => {
              const Icon = m.icon;
              return (
                <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-center space-y-2 hover:border-blue-300 transition-colors">
                  <Icon className="w-5 h-5 text-blue-600 mx-auto" />
                  <span className="text-[11px] font-bold text-slate-700 block">{m.name}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Parceiros (3 cols) */}
        <div className="lg:col-span-3 compex-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Parceiros</h3>
            <Link href="/beneficios" className="text-xs font-semibold text-blue-600 hover:underline px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
              Ver todos
            </Link>
          </div>

          <div className="py-6 text-center text-xs text-slate-400 space-y-2">
            <p>Nenhum parceiro cadastrado ainda.</p>
            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
              <ArrowRight className="w-4 h-4" />
            </div>
          </div>
        </div>

      </section>

      {/* 5. Notícias e Resultados */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Notícias (5 cols) */}
        <div className="lg:col-span-5 compex-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Notícias</h3>
            <Link href="/noticias" className="text-xs font-semibold text-blue-600 hover:underline px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
              Ver todas
            </Link>
          </div>

          {news.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-400">Nenhuma notícia publicada ainda.</div>
          ) : (
            news.map((item) => (
              <div key={item.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-3 flex items-start gap-4">
                <div className="w-16 h-16 rounded-xl bg-navy-dark text-amber-400 flex items-center justify-center text-2xl shrink-0">
                  <Newspaper className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-bold text-slate-900 text-xs leading-snug">{item.title}</h4>
                  <p className="text-[11px] text-slate-500 leading-normal">{item.summary || item.content.slice(0, 110)}</p>
                  <Link href={`/noticias/${item.slug}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline pt-1">
                    Ler notícia <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Resultados (7 cols) */}
        <div className="lg:col-span-7 compex-card p-6 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-base">Resultados</h3>
            <Link href="/modalidades" className="text-xs font-semibold text-blue-600 hover:underline px-3 py-1 bg-slate-50 rounded-lg border border-slate-200">
              Ver todos
            </Link>
          </div>

          <div className="py-10 text-center text-xs text-slate-400">
            Nenhum resultado cadastrado ainda.
          </div>
        </div>

      </section>

      <section className="grid gap-6 rounded-[14px] border border-blue-100 bg-blue-50/70 p-7 sm:p-9 lg:grid-cols-[1.2fr_.8fr] lg:items-center">
        <div>
          <span className="text-[10px] font-black uppercase tracking-widest text-blue-700">Sobre a Atlética</span>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-slate-900">Esporte, pertencimento e história nas Exatas</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">A CompExatas representa estudantes de Computação, Engenharias e Exatas da UFU. Promovemos treinos, eventos e experiências que aproximam a comunidade acadêmica.</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end"><Link href="/sobre" className="inline-flex items-center gap-2 rounded-lg bg-[#0b1b3d] px-5 py-3 text-xs font-bold text-white hover:bg-blue-900">Conheça nossa história <ArrowRight size={15} /></Link><Link href="/cadastro" className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-5 py-3 text-xs font-bold text-blue-800 hover:bg-blue-100">Faça parte</Link></div>
      </section>

    </div>
  );
}
