import Messenger from './messenger';
import {getChatGPTUser} from './chatgpt-auth';
import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Home(){if(!await getChatGPTUser())redirect('/connexion');return <Messenger/>;}
