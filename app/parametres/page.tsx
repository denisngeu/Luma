import {isAdministrator} from '@/lib/admin';
import Link from 'next/link';
import {requireChatGPTUser,chatGPTSignOutPath} from '../chatgpt-auth';
import SocialNav from '../social-nav';
import {Palette,Shield,ChevronRight} from 'lucide-react';
import '../confidentialite/privacy.css';
import AccountSessions from './account-sessions';
import UserPreferences from './user-preferences';
import ThemeQuickSettings from './theme-quick-settings';
export const dynamic='force-dynamic';
export const metadata={title:'Paramètres — Luma'};
export default async function Settings(){const u=await requireChatGPTUser('/parametres');const admin=await isAdministrator(u.userId);return <main className="privacy-page settings-page"><SocialNav/><div className="stitch-page-topbar"><i/><span><small>LUMA • VOTRE COMPTE</small><strong>Paramètres</strong></span></div><header><span>LUMA / VOTRE COMPTE</span><h1>Paramètres</h1><p>{u.email} · Gérez votre identité, vos appels et votre confort.</p></header><ThemeQuickSettings/><UserPreferences/><section className="settings-links">{admin&&<Link href="/admin"><Shield/><span><strong>Administration</strong><small>Comptes, modération et configuration</small></span><ChevronRight/></Link>}<Link href="/apparence"><Palette/><span><strong>Apparence avancée</strong><small>Couleurs, densité et taille des messages</small></span><ChevronRight/></Link><Link href="/signaler"><Shield/><span><strong>Signaler un problème</strong><small>Contacter la modération de Luma</small></span><ChevronRight/></Link><Link href="/mes-donnees"><Shield/><span><strong>Compte et données</strong><small>Export, confidentialité et fermeture du compte</small></span><ChevronRight/></Link></section><AccountSessions/><form method="post" action={chatGPTSignOutPath('/')}><button type="submit">Se déconnecter</button></form></main>;}
