import {requireChatGPTUser} from '../chatgpt-auth';
import {isAdministrator} from '@/lib/admin';
import {getDatabase} from '@/lib/runtime';
import {notFound} from 'next/navigation';
import '../confidentialite/privacy.css';
export const dynamic='force-dynamic';
export const metadata={title:'Administration — Luma'};
export default async function Administration(){
 const account=await requireChatGPTUser('/admin');
 if(!await isAdministrator(account.userId))notFound();
 const counts=await getDatabase().prepare(`SELECT (SELECT count(*) FROM users WHERE closed=0) accounts,(SELECT count(*) FROM spaces) communities,(SELECT count(*) FROM chats) conversations,(SELECT count(*) FROM calls WHERE state='active' AND expires>?) calls`).bind(Date.now()).first<{accounts:number;communities:number;conversations:number;calls:number}>();
 return <main className="privacy-page"><a href="/parametres">← Paramètres</a><header><span>ADMINISTRATION LUMA</span><h1>Vue d’ensemble</h1><p>Connecté en tant qu’administrateur : {account.email}</p></header><section><h2>Activité du service</h2><dl><dt>Comptes actifs</dt><dd>{counts?.accounts}</dd><dt>Communautés</dt><dd>{counts?.communities}</dd><dt>Conversations</dt><dd>{counts?.conversations}</dd><dt>Appels en cours</dt><dd>{counts?.calls}</dd></dl></section></main>;
}
