import {requireChatGPTUser} from '../../chatgpt-auth';
import Room from './room';
export const dynamic='force-dynamic';
export const metadata={title:'Salon vocal — Luma'};
export default async function Page({params}:{params:Promise<{id:string}>}){const {id}=await params;await requireChatGPTUser('/salle/'+encodeURIComponent(id));return <Room id={id}/>;}
