"use client";

import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const standalone = pathname.startsWith("/associado");
  if (standalone) return <>{children}</>;
  return <><Navbar /><main className="min-h-[calc(100vh-80px)]">{children}</main><Footer /></>;
}
