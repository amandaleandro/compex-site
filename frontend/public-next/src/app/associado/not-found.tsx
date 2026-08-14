import Link from "next/link";
import { ArrowLeft, CreditCard } from "lucide-react";
import styles from "../error-pages.module.css";

export default function AssociateNotFound() {
  return <section className={styles.page}><article className={styles.card}>
    <div className={styles.visual}><img className={styles.logo} src="/compex-logo.png" alt="Mascote da CompExatas" /><strong className={styles.code}>404</strong></div>
    <div className={styles.content}><p className={styles.kicker}>MINHA COMPEX / CAMINHO NÃO ENCONTRADO</p><h1 className={styles.title}>Essa jogada não existe<em>no seu portal.</em></h1><p className={styles.text}>A área que você tentou abrir não está disponível. Volte ao painel ou acesse sua carteirinha digital.</p><div className={styles.quote}>“Seu lugar na matilha continua garantido. Só precisamos voltar uma casa.”</div><div className={styles.actions}><Link className={styles.primary} href="/associado"><ArrowLeft size={15}/> Voltar ao painel</Link><Link className={styles.secondary} href="/associado/carteirinha"><CreditCard size={15}/> Abrir carteirinha</Link></div></div>
  </article></section>;
}
