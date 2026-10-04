import {requireChatGPTUser} from '../chatgpt-auth';
import {Suspense} from 'react';
import Feed from './feed';
export const dynamic='force-dynamic';
export const metadata={title:'Fil des amis — Luma'};
export default async function Page(){await requireChatGPTUser('/fil');return <Suspense fallback={<main className="feed-loading" aria-busy="true">Chargement du fil…</main>}><Feed/></Suspense>;}
