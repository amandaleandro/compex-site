"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ShoppingBag, Tag, ShieldCheck, ArrowRight, Filter, Search } from "lucide-react";
import { motion } from "framer-motion";

const products = [
  {
    id: 1,
    name: "Camisa Oficial COMPEX 2026",
    price: "R$ 69,90",
    sócioPrice: "R$ 55,90",
    tag: "Mais Vendido",
    category: "Vestuário",
    imageEmoji: "👕",
    desc: "Tecido dry-fit premium tecnológico, escudo bordado e sublimação total com as cores da Atlética."
  },
  {
    id: 2,
    name: "Tirante Oficial COMPEX + Porta Caneca",
    price: "R$ 25,00",
    sócioPrice: "R$ 18,00",
    tag: "Lançamento",
    category: "Acessórios",
    imageEmoji: "🎗️",
    desc: "Tirante acetinado de 40mm extra resistente com mosquetão reforçado."
  },
  {
    id: 3,
    name: "Caneca Alumínio 850ml UFU",
    price: "R$ 45,00",
    sócioPrice: "R$ 35,00",
    tag: "Essencial",
    category: "Acessórios",
    imageEmoji: "🍺",
    desc: "Caneca térmica azul marinho com gravação do mascote Lobo a laser."
  },
  {
    id: 4,
    name: "Moletom Canguru Exatas UFU",
    price: "R$ 149,90",
    sócioPrice: "R$ 119,90",
    tag: "Edição Limitada",
    category: "Vestuário",
    imageEmoji: "🧥",
    desc: "Algodão peluciado de alta gramatura com capuz forrado e bolso frontal."
  },
  {
    id: 5,
    name: "Boné Strapback COMPEX",
    price: "R$ 59,90",
    sócioPrice: "R$ 49,90",
    tag: "Novo",
    category: "Acessórios",
    imageEmoji: "🧢",
    desc: "Boné modelo aba curva com bordado frontal em alto relevo."
  },
  {
    id: 6,
    name: "Squeeze Térmico Inox 750ml",
    price: "R$ 39,90",
    sócioPrice: "R$ 29,90",
    tag: "Treino",
    category: "Acessórios",
    imageEmoji: "🍼",
    desc: "Garrafa de hidratação livre de BPA, ideal para levar aos treinos da Atlética."
  }
];

export default function LojaPage() {
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");

  const categories = ["Todos", "Vestuário", "Acessórios"];

  const filteredProducts = products.filter((p) => {
    const matchesCat = activeCategory === "Todos" || p.category === activeCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Banner da Loja */}
      <section className="bg-gradient-to-r from-[#071745] to-[#0b2265] rounded-3xl p-8 sm:p-10 text-white flex flex-col sm:flex-row items-center justify-between gap-6 shadow-md border border-slate-800">
        <div className="space-y-3 text-center sm:text-left">
          <span className="text-[11px] font-black uppercase tracking-widest text-slate-300 block">
            PRODUTOS OFICIAIS COMPEX UFU
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Loja Oficial da Atlética
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
            Vista o manto da Computação e Exatas. Descontos exclusivos garantidos para todos os associados ativos.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black text-2xl shadow-lg">
            🛍️
          </div>
        </div>
      </section>

      {/* Filtros e Busca */}
      <div className="compex-card p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeCategory === cat
                  ? "bg-navy text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-navy"
          />
        </div>
      </div>

      {/* Grid de Produtos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map((item) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="compex-card p-6 flex flex-col justify-between space-y-5"
          >
            <div className="space-y-4">
              
              {/* Product Card Image Container */}
              <div className="h-48 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center relative overflow-hidden group">
                <span className="text-6xl group-hover:scale-110 transition-transform duration-300">
                  {item.imageEmoji}
                </span>
                <span className="absolute top-3 right-3 bg-navy text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                  {item.tag}
                </span>
              </div>

              <div className="space-y-1.5">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                  {item.category}
                </span>
                <h3 className="text-base font-bold text-slate-900 leading-snug">
                  {item.name}
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {item.desc}
                </p>
              </div>

              {/* Tabela de Preço Sócio vs Não Sócio */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Preço regular:</span>
                  <span className="line-through">{item.price}</span>
                </div>
                <div className="flex items-center justify-between text-sm font-extrabold text-navy pt-0.5">
                  <span className="flex items-center gap-1 text-xs text-lime-accent font-black">
                    <ShieldCheck className="w-4 h-4 text-lime-accent" /> Preço Sócio:
                  </span>
                  <span className="text-base font-black text-blue-600">{item.sócioPrice}</span>
                </div>
              </div>

            </div>

            <Link href={`/loja/${item.id}`}
              className="w-full py-3 rounded-xl bg-[#0b2265] hover:bg-[#071745] text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Garantir Produto
            </Link>
          </motion.div>
        ))}
      </div>

    </div>
  );
}
