import {requireChatGPTUser} from '@/app/chatgpt-auth';
import CallRoom from './room';
export const dynamic='force-dynamic';
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;return <Authorized id={id}/>;}
async function Authorized({id}:{id:string}){await requireChatGPTUser('/appel/'+encodeURIComponent(id));return <CallRoom id={id}/>;}
