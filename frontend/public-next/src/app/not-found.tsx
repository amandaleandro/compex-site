import Link from "next/link";
import { CalendarDays, Home } from "lucide-react";
import styles from "./error-pages.module.css";

export default function NotFound() {
  return <section className={styles.page}><article className={styles.card}>
    <div className={styles.visual}><img className={styles.logo} src="/compex-logo.png" alt="Mascote da CompExatas" /><strong className={styles.code}>404</strong></div>
    <div className={styles.content}><p className={styles.kicker}>COMPEX / FORA DA ROTA</p><h1 className={styles.title}>Essa página não<em>entrou em quadra.</em></h1><p className={styles.text}>O endereço pode ter mudado, o conteúdo pode ter sido removido ou talvez esse caminho nunca tenha existido.</p><div className={styles.quote}>“Nem toda jogada dá certo de primeira. O importante é voltar para o jogo.”</div><div className={styles.actions}><Link className={styles.primary} href="/"><Home size={15}/> Voltar ao início</Link><Link className={styles.secondary} href="/eventos"><CalendarDays size={15}/> Ver próximos eventos</Link></div><p className={styles.help}>Erro 404 · Se você chegou aqui por um botão do site, avise a diretoria para corrigirmos a rota.</p></div>
  </article></section>;
}
