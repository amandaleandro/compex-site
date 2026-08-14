"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Trophy, Clock, MapPin, Users, Activity, Search } from "lucide-react";
import { motion } from "framer-motion";

const modalities = [
  {
    id: "futsal-masc",
    name: "Futsal Masculino",
    category: "Quadra",
    coach: "Prof. Ricardo Silva",
    location: "Ginásio UFU - Quadra A",
    schedule: "Terças e Quintas: 20:00 - 22:00",
    description: "Treino focado em tática, movimentação e preparação para o Intercomp.",
    badge: "Campeão 2025"
  },
  {
    id: "futsal-fem",
    name: "Futsal Feminino",
    category: "Quadra",
    coach: "Profa. Amanda Lima",
    location: "Ginásio UFU - Quadra B",
    schedule: "Segundas e Quartas: 19:00 - 21:00",
    description: "Equipe técnica e forte. Treinamento de condicionamento e entrosamento.",
    badge: "Vice-Campeã 2025"
  },
  {
    id: "volei-misto",
    name: "Vôlei (Masc & Fem)",
    category: "Quadra",
    coach: "Prof. Marcos Andrade",
    location: "Ginásio UFU B",
    schedule: "Sábados: 14:00 - 17:00",
    description: "Fundamentos de saque, passe, bloqueio e partidas amistosas semanais.",
    badge: "Em Ascensão"
  },
  {
    id: "esports-valorant",
    name: "eSports - Valorant & LoL",
    category: "eSports",
    coach: "Coach Lucas",
    location: "Discord Oficial COMPEX UFU",
    schedule: "Quartas e Domingos: 21:00",
    description: "Análise de replays, estratégias e treinos contra outras atléticas.",
    badge: "Campeão E-Games"
  },
  {
    id: "peteca",
    name: "Peteca Mista",
    category: "Quadra",
    coach: "Prof. Gabriel",
    location: "Quadras Abertas UFU",
    schedule: "Sextas: 17:00 - 19:00",
    description: "Treinos abertos para todos os níveis de experiência.",
    badge: "Destaque UFU"
  }
];

export default function ModalidadesPage() {
  const [activeFilter, setActiveFilter] = useState("Todas");
  const [searchTerm, setSearchTerm] = useState("");

  const categories = ["Todas", "Quadra", "eSports"];

  const filtered = modalities.filter((m) => {
    const matchesCat = activeFilter === "Todas" || m.category === activeFilter;
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
      
      {/* Top Banner */}
      <section className="bg-gradient-to-r from-[#071745] via-[#0b2265] to-[#0f2c7a] rounded-3xl p-8 sm:p-12 text-white shadow-lg relative overflow-hidden">
        <div className="space-y-3">
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-300 block">
            MODALIDADES & TREINOS COMPEX
          </span>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">
            Esportes e Equipes <br />
            <span className="text-[#3b82f6]">da Computação e Exatas</span>
          </h1>
          <p className="text-slate-300 text-sm max-w-xl">
            Vista as cores da COMPEX. Confira os horários e locais dos treinos oficiais da Atlética.
          </p>
        </div>
      </section>

      {/* Controles de Filtro */}
      <div className="compex-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveFilter(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeFilter === cat
                  ? "bg-[#2563eb] text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar esporte..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-600"
          />
        </div>
      </div>

      {/* Grade de Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="compex-card p-6 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-lg">
                  {item.category}
                </span>
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  🏆 {item.badge}
                </span>
              </div>

              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                {item.name}
              </h3>

              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                {item.description}
              </p>

              <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{item.schedule}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{item.location}</span>
                </div>
              </div>
            </div>

            <Link href={`/modalidades/${item.id}`}
              className="w-full py-2.5 rounded-xl bg-[#0b2265] hover:bg-[#071745] text-white font-bold text-xs shadow-sm transition-colors text-center"
            >
              Participar dos Treinos
            </Link>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
