"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  Calendar, 
  Trophy, 
  PartyPopper, 
  Users, 
  ArrowUpRight, 
  Sparkles 
} from "lucide-react";
import { motion } from "framer-motion";

const events = [
  {
    id: 1,
    title: "Intercomp 2026",
    category: "Campeonato",
    dateDay: "20",
    dateMonth: "SET",
    location: "Uberlândia, MG",
    description: "O maior encontro esportivo da Computação e Exatas.",
    linkText: "Ir para o BoraFest ↗",
    externalLink: "#"
  },
  {
    id: 2,
    title: "Cervejada de Recepção 2026.1",
    category: "Festas",
    dateDay: "12",
    dateMonth: "OUT",
    location: "Campus UFU Santa Mônica",
    description: "Festa oficial de boas-vindas aos calouros das Exatas.",
    linkText: "Ver detalhes ↗",
    externalLink: "#"
  },
  {
    id: 3,
    title: "Assembleia Geral de Atletas",
    category: "Reuniões",
    dateDay: "05",
    dateMonth: "NOV",
    location: "Bloco 1B - Auditório Exatas",
    description: "Alinhamento de horários de treinos e calendário de jogos.",
    linkText: "Confirmar presença ↗",
    externalLink: "#"
  }
];

export default function EventosPage() {
  const [activeFilter, setActiveFilter] = useState("Todos");

  const categories = [
    { name: "Todos", icon: Calendar },
    { name: "Campeonatos", icon: Trophy },
    { name: "Festas", icon: PartyPopper },
    { name: "Reuniões", icon: Users },
  ];

  const filteredEvents = events.filter((e) => {
    if (activeFilter === "Todos") return true;
    if (activeFilter === "Campeonatos") return e.category === "Campeonato";
    if (activeFilter === "Festas") return e.category === "Festas";
    if (activeFilter === "Reuniões") return e.category === "Reuniões";
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Hero Banner do topo (Igual à imagem) */}
      <section className="relative bg-gradient-to-r from-[#071745] via-[#0b2265] to-[#0f2c7a] rounded-3xl p-8 sm:p-12 text-white overflow-hidden shadow-lg">
        
        {/* Pattern de fundo */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Lado Esquerdo - Título & Descrição */}
          <div className="lg:col-span-7 space-y-4">
            <h1 className="text-4xl sm:text-6xl font-black tracking-tight leading-none">
              Viva tudo <br />
              <span className="text-[#3b82f6]">de perto.</span>
            </h1>

            <p className="text-slate-300 text-sm sm:text-base max-w-xl leading-relaxed">
              Confira os próximos eventos da CompExatas. <br />
              Inscrições e informações em um só lugar.
            </p>
          </div>

          {/* Lado Direito - Emblema do Mascote */}
          <div className="lg:col-span-5 flex justify-center relative">
            <div className="w-64 h-64 sm:w-72 sm:h-72 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-blue-500/20 blur-3xl rounded-full" />
              
              <div className="relative z-10 border-4 border-slate-900 bg-[#071745] p-6 rounded-3xl text-center shadow-2xl space-y-2 transform rotate-1">
                <div className="w-20 h-20 mx-auto rounded-full bg-slate-900 flex items-center justify-center text-3xl font-black text-cyan-400 border-2 border-cyan-400">
                  🐺
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] font-black tracking-widest text-slate-300 block uppercase">
                    ATLÉTICA
                  </span>
                  <span className="text-lg font-black text-white block uppercase tracking-tight">
                    COMPUTAÇÃO
                  </span>
                  <span className="text-lg font-black text-white block uppercase tracking-tight">
                    EXATAS
                  </span>
                  <span className="text-[10px] font-bold text-cyan-400 block tracking-widest uppercase">
                    UFU
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* Seção Próximos Eventos */}
      <div className="space-y-6">
        
        {/* Título & Filtros Pill (Igual à imagem) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Próximos eventos
          </h2>

          <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isActive = activeFilter === cat.name;
              return (
                <button
                  key={cat.name}
                  onClick={() => setActiveFilter(cat.name)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    isActive
                      ? "bg-[#2563eb] text-white shadow-sm"
                      : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {cat.name}
                </button>
              );
            })}
          </div>

          <span className="text-xs font-bold text-slate-400 self-end sm:self-center">
            {filteredEvents.length} cadastrado{filteredEvents.length !== 1 && "s"}
          </span>
        </div>

        {/* Lista de Cards de Eventos */}
        <div className="space-y-4">
          {filteredEvents.map((item) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="compex-card p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
            >
              <div className="flex items-center gap-6 w-full sm:w-auto">
                
                {/* Quadrado da Data em Azul (20 SET) */}
                <div className="w-24 h-24 rounded-2xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center shrink-0">
                  <span className="text-3xl font-black text-blue-600 leading-none">
                    {item.dateDay}
                  </span>
                  <span className="text-xs font-black text-blue-600 uppercase mt-1 tracking-widest">
                    {item.dateMonth}
                  </span>
                </div>

                {/* Info do Evento */}
                <div className="space-y-1">
                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest block">
                    {item.category}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">
                    {item.title}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    {item.location} · {item.description}
                  </p>
                </div>

              </div>

              {/* Botão Escuro 'Ir para o BoraFest ↗' */}
              <Link href={`/eventos/${item.id}`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#0b2265] hover:bg-[#071745] text-white font-bold text-xs transition-colors shrink-0 shadow-sm text-center"
              >
                {item.linkText}
              </Link>
            </motion.div>
          ))}
        </div>

      </div>

    </div>
  );
}
