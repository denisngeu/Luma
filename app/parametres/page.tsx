import {isAdministrator} from '@/lib/admin';
import {requireChatGPTUser,chatGPTSignOutPath} from '../chatgpt-auth';
import SocialNav from '../social-nav';
import {Palette,Shield,ChevronRight} from 'lucide-react';
import '../confidentialite/privacy.css';
export const dynamic='force-dynamic';
export const metadata={title:'Paramètres — Luma'};
export default async function Settings(){const u=await requireChatGPTUser('/parametres');const admin=await isAdministrator(u.userId);return <main className="privacy-page settings-page"><SocialNav/><header><span>LUMA</span><h1>Paramètres</h1><p>{u.email}</p></header><section className="settings-links">{admin&&<a href="/admin"><Shield/><span><strong>Administration</strong><small>Vue d’ensemble du service</small></span><ChevronRight/></a>}<a href="/apparence"><Palette/><span><strong>Apparence</strong><small>Thème, couleurs et taille des messages</small></span><ChevronRight/></a><a href="/mes-donnees"><Shield/><span><strong>Compte et données</strong><small>Nom, export et fermeture du compte</small></span><ChevronRight/></a></section><form method="post" action={chatGPTSignOutPath('/')}><button type="submit">Se déconnecter</button></form></main>;}
