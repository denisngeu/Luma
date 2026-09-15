import {getChatGPTUser} from './chatgpt-auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Home({searchParams}:{searchParams:Promise<{chat?:string}>}){if(!await getChatGPTUser())redirect('/connexion');const {chat}=await searchParams;redirect(chat?'/messages?chat='+encodeURIComponent(chat):'/fil');}
