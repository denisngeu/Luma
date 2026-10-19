import {requireChatGPTUser,safeRelativeReturnPath} from '../chatgpt-auth';
import ProfileSetup from './profile-setup';
export const dynamic='force-dynamic';
export const metadata={title:'Créer votre profil — Luma'};
export default async function Welcome({searchParams}:{searchParams:Promise<{returnTo?:string}>}){await requireChatGPTUser('/bienvenue');const p=await searchParams;return <ProfileSetup returnTo={safeRelativeReturnPath(p.returnTo||'/messages')}/>;}
