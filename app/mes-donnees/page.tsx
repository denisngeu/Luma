import {requireChatGPTUser} from '../chatgpt-auth';
import DataControls from './controls';
export const dynamic='force-dynamic';
export const metadata={title:'Mes données — Luma'};
export default async function Page(){await requireChatGPTUser('/mes-donnees');return <main className="privacy-page"><nav><a href="/parametres">← Paramètres</a><a href="/confidentialite">Confidentialité</a></nav><header><span>VOTRE COMPTE</span><h1>Compte et données</h1><p>Consultez, exportez et gérez les informations de votre espace Luma.</p></header><DataControls/></main>;}
