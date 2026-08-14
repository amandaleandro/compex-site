import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SiteChrome from "@/components/layout/SiteChrome";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "COMPEX - Associação Atlética Acadêmica das Exatas",
  description: "Portal oficial da COMPEX. Esportes, eventos, benefícios para sócios e muito mais.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className={`${inter.className} bg-[#f2f4f7] text-slate-900 min-h-screen flex flex-col antialiased`}>
        <SiteChrome>{children}</SiteChrome>
      </body>
    </html>
  );
}
