"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { User, Menu, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const navItems = [
  { name: "Início", href: "/" },
  { name: "Eventos", href: "/eventos" },
  { name: "Modalidades", href: "/modalidades" },
  { name: "Benefícios", href: "/beneficios" },
  { name: "Notícias", href: "/noticias" },
  { name: "Loja", href: "/loja" },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50 py-3.5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          
          {/* Logo Brand UFU */}
          <Link href="/" className="flex items-center gap-3">
            <img className="h-14 w-14 object-contain" src="/compex-logo.png" alt="Logo CompExatas" />
            <div>
              <span className="text-xs font-black tracking-wider text-navy block uppercase leading-none">
                ATLÉTICA
              </span>
              <span className="text-sm font-extrabold text-slate-900 uppercase block leading-tight">
                COMPUTAÇÃO E EXATAS
              </span>
              <span className="text-[10px] text-slate-500 font-bold block uppercase leading-none">
                UFU
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Items (Identico à imagem original) */}
          <nav className="hidden lg:flex items-center gap-8">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative text-sm font-bold transition-colors py-1 ${
                    isActive ? "text-navy" : "text-slate-600 hover:text-navy"
                  }`}
                >
                  {item.name}
                  {isActive && (
                    <motion.div
                      layoutId="activeNavLine"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-navy rounded-full"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Ações do portal em azul-marinho e cinza-claro */}
          <div className="hidden sm:flex items-center gap-3">
            <a
              href="/login"
              className="px-5 py-2.5 rounded-xl bg-[#0b2265] text-white text-xs font-bold hover:bg-[#071745] transition-colors flex items-center gap-2"
            >
              <User className="w-4 h-4 text-cyan-400" />
              Área do associado
            </a>
            <Link
              href="/cadastro"
              className="px-5 py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-900 text-xs font-black hover:bg-white transition-colors shadow-sm"
            >
              Associe-se
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="lg:hidden p-2 rounded-xl bg-slate-100 text-slate-700 hover:text-slate-900"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

        </div>
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden bg-white border-b border-slate-200 overflow-hidden"
          >
            <div className="px-4 pt-4 pb-6 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-4 py-2.5 rounded-xl text-sm font-bold ${
                    pathname === item.href ? "bg-slate-100 text-navy" : "text-slate-600"
                  }`}
                >
                  {item.name}
                </Link>
              ))}
              <div className="pt-4 border-t border-slate-100 flex flex-col gap-2">
                <a
                  href="/login"
                  className="w-full text-center py-2.5 rounded-xl bg-navy text-white text-xs font-bold"
                >
                  Área do associado
                </a>
                <Link
                  href="/cadastro"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full text-center py-2.5 rounded-xl border border-slate-300 bg-slate-100 text-slate-900 text-xs font-black"
                >
                  Associe-se
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
