import { ArrowRight, Check, LockKeyhole, MessageSquare, Users, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath, nativeAuthEnabled, safeRelativeReturnPath } from "../chatgpt-auth";
import AuthForm from "./auth-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Connexion — Luma" };

export default async function Connection({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  const returnTo = safeRelativeReturnPath(typeof params.returnTo === "string" ? params.returnTo : "/messages");
  const user = await getChatGPTUser();
  const native = nativeAuthEnabled();
  return <main className="login-page">
    <aside className="login-story">
      <Link className="login-brand" href="/" aria-label="Luma, accueil"><Image src="/favicon.svg" alt="" width={44} height={44} />luma<span>VOTRE CERCLE</span></Link>
      <div className="login-story-copy"><span className="login-kicker">LE LIEN COMMENCE ICI</span><h2>Un espace.<br />Tous vos<br /><em>univers.</em></h2><p>Vos proches, vos groupes et vos communautés se retrouvent sur Luma.</p>
      <div className="login-features"><span><MessageSquare size={19} aria-hidden="true" /> Conversations personnelles</span><span><Users size={19} aria-hidden="true" /> Communautés et salons</span></div></div>
      <p className="login-story-footer">À chaque conversation, sa place.</p>
    </aside>
    <section className="login-main" aria-labelledby="login-title">
      <Link className="login-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Découvrir Luma</Link>
      <div className="login-card">
        <div className="login-symbol"><LockKeyhole size={25} aria-hidden="true" /></div>
        <span className="login-kicker">VOTRE ESPACE LUMA</span>
        <h1 id="login-title">{user ? "Heureux de vous retrouver." : "Bienvenue chez vous."}</h1>
        <p className="login-intro">{user ? "Votre session est active. Retrouvez vos conversations et vos communautés." : "Connectez-vous ou créez votre compte pour rejoindre votre cercle."}</p>
        {user ? <>
          <div className="login-account"><div className="login-avatar">{Array.from(user.displayName)[0]?.toUpperCase()}</div><div><strong>{user.displayName}</strong><span>{user.email}</span></div><Check size={19} aria-label="Session active" /></div>
          <a className="login-primary" href={returnTo}>Continuer vers Luma<ArrowRight size={19} aria-hidden="true" /></a>
          <div className="login-session-actions"><form className="login-logout" method="post" action={chatGPTSignOutPath(`/connexion?returnTo=${encodeURIComponent(returnTo)}`)}><button type="submit" className="login-switch">Changer de compte</button></form><form className="login-logout" method="post" action={chatGPTSignOutPath("/")}><button type="submit" className="login-switch">Se déconnecter</button></form></div>
        </> : native ? <AuthForm returnTo={returnTo} /> : <>
          <a className="login-primary" href={chatGPTSignInPath(returnTo)} target="_top">Continuer avec ChatGPT<ArrowRight size={19} aria-hidden="true" /></a>
          <p className="login-method">Connexion sécurisée par votre compte ChatGPT.</p>
        </>}
        <div className="login-help"><h2>Vos accès restent privés</h2><p>Votre mot de passe est dérivé avec PBKDF2 et n’est jamais conservé en clair. La session utilise un cookie inaccessible aux scripts de la page.</p></div>
      </div>
      <footer className="login-footer"><a href="/confidentialite">Confidentialité</a> · <LockKeyhole size={14} aria-hidden="true" /> {native ? "Connexion sécurisée par Luma" : "Connexion gérée par ChatGPT"}<span>Luma</span></footer>
    </section>
  </main>;
}
