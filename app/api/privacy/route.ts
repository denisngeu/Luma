import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ApiError,bucket,db,fail,sameOrigin,str,user} from '@/lib/chat-server';

const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
async function identity(){const u=await getChatGPTUser();if(!u)throw new ApiError('Connectez-vous pour gérer vos données.',401);return u;}

export async function GET(request:Request){try{
 const u=await identity();const url=new URL(request.url);const section=url.searchParams.get('section')||'profile';
 const after=url.searchParams.get('after')||'';
 if(section==='profile')return json({profile:await db().prepare('SELECT name,closed FROM users WHERE id=?').bind(u.userId).first(),identity:{id:u.userId,name:u.fullName,email:u.email},pendingFiles:(await db().prepare('SELECT count(*) AS n FROM erasure_files WHERE user=?').bind(u.userId).first<{n:number}>())?.n||0});
 // Keyset pagination keeps exports bounded and excludes other participants' content and invitation secrets.
 const queries:Record<string,string>={messages:'SELECT id,chat,body,created,scheduled,reply,file,filename,pinned,edited FROM messages WHERE author=? AND id>? ORDER BY id LIMIT 100',stars:'SELECT message AS id FROM stars WHERE user=? AND message>? ORDER BY message LIMIT 100',votes:'SELECT message AS id,choice FROM votes WHERE user=? AND message>? ORDER BY message LIMIT 100',memberships:'SELECT chat AS id FROM members WHERE user=? AND chat>? ORDER BY chat LIMIT 100',communities:'SELECT space AS id,role FROM space_members WHERE user=? AND space>? ORDER BY space LIMIT 100',reactions:"SELECT message || ':' || emoji AS id,message,emoji FROM reactions WHERE user=? AND (message || ':' || emoji)>? ORDER BY id LIMIT 100"};
 queries.ownedChats='SELECT id,name,kind,space,mode,topic,created FROM chats WHERE owner=? AND id>? ORDER BY id LIMIT 100';
 queries.ownedCommunities='SELECT id,name,description,created FROM spaces WHERE owner=? AND id>? ORDER BY id LIMIT 100';
 queries.polls='SELECT p.message AS id,p.options,p.closed FROM polls p JOIN messages m ON m.id=p.message WHERE m.author=? AND p.message>? ORDER BY p.message LIMIT 100';
 queries.contacts='SELECT user AS id,discoverable FROM contacts WHERE user=? AND user>? ORDER BY user LIMIT 100';
 queries.friendships='SELECT id,sender,recipient,state,created FROM friendships WHERE (sender=? OR recipient=?) AND id>? ORDER BY id LIMIT 100';
 queries.socialProfile='SELECT user AS id,bio FROM social_profiles WHERE user=? AND user>? ORDER BY user LIMIT 100';
 queries.posts='SELECT id,body,created,edited FROM posts WHERE author=? AND id>? ORDER BY id LIMIT 100';
 queries.postComments='SELECT id,post,body,created FROM post_comments WHERE author=? AND id>? ORDER BY id LIMIT 100';
 queries.postLikes='SELECT post AS id FROM post_likes WHERE user=? AND post>? ORDER BY post LIMIT 100';
 if(!queries[section])throw new ApiError('Export inconnu');
 const rows=await db().prepare(queries[section]).bind(...(section==='friendships'?[u.userId,u.userId,after]:[u.userId,after])).all<{id:string}>();
 return json({items:rows.results,next:rows.results.length===100?rows.results.at(-1)!.id:null});
 }catch(e){return fail(e);}}

