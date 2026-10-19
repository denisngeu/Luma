import {ApiError,db,fail,member,sameOrigin,str,user,writable} from '@/lib/chat-server';
import {acknowledgeRead,cursorForMessages,messageVisibleAt,unreadCondition,type ReadMessage} from '@/lib/chat-reads';
export async function POST(request:Request){try{
 sameOrigin(request);const u=await user();if(Number(request.headers.get('content-length')||0)>30000)throw new ApiError('Requête trop volumineuse',413);const raw=await request.json();if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new ApiError('Requête invalide');const p=raw as Record<string,unknown>;
 if(p.action==='list'){
  const now=Date.now();
  const rows=await db().prepare(`SELECT c.id,c.kind,c.space,c.mode,c.topic,c.owner,c.invite,c.created,
   CASE WHEN c.kind='direct' AND c.id LIKE 'friend-%' THEN COALESCE((SELECT u.name FROM members other JOIN users u ON u.id=other.user WHERE other.chat=c.id AND other.user!=? LIMIT 1),c.name) ELSE c.name END name,
   (SELECT substr(CASE WHEN preview_message.body!='' THEN preview_message.body WHEN preview_message.file IS NOT NULL THEN 'Pièce jointe : '||COALESCE(NULLIF(preview_message.filename,''),'fichier') ELSE 'Message' END,1,120) FROM messages preview_message WHERE preview_message.hidden=0 AND preview_message.chat=c.id AND preview_message.scheduled<=? ORDER BY ${messageVisibleAt('preview_message')} DESC,preview_message.delivery_seq DESC LIMIT 1) AS preview,
   (SELECT count(*) FROM messages message LEFT JOIN chat_reads reading ON reading.chat=message.chat AND reading.user=? WHERE message.chat=c.id AND message.author!=? AND message.hidden=0 AND message.scheduled<=? AND ${unreadCondition('message','reading')}) unread,
   COALESCE((SELECT MAX(${messageVisibleAt('recent')}) FROM messages recent WHERE recent.chat=c.id AND recent.hidden=0 AND recent.scheduled<=?),c.created) last_activity
   FROM chats c JOIN members m ON m.chat=c.id WHERE m.user=? AND c.locked=0 AND c.space IS NULL ORDER BY last_activity DESC,c.created DESC LIMIT 100`)
   .bind(u.id,now,u.id,u.id,now,now,u.id).all();
  return Response.json({user:u,chats:rows.results},{headers:{'Cache-Control':'no-store'}});
 }
 if(p.action==='create'){const name=str(p.name,80),kind=p.kind==='direct'?'direct':'group';const count=await db().prepare('SELECT count(*) AS n FROM chats WHERE owner=?').bind(u.id).first<{n:number}>();if((count?.n||0)>=100)throw new ApiError('Limite de 100 discussions atteinte.');const id=crypto.randomUUID(),invite=crypto.randomUUID();await db().batch([db().prepare('INSERT INTO chats (id,name,kind,owner,invite,created) VALUES (?,?,?,?,?,?)').bind(id,name,kind,u.id,invite,Date.now()),db().prepare('INSERT INTO members (chat,user) VALUES (?,?)').bind(id,u.id)]);return Response.json({id});}
 if(p.action==='join'){const code=str(p.code,100);const c=await db().prepare('SELECT * FROM chats WHERE invite=? AND locked=0').bind(code).first<{id:string;kind:string}>();if(!c)throw new ApiError('Code invalide',404);if(c.id.startsWith('friend-'))throw new ApiError('Ajoutez ce contact depuis Amis pour discuter.',403);const result=await db().prepare(`INSERT OR IGNORE INTO members(chat,user) SELECT ?,? WHERE (SELECT count(*) FROM members WHERE chat=?) < ?`).bind(c.id,u.id,c.id,c.kind==='direct'?2:256).run();if(!result.meta.changes)await member(u.id,c.id);return Response.json({id:c.id});}
 if(p.action==='messages'){
  const chat=str(p.chat,100),now=Date.now();await member(u.id,chat);
  // Cursor and displayed rows share one PostgreSQL snapshot. Index lookups
  // obtain the read frontier without carrying all historical message bodies.
  const rows=await db().prepare(`WITH recent AS (
   SELECT * FROM (
    (SELECT m.*,${messageVisibleAt('m')} activity_at,0 scheduled_pending FROM messages m WHERE m.chat=? AND m.hidden=0 AND m.scheduled<=? ORDER BY activity_at DESC,delivery_seq DESC LIMIT 200)
    UNION ALL
    (SELECT m.*,m.created activity_at,1 scheduled_pending FROM messages m WHERE m.chat=? AND m.hidden=0 AND m.scheduled>? AND m.author=? ORDER BY activity_at DESC,delivery_seq DESC LIMIT 200)
   ) candidates ORDER BY activity_at DESC,delivery_seq DESC LIMIT 200
  ), read_marker AS (
   SELECT COALESCE((SELECT delivery_seq FROM messages WHERE chat=? AND hidden=0 AND scheduled<=? ORDER BY delivery_seq DESC LIMIT 1),0) read_sequence,
    COALESCE((SELECT scheduled FROM messages WHERE chat=? AND hidden=0 AND scheduled<=? ORDER BY scheduled DESC LIMIT 1),0) read_through
  ) SELECT recent.*,u.name,EXISTS(SELECT 1 FROM stars s WHERE s.message=recent.id AND s.user=?) AS starred,read_marker.read_sequence,read_marker.read_through
   FROM recent JOIN users u ON u.id=recent.author CROSS JOIN read_marker ORDER BY activity_at ASC,delivery_seq ASC`)
   .bind(chat,now,chat,now,u.id,chat,now,chat,now,u.id).all<ReadMessage>();
  return Response.json({messages:rows.results,readCursor:cursorForMessages(rows.results,now)},{headers:{'Cache-Control':'no-store'}});
 }
 if(p.action==='read'){const chat=str(p.chat,100);await member(u.id,chat);return Response.json({ok:true,unread:await acknowledgeRead(chat,u.id,p.cursor)},{headers:{'Cache-Control':'no-store'}});}
 if(p.action==='send'){const chat=str(p.chat,100),body=str(p.body),channel=await writable(u.id,chat);if(channel.space){const bot=await db().prepare("SELECT config FROM space_bots WHERE space=? AND kind='moderation' AND enabled=1").bind(channel.space).first<{config:{blockedWords?:string[]}|string}>();if(bot){const config=typeof bot.config==='string'?JSON.parse(bot.config):bot.config;const blocked=(config.blockedWords||[]).find((word:string)=>word&&body.toLowerCase().includes(word));if(blocked)throw new ApiError('Ce message contient un terme bloqué par la modération de cette communauté.',422);}}const scheduled=p.scheduled===undefined?0:p.scheduled;if(typeof scheduled!=='number'||!Number.isSafeInteger(scheduled)||scheduled<0||scheduled>Date.now()+366*86400000)throw new ApiError('Date de programmation invalide');let reply=null;if(p.reply){reply=str(p.reply,100);const parent=await db().prepare('SELECT id FROM messages WHERE id=? AND chat=? AND (scheduled<=? OR author=?)').bind(reply,chat,Date.now(),u.id).first();if(!parent)throw new ApiError('Message de référence introuvable');}const clientId=p.clientId===undefined?null:p.clientId;
  if(clientId!==null&&(typeof clientId!=='string'||! /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId)))throw new ApiError('Identifiant d’envoi invalide');
  const inserted=await db().prepare('INSERT INTO messages(id,chat,author,body,created,scheduled,reply,client_id) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(author,client_id) WHERE client_id IS NOT NULL DO NOTHING RETURNING id').bind(crypto.randomUUID(),chat,u.id,body,Date.now(),scheduled,reply,clientId).first<{id:string}>();
  if(inserted)return Response.json({id:inserted.id});
  const existing=await db().prepare('SELECT id,chat,body,scheduled,reply FROM messages WHERE author=? AND client_id=?').bind(u.id,clientId).first<{id:string;chat:string;body:string;scheduled:number;reply:string|null}>();
  if(!existing||existing.chat!==chat||existing.body!==body||existing.scheduled!==scheduled||existing.reply!==reply)throw new ApiError('Cet identifiant d’envoi a déjà été utilisé pour un autre message.',409);
  return Response.json({id:existing.id});}
 if(p.action==='star'){const id=str(p.message,100);const msg=await db().prepare('SELECT chat,scheduled,author FROM messages WHERE id=?').bind(id).first<{chat:string;scheduled:number;author:string}>();if(!msg||msg.scheduled>Date.now()&&msg.author!==u.id)throw new ApiError('Message introuvable',404);await member(u.id,msg.chat);const star=await db().prepare('SELECT 1 FROM stars WHERE message=? AND user=?').bind(id,u.id).first();if(star)await db().prepare('DELETE FROM stars WHERE message=? AND user=?').bind(id,u.id).run();else await db().prepare('INSERT OR IGNORE INTO stars(message,user) VALUES (?,?)').bind(id,u.id).run();return Response.json({ok:true});}
 throw new ApiError('Action inconnue');
 }catch(e){return fail(e);}}


