import Messenger from '../messenger';
import {requireChatGPTUser} from '../chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Messages(){await requireChatGPTUser('/messages');return <Messenger/>;}
