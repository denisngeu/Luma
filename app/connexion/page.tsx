import { ArrowRight, Check, LockKeyhole, MessageSquare, Users, ArrowLeft } from 'lucide-react';
import { getChatGPTUser, chatGPTSignInPath, chatGPTSignOutPath } from '../chatgpt-auth';
import './connexion.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Connexion — Luma' };

export default async function Connection({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const params = await searchParams;
  const candidate = typeof params.returnTo === 'string' ? params.returnTo : '/';
  // Reuse the authentication helper's same-origin and reserved-route validation.
  const signIn = chatGPTSignInPath(candidate);
  const validated = new URL(signIn, 'https://app.local').searchParams.get('return_to') || '/';
  const returnTo = validated.split(/[?#]/)[0].replace(/\/$/, '') === '/connexion' ? '/' : validated;
  return <ConnectionContent returnTo={returnTo} />;
}

async function ConnectionContent({ returnTo }: { returnTo: string }) {
  const user = await getChatGPTUser();
  return <main className="login-page">
    <aside className="login-story">
      <a className="login-brand" href="/" aria-label="Luma, accueil"><img src="/favicon.svg" alt="" width="44" height="44" />luma<span>VOTRE CERCLE</span></a>
      <div className="login-story-copy"><span className="login-kicker">LE LIEN COMMENCE ICI</span><h2>Un espace.<br />Tous vos<br /><em>univers.</em></h2><p>Vos proches, vos groupes et vos communautés se retrouvent sur Luma.</p>
      <div className="login-features"><span><MessageSquare size={19} aria-hidden="true" /> Conversations personnelles</span><span><Users size={19} aria-hidden="true" /> Communautés et salons</span></div></div>
      <p className="login-story-footer">À chaque conversation, sa place.</p>
    </aside>
    <section className="login-main" aria-labelledby="login-title">
      <a className="login-back" href="/"><ArrowLeft size={16} aria-hidden="true" /> Retour à Luma</a>
      <div className="login-card">
        <div className="login-symbol"><LockKeyhole size={25} aria-hidden="true" /></div>
        <span className="login-kicker">VOTRE ESPACE LUMA</span>
        <h1 id="login-title">{user ? 'Heureux de vous retrouver.' : 'Bienvenue chez vous.'}</h1>
        <p className="login-intro">{user ? 'Votre session est active. Retrouvez vos conversations et vos communautés.' : 'Connectez-vous pour retrouver vos conversations et rejoindre vos communautés.'}</p>
        {user && <div className="login-account"><div className="login-avatar">{Array.from(user.displayName)[0]?.toUpperCase()}</div><div><strong>{user.displayName}</strong><span>{user.email}</span></div><Check size={19} aria-label="Session active" /></div>}
        <a className="login-primary" href={user ? returnTo : chatGPTSignInPath(returnTo)} target="_top">{user ? 'Continuer vers Luma' : 'Continuer avec ChatGPT'}<ArrowRight size={19} aria-hidden="true" /></a>
        {user ? <a className="login-switch" href={chatGPTSignOutPath('/connexion?returnTo=' + encodeURIComponent(returnTo))} target="_top">Se déconnecter</a> : <p className="login-method">Un seul compte. Aucun mot de passe supplémentaire à créer pour Luma.</p>}
        <div className="login-help"><h2>Besoin d’aide pour vous connecter ?</h2><p>Utilisez le compte ChatGPT autorisé à accéder à ce site. Si l’accès est refusé, demandez au propriétaire de vous inviter.</p><p>Un code de communauté ne remplace pas cette autorisation.</p></div>
      </div>
      <footer className="login-footer"><a href="/confidentialite">Confidentialité</a> · <LockKeyhole size={14} aria-hidden="true" /> Connexion gérée par ChatGPT<span>Luma</span></footer>
    </section>
  </main>;
}
