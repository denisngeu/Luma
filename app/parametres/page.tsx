import {requireChatGPTUser,chatGPTSignOutPath} from '../chatgpt-auth';
import {Palette,Shield,ChevronRight} from 'lucide-react';
import '../confidentialite/privacy.css';
export const dynamic='force-dynamic';
export const metadata={title:'Paramètres — Luma'};
export default async function Settings(){const u=await requireChatGPTUser('/parametres');return <main className="privacy-page settings-page"><nav><a href="/">← Discussions</a><a href="/communities">Communautés</a></nav><header><span>LUMA</span><h1>Paramètres</h1><p>{u.email}</p></header><section className="settings-links"><a href="/apparence"><Palette/><span><strong>Apparence</strong><small>Thème, couleurs et taille des messages</small></span><ChevronRight/></a><a href="/mes-donnees"><Shield/><span><strong>Compte et données</strong><small>Nom, export et fermeture du compte</small></span><ChevronRight/></a></section><a href={chatGPTSignOutPath('/connexion')} target="_top">Se déconnecter</a></main>;}
