"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingBag, Search, LoaderCircle, PackageX } from "lucide-react";
import { motion } from "framer-motion";
import { compexApi } from "@/lib/compex-api";

type Product = {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  priceCents: number;
  category: string;
  stock: number;
};

const formatPrice = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function LojaPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategory, setActiveCategory] = useState("Todos");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    compexApi<Product[]>("/products")
      .then((items) => { setProducts(Array.isArray(items) ? items : []); setError(""); })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar a loja."))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => ["Todos", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))], [products]);

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
            PRODUTOS OFICIAIS COMPEXATAS
          </span>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight">
            Loja Oficial da Atlética
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm max-w-xl">
            Vista o manto da Computação e Exatas. Associados têm condições especiais — faça login para conferir.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 text-slate-800 flex items-center justify-center font-black text-2xl shadow-lg">
            🛍️
          </div>
        </div>
      </section>

      {/* Filtros e Busca */}
      {!loading && !error && products.length > 0 && (
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
      )}

      {loading && (
        <div className="compex-card p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <LoaderCircle className="w-6 h-6 animate-spin" />
          <p className="text-xs font-bold">Carregando produtos...</p>
        </div>
      )}

      {!loading && error && (
        <div className="compex-card p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <PackageX className="w-6 h-6" />
          <p className="text-xs font-bold">{error}</p>
          <button onClick={() => window.location.reload()} className="text-xs font-bold text-blue-700 underline">Tentar novamente</button>
        </div>
      )}

      {!loading && !error && products.length === 0 && (
        <div className="compex-card p-12 flex flex-col items-center justify-center gap-3 text-slate-500">
          <PackageX className="w-6 h-6" />
          <p className="text-xs font-bold">Nenhum produto disponível no momento.</p>
        </div>
      )}

      {/* Grid de Produtos */}
      {!loading && !error && filteredProducts.length > 0 && (
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
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  ) : (
                    <span className="text-6xl group-hover:scale-110 transition-transform duration-300">🛍️</span>
                  )}
                  {item.stock <= 0 && (
                    <span className="absolute top-3 right-3 bg-slate-700 text-white text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider">
                      Esgotado
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
                    {item.category}
                  </span>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    {item.name}
                  </h3>
                  {item.description && (
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {item.description}
                    </p>
                  )}
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-xs text-slate-500">Preço:</span>
                  <span className="text-base font-black text-blue-600">{formatPrice(item.priceCents)}</span>
                </div>

              </div>

              <Link href={`/loja/${item.id}`}
                className="w-full py-3 rounded-xl bg-[#0b2265] hover:bg-[#071745] text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                Ver produto
              </Link>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
}
