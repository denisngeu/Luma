import {requireChatGPTUser} from '../chatgpt-auth';
import {isAdministrator} from '@/lib/admin';
import {notFound} from 'next/navigation';
import Dashboard from './dashboard';
export const dynamic='force-dynamic';
export const metadata={title:'Administration — Luma'};
export default async function Administration(){
 const account=await requireChatGPTUser('/admin');
 if(!await isAdministrator(account.userId))notFound();
 return <Dashboard email={account.email}/>;
}