export async function POST(request:Request){try{
 sameOrigin(request);if(request.headers.get('sec-fetch-site')==='cross-site')throw new ApiError('Origine refusée',403);
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('Format refusé',415);
 const raw=await request.text();if(raw.length>2048)throw new ApiError('Requête trop volumineuse',413);
 const p=JSON.parse(raw);const u=await identity();
 if(p.action==='rename'){await user();const name=str(p.name,80);await db().prepare('UPDATE users SET name=? WHERE id=? AND closed=0').bind(name,u.userId).run();return json({ok:true});}
 if(p.action==='close'){
  if(p.confirmation!=='SUPPRIMER')throw new ApiError('Saisissez SUPPRIMER pour confirmer.');
  // A shared space must keep a real administrator. Never delete other members' content.
  const owned=await db().prepare('SELECT id,name FROM spaces WHERE owner=? LIMIT 100').bind(u.userId).all();
  if(owned.results.length)throw new ApiError('Transférez vos communautés à un autre membre depuis cette page avant de fermer votre compte.',409);
  const sql=[
   'DELETE FROM post_comments WHERE author=? OR post IN (SELECT id FROM posts WHERE author=?)',
   'DELETE FROM post_likes WHERE user=? OR post IN (SELECT id FROM posts WHERE author=?)',
   'DELETE FROM posts WHERE author=?',
   'DELETE FROM social_profiles WHERE user=?',
   'DELETE FROM contacts WHERE user=?',
   'DELETE FROM friendships WHERE sender=? OR recipient=?',
   'DELETE FROM calls WHERE caller=? OR callee=?',
   "UPDATE users SET closed=1,name='Compte supprimé' WHERE id=?",
   'INSERT OR IGNORE INTO erasure_files(key,user,created) SELECT file,author,? FROM messages WHERE author=? AND file IS NOT NULL',
   'DELETE FROM votes WHERE user=? OR message IN (SELECT id FROM messages WHERE author=?)',
   'DELETE FROM polls WHERE message IN (SELECT id FROM messages WHERE author=?)',
   'DELETE FROM reactions WHERE user=? OR message IN (SELECT id FROM messages WHERE author=?)',
   'DELETE FROM stars WHERE user=? OR message IN (SELECT id FROM messages WHERE author=?)',
   'UPDATE messages SET reply=NULL WHERE reply IN (SELECT id FROM messages WHERE author=?)',
   'DELETE FROM messages WHERE author=?',
   'DELETE FROM members WHERE user=?',
   'DELETE FROM space_members WHERE user=?',
   "UPDATE chats SET owner=COALESCE((SELECT user FROM members WHERE chat=chats.id ORDER BY user LIMIT 1),owner),invite=lower(hex(randomblob(16))) WHERE owner=?",
  ];
  const args=[[u.userId,u.userId],[u.userId,u.userId],[u.userId],[u.userId],[u.userId],[u.userId,u.userId],[u.userId,u.userId],[u.userId],[Date.now(),u.userId],[u.userId,u.userId],[u.userId],[u.userId,u.userId],[u.userId,u.userId],[u.userId],[u.userId],[u.userId],[u.userId],[u.userId]];
  await db().batch(sql.map((s,i)=>db().prepare(s).bind(...args[i])));
  return json({closed:true,pendingFiles:true});
 }
 if(p.action==='cleanup'){
  const files=await db().prepare('SELECT key FROM erasure_files WHERE user=? LIMIT 50').bind(u.userId).all<{key:string}>();
  for(const f of files.results){await bucket().delete(f.key);await db().prepare('DELETE FROM erasure_files WHERE key=? AND user=?').bind(f.key,u.userId).run();}
  const remaining=await db().prepare('SELECT count(*) AS n FROM erasure_files WHERE user=?').bind(u.userId).first<{n:number}>();return json({remaining:remaining?.n||0});
 }
 if(p.action==='owned')return json({spaces:(await db().prepare('SELECT id,name FROM spaces WHERE owner=?').bind(u.userId).all()).results});
 if(p.action==='candidates'){const space=str(p.space,100);const own=await db().prepare('SELECT 1 FROM spaces WHERE id=? AND owner=?').bind(space,u.userId).first();if(!own)throw new ApiError('Communauté introuvable',404);return json({candidates:(await db().prepare('SELECT u.id,u.name FROM space_members m JOIN users u ON u.id=m.user WHERE m.space=? AND u.id!=? AND u.closed=0 ORDER BY u.name LIMIT 500').bind(space,u.userId).all()).results});}
 if(p.action==='transfer'){
  await user();const space=str(p.space,100),target=str(p.target,100);if(target===u.userId)throw new ApiError('Choisissez un autre membre.');
  const eligible=await db().prepare('SELECT 1 FROM spaces s JOIN space_members m ON m.space=s.id JOIN users u ON u.id=m.user WHERE s.id=? AND s.owner=? AND m.user=? AND u.closed=0').bind(space,u.userId,target).first();if(!eligible)throw new ApiError('Choisissez un membre actif de votre communauté.',403);
  await db().batch([db().prepare("UPDATE space_members SET role='member' WHERE space=? AND user=? AND EXISTS(SELECT 1 FROM spaces WHERE id=? AND owner=?)").bind(space,u.userId,space,u.userId),db().prepare("UPDATE space_members SET role='owner' WHERE space=? AND user=? AND EXISTS(SELECT 1 FROM spaces WHERE id=? AND owner=?)").bind(space,target,space,u.userId),db().prepare('UPDATE spaces SET owner=? WHERE id=? AND owner=?').bind(target,space,u.userId)]);return json({ok:true});
 }
 throw new ApiError('Action inconnue');
 }catch(e){return fail(e);}}
