import {requireChatGPTUser} from '../chatgpt-auth';
import Feed from './feed';
export const dynamic='force-dynamic';
export const metadata={title:'Fil des amis — Luma'};
export default async function Page(){await requireChatGPTUser('/fil');return <Feed/>;}
