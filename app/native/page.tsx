import {requireChatGPTUser} from '@/app/chatgpt-auth';
import Bridge from './bridge';
export const dynamic='force-dynamic';
export default async function Native(){await requireChatGPTUser('/native');return <Bridge/>;}
