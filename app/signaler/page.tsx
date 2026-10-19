import {requireChatGPTUser} from '../chatgpt-auth';
import ReportForm from './report-form';
export const dynamic='force-dynamic';
export const metadata={title:'Signaler un problème — Luma'};
export default async function Page({searchParams}:{searchParams:Promise<{kind?:string;target?:string}>}){const params=await searchParams;await requireChatGPTUser('/signaler');return <main className="privacy-page"><a href="/parametres">← Paramètres</a><header><span>MODÉRATION LUMA</span><h1>Signaler un problème</h1><p>Sélectionnez un contenu auquel vous avez accès et expliquez la situation. Le contenu signalé sera accessible à l’équipe d’administration pour examen.</p></header><ReportForm initialKind={params.kind} initialTarget={params.target}/></main>;}
