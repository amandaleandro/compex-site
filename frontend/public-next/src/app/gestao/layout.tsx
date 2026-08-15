import GestaoShell from "@/components/gestao/GestaoShell";

export default function GestaoLayout({ children }: { children: React.ReactNode }) {
  return <GestaoShell>{children}</GestaoShell>;
}
