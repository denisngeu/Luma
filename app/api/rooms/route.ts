import {iceConfiguration} from '@/lib/ice-config';
import {createMediaRoom} from '@/lib/call-creation';
import {activeRoomBatch} from '@/lib/active-room-batch';
import {ApiError,db,fail,manager,member,sameOrigin,str,user} from '@/lib/chat-server';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
async function roomFor(uid:string,id:string){const room=await db().prepare('SELECT r.*,c.name AS chat_name,c.space,c.mode AS chat_mode FROM media_rooms r JOIN chats c ON c.id=r.chat WHERE r.id=? AND r.state=\'open\' AND r.expires>?').bind(id,Date.now()).first<{id:string;chat:string;creator:string;kind:string;mode:string;chat_name:string;space:string|null;chat_mode:string}>();if(!room)throw new ApiError('Ce salon vocal est terminé.',404);await member(uid,room.chat);return room;}
export async function POST(request:Request){try{
 sameOrigin(request);if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('Format invalide',415);const raw=await request.text();if(raw.length>120000)throw new ApiError('Requête trop volumineuse',413);const p=JSON.parse(raw),u=await user(),now=Date.now();
 await db().prepare("DELETE FROM media_rooms WHERE expires<? OR state='ended'").bind(now-86400000).run();
 if(p.action==='create'){
  const settings=await db().prepare('SELECT calls_open FROM service_settings WHERE id=1').first<{calls_open:number}>();if(!settings?.calls_open)throw new ApiError('Les appels sont temporairement désactivés.',403);
  const chat=str(p.chat,100),channel=await member(u.id,chat),kind=channel.space&&channel.mode==='voice'?'voice':'group';if(kind==='group'&&chat.startsWith('friend-'))throw new ApiError('Utilisez l’appel privé dans cette discussion.');
  return json(await createMediaRoom(db(),chat,u.id,kind,p.mode==='video'?'video':'audio'));
 }
 if(p.action==='active'){const chat=str(p.chat,100);await member(u.id,chat);const active=await db().prepare("SELECT r.id,r.mode,r.kind,u.name creator_name,(SELECT count(*) FROM media_participants mp WHERE mp.room=r.id AND mp.last_seen>?) participants FROM media_rooms r JOIN users u ON u.id=r.creator WHERE r.chat=? AND r.state='open' AND r.expires>? ORDER BY r.created DESC LIMIT 1").bind(now-30000,chat,now).first();return json({room:active||null});}
 if(p.action==='active_many')return json({rooms:await activeRoomBatch(db(),u.id,p.chats,now)});
 const id=str(p.id,100),room=await roomFor(u.id,id);
 if(p.joined!==undefined&&(!Number.isSafeInteger(p.joined)||p.joined<1))throw new ApiError('Session vocale invalide.');
 if(p.action==='info'){const participants=await db().prepare('SELECT mp.user,mp.joined,u.name FROM media_participants mp JOIN users u ON u.id=mp.user WHERE mp.room=? AND mp.last_seen>? ORDER BY mp.joined').bind(id,now-30000).all();return json({room,participants:participants.results,me:u.id});}
 if(p.action==='join'){
  const result=await db().batch([
   db().prepare('INSERT INTO media_participants(room,"user",joined,last_seen) VALUES (?,?,?,?) ON CONFLICT(room,"user") DO UPDATE SET last_seen=excluded.last_seen RETURNING joined').bind(id,u.id,now,now),
   db().prepare('DELETE FROM media_signals WHERE room=? AND (sender=? OR recipient=?) AND created<(SELECT joined FROM media_participants WHERE room=? AND "user"=?)').bind(id,u.id,u.id,id,u.id),
  ]);
  return json({room,me:u.id,joined:result[0].results[0].joined,ice:iceConfiguration(u.id)});
 }
 if(p.action==='poll'){
  const reliable=p.reliable===true;
  if(reliable&&p.acknowledgements!==undefined&&(!Array.isArray(p.acknowledgements)||p.acknowledgements.length>100))throw new ApiError('Accusés de réception invalides.');
  const acknowledgements=reliable?[...new Set((p.acknowledgements||[]).map((value:unknown)=>str(value,100)))]:[];
  const mine=await db().prepare('SELECT joined FROM media_participants WHERE room=? AND "user"=?').bind(id,u.id).first<{joined:number}>();
  if(p.joined!==undefined){
   // A heartbeat must not silently recreate a membership after leave/expiry.
   if(!mine)return json({rejoin:true,participants:[],signals:[]});
   if(Number(mine.joined)!==p.joined)throw new ApiError('Cette session vocale a été remplacée. Rejoignez le salon.',409);
  }
  await db().prepare('UPDATE media_participants SET last_seen=? WHERE room=? AND "user"=?').bind(now,id,u.id).run();
  await db().prepare('DELETE FROM media_participants WHERE room=? AND last_seen<?').bind(id,now-30000).run();
  if(acknowledgements.length)await db().driver.query('DELETE FROM media_signals WHERE room=$1 AND recipient=$2 AND id=ANY($3::text[])',[id,u.id,acknowledgements]);
  const participants=await db().prepare('SELECT mp.user,mp.joined,u.name FROM media_participants mp JOIN users u ON u.id=mp.user WHERE mp.room=? ORDER BY mp.joined').bind(id).all();
  const signals=await db().prepare('SELECT s.id,s.sender,s.type,s.payload FROM media_signals s JOIN media_participants sender ON sender.room=s.room AND sender."user"=s.sender JOIN media_participants recipient ON recipient.room=s.room AND recipient."user"=s.recipient WHERE s.room=? AND s.recipient=? AND s.created>=sender.joined AND s.created>=recipient.joined ORDER BY s.created,s.id LIMIT 100').bind(id,u.id).all<{id:string}>();
  // Older clients consume immediately. New clients acknowledge only messages
  // they have processed, so a lost response cannot consume their negotiation.
  if(!reliable&&signals.results.length)await db().driver.query('DELETE FROM media_signals WHERE room=$1 AND recipient=$2 AND id=ANY($3::text[])',[id,u.id,signals.results.map(signal=>signal.id)]);
  return json({participants:participants.results,signals:signals.results});
 }
 if(p.action==='signal'){
  const recipient=str(p.recipient,100),type=p.type==='answer'?'answer':'offer',payload=str(p.payload,100000);
  const present=await db().prepare('SELECT "user",joined FROM media_participants WHERE room=? AND "user" IN (?,?) AND last_seen>?').bind(id,u.id,recipient,now-30000).all<{user:string;joined:number}>();
  const sender=present.results.find(person=>person.user===u.id),target=present.results.find(person=>person.user===recipient);
  if(!sender||!target)throw new ApiError('Ce participant a quitté le salon.',409);
  if((p.joined!==undefined&&p.joined!==Number(sender.joined))||(p.recipientJoined!==undefined&&p.recipientJoined!==Number(target.joined)))throw new ApiError('La connexion vocale a changé. Nouvelle tentative en cours.',409);
  await db().prepare('INSERT INTO media_signals(id,room,sender,recipient,type,payload,created) VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,u.id,recipient,type,payload,now).run();return json({ok:true});
 }
 if(p.action==='leave'){await db().batch([
  db().prepare('DELETE FROM media_participants WHERE room=? AND "user"=? AND (?::bigint IS NULL OR joined=?)').bind(id,u.id,p.joined??null,p.joined??null),
  db().prepare('DELETE FROM media_signals WHERE room=? AND (sender=? OR recipient=?) AND NOT EXISTS (SELECT 1 FROM media_participants WHERE room=? AND "user"=?)').bind(id,u.id,u.id,id,u.id),
 ]);return json({ok:true});}
 if(p.action==='end'){if(room.creator!==u.id)await manager(u.id,room.chat);await db().prepare("UPDATE media_rooms SET state='ended' WHERE id=?").bind(id).run();return json({ok:true});}
 throw new ApiError('Action inconnue');
}catch(e){return fail(e);}}
