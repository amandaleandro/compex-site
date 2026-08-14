import AssociateShell from "@/components/layout/AssociateShell";
import { AssociateSessionProvider } from "@/components/associate/AssociateSession";
import "./associate.css";
import "./legacy-portal.css";
import "./associate-footer.css";
import "./associate-fullbleed.css";
import "./menu-card-fixes.css";
import "./menu-visibility.css";
import "./header-refinement.css";

export default function AssociateLayout({ children }: { children: React.ReactNode }) {
  return <AssociateSessionProvider><AssociateShell>{children}</AssociateShell></AssociateSessionProvider>;
}
