import { ArrowRight, Check, Download, MessageCircle, MonitorDown, Radio, ShieldCheck, Smartphone, Sparkles, Users, Video } from "lucide-react";
import { redirect } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { getChatGPTUser } from "./chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ chat?: string }> }) {
  const user = await getChatGPTUser();
  const { chat } = await searchParams;
  if (chat && user) redirect(`/messages?chat=${encodeURIComponent(chat)}`);
  if (user) redirect("/messages");
  const destination = "/connexion?returnTo=%2Fmessages";

  return <main className="landing">
    <nav className="landing-nav" aria-label="Navigation principale">
      <Link className="landing-brand" href="/"><Image src="/favicon.svg" width={38} height={38} alt="" /><strong>Luma</strong><span>VOTRE CERCLE</span></Link>
      <div className="landing-links"><a href="#univers">Fonctionnalités</a><a href="#telecharger">Télécharger</a><a href="#confiance">Confiance</a><a href="/confidentialite">Confidentialité</a></div>
      <a className="landing-login" href={destination}>{user ? "Ouvrir Luma" : "Se connecter"}<ArrowRight size={17} /></a>
    </nav>

    <section className="landing-hero">
      <div className="landing-hero-copy">
        <span className="landing-kicker"><Sparkles size={15} /> LE RÉSEAU QUI VOUS RESSEMBLE</span>
        <h1>Parlez. Créez.<br /><em>Restez proches.</em></h1>
        <p>Luma réunit vos messages, vos communautés, vos appels et vos publications dans un espace calme, personnel et sans publicité.</p>
        <div className="landing-actions"><a className="landing-primary" href={destination}>{user ? "Reprendre là où j’en étais" : "Créer mon espace"}<ArrowRight size={19} /></a><a className="landing-secondary" href="#univers">Découvrir Luma</a></div>
        <div className="landing-proof"><span><Check size={15} /> Sans publicité</span><span><Check size={15} /> Contrôle de vos données</span><span><Check size={15} /> Mobile et ordinateur</span></div>
      </div>
      <div className="landing-preview" aria-label="Aperçu de Luma">
        <div className="preview-rail"><Image src="/favicon.svg" width={30} height={30} alt="" /><i></i><i></i><i></i></div>
        <div className="preview-list"><span>VOTRE CERCLE</span><h2>Conversations</h2><div className="preview-search">Rechercher</div><article className="active"><b>AN</b><p><strong>Atelier nomade</strong><small>On se retrouve à 19 h ?</small></p><time>18:42</time></article><article><b>ML</b><p><strong>Marie L.</strong><small>La maquette est prête</small></p><time>17:08</time></article><article><b>ST</b><p><strong>Studio</strong><small>3 nouveaux messages</small></p></article></div>
        <div className="preview-chat"><header><b>AN</b><p><strong>Atelier nomade</strong><small>6 membres · en ligne</small></p><Video size={18} /></header><div className="preview-messages"><span>Aujourd’hui</span><p>J’ai partagé les idées pour notre prochain projet.</p><p className="mine">Parfait. On en parle ce soir ✨</p></div><footer>Écrire un message… <i>↑</i></footer></div>
        <aside className="preview-live"><Radio size={17} /><strong>Salon créatif</strong><span>4 personnes en vocal</span></aside>
      </div>
    </section>

    <section className="landing-section" id="univers">
      <span className="landing-kicker">UN SEUL ESPACE</span><h2>Tout ce qu’il faut pour faire vivre votre cercle.</h2>
      <div className="landing-grid">
        <article><MessageCircle /><h3>Messages qui vont plus loin</h3><p>Conversations privées, groupes, réponses, réactions, sondages, fichiers et messages programmés.</p></article>
        <article><Users /><h3>Communautés organisées</h3><p>Créez des espaces, salons, annonces et rôles pour chaque projet ou groupe d’amis.</p></article>
        <article><Video /><h3>Appels vraiment partagés</h3><p>Audio, vidéo, partage d’écran et soundboard réunis dans la même conversation.</p></article>
      </div>
    </section>

    <section className="landing-download" id="telecharger"><div><span className="landing-kicker"><Download size={15}/> LUMA PARTOUT AVEC VOUS</span><h2>Installez Luma sur vos appareils.</h2><p>Retrouvez le même compte, vos thèmes et toutes vos conversations sur ordinateur et Android.</p></div><div className="download-cards"><a href="https://github.com/denisngeu/Luma-Downloads/releases/download/v0.3.8-preview/Luma-Setup-0.3.6.exe"><MonitorDown/><span><strong>Windows</strong><small>Télécharger Luma 0.3.6 (.exe)</small></span><ArrowRight/></a><a href="/downloads/Luma-0.3.15-test.apk" download="Luma-0.3.15-test.apk"><Smartphone/><span><strong>Android</strong><small>Télécharger Luma 0.3.15 (.apk)</small></span><ArrowRight/></a></div><small className="download-note">Versions de prévisualisation · Windows 10/11 et Android 8 ou supérieur · Autorisations micro et caméra demandées uniquement au moment d’un appel.</small></section>

    <section className="landing-trust" id="confiance"><div><span className="landing-kicker">VOTRE ESPACE, VOS RÈGLES</span><h2>Une expérience sociale plus humaine.</h2><p>Pas de publicité, pas de fil imposé. Vous choisissez vos amis, vos communautés, votre apparence et ce que vous partagez.</p><a href="/confidentialite">Lire notre approche des données <ArrowRight size={17} /></a></div><ShieldCheck size={112} /></section>

    <footer className="landing-footer"><Link className="landing-brand" href="/"><Image src="/favicon.svg" width={32} height={32} alt="" /><strong>Luma</strong></Link><p>Votre cercle, réuni autrement.</p><div><a href="/connexion">Connexion</a><a href="/confidentialite">Confidentialité</a></div></footer>
  </main>;
}
