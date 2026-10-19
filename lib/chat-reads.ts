import {ApiError,db} from './chat-server';

export type ReadCursor={through:number;sequence:number};
export type ReadMessage={id:string;created:number;scheduled:number;read_sequence:number|null;read_through:number|null};

export const messageVisibleAt=(alias:string)=>`CASE WHEN ${alias}.scheduled>${alias}.created THEN ${alias}.scheduled ELSE ${alias}.created END`;
export const unreadCondition=(message:string,read:string)=>`(${message}.delivery_seq>COALESCE(${read}.read_sequence,0) OR ${message}.scheduled>COALESCE(${read}.read_through,0))`;

export function cursorForMessages(messages:ReadMessage[],now:number):ReadCursor {
  // Indexed cursor lookups share the displayed message SELECT snapshot.
  // The 200-row display limit and future author previews cannot advance it.
  return {through:Math.min(now,messages.reduce((latest,message)=>Math.max(latest,Number(message.read_through)||0),0)),sequence:messages.reduce((latest,message)=>Math.max(latest,Number(message.read_sequence)||0),0)};
}

export async function unreadInChat(chat:string,user:string,now=Date.now()) {
  const result=await db().prepare(`SELECT count(*) n FROM messages m LEFT JOIN chat_reads r ON r.chat=m.chat AND r.user=? WHERE m.chat=? AND m.author!=? AND m.hidden=0 AND m.scheduled<=? AND ${unreadCondition('m','r')}`).bind(user,chat,user,now).first<{n:number}>();
  return Number(result?.n||0);
}

export async function acknowledgeRead(chat:string,user:string,input:unknown) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new ApiError('Repère de lecture invalide.');
  const cursor=input as ReadCursor,now=Date.now();
  if(!Number.isSafeInteger(cursor.through)||cursor.through<0||cursor.through>now||!Number.isSafeInteger(cursor.sequence)||cursor.sequence<0)throw new ApiError('Repère de lecture invalide.');
  if(cursor.sequence===0)return unreadInChat(chat,user,now);
  const visible=await db().prepare('SELECT id FROM messages WHERE chat=? AND hidden=0 AND scheduled<=? AND delivery_seq=?').bind(chat,cursor.through,cursor.sequence).first();
  if(!visible)throw new ApiError('Les messages ont changé. Actualisez la discussion.',409);
  // Both dimensions are necessary: sequence isolates same-millisecond arrivals;
  // delivery time keeps older scheduled messages unread when delivered later.
  // GREATEST also prevents delayed acknowledgements from restoring unread state.
  await db().prepare(`INSERT INTO chat_reads(chat,user,read_through,read_sequence) VALUES (?,?,?,?)
    ON CONFLICT(chat,user) DO UPDATE SET
      read_through=GREATEST(chat_reads.read_through,excluded.read_through),
      read_sequence=GREATEST(chat_reads.read_sequence,excluded.read_sequence)`)
    .bind(chat,user,cursor.through,cursor.sequence).run();
  return unreadInChat(chat,user);
}
