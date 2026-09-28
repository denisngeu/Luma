import {ApiError,bucket,db,fail,sameOrigin,str,user} from '@/lib/chat-server';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
// Visibility follows the post owner, not friends-of-friends or commenters.
const visible=`(p.author=? OR EXISTS(SELECT 1 FROM friendships f WHERE f.state='accepted' AND ((f.sender=? AND f.recipient=p.author) OR (f.recipient=? AND f.sender=p.author))))`;
export async function POST(request:Request){try{
 sameOrigin(request);if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('Format invalide',415);
 const raw=await request.text();if(raw.length>12000)throw new ApiError('Publication trop longue',413);
 const p=JSON.parse(raw),u=await user();
 if(p.action==='profile'){
  const id=p.user?str(p.user,100):u.id;
  const profile=await db().prepare(`SELECT u.id,u.name,COALESCE(s.bio,'') bio,(s.avatar IS NOT NULL) avatar FROM users u LEFT JOIN social_profiles s ON s.user=u.id WHERE u.id=? AND u.closed=0 AND (u.id=? OR EXISTS(SELECT 1 FROM friendships f WHERE f.state='accepted' AND ((f.sender=? AND f.recipient=u.id) OR (f.recipient=? AND f.sender=u.id))))`).bind(id,u.id,u.id,u.id).first();
  if(!profile)throw new ApiError('Profil indisponible',404);return json({profile,me:u.id});
 }
 if(p.action==='saveProfile'){
  const name=str(p.name,80),bio=typeof p.bio==='string'?p.bio.trim():'';if(bio.length>280)throw new ApiError('La bio est limitée à 280 caractères.');
  await db().batch([db().prepare('UPDATE users SET name=? WHERE id=? AND closed=0').bind(name,u.id),db().prepare('INSERT INTO social_profiles(user,bio) VALUES (?,?) ON CONFLICT(user) DO UPDATE SET bio=excluded.bio').bind(u.id,bio)]);return json({ok:true});
 }
 if(p.action==='feed'){
  const before=p.before?str(p.before,100):'~',author=typeof p.author==='string'?p.author:'';
  const items=await db().prepare(`SELECT p.*,u.name,EXISTS(SELECT 1 FROM social_profiles sp WHERE sp.user=p.author AND sp.avatar IS NOT NULL) avatar,(SELECT count(*) FROM post_likes l WHERE l.post=p.id) likes,(SELECT count(*) FROM post_comments c WHERE c.post=p.id) comments,EXISTS(SELECT 1 FROM post_likes l WHERE l.post=p.id AND l.user=?) liked FROM posts p JOIN users u ON u.id=p.author WHERE p.hidden=0 AND u.closed=0 AND ${visible} AND p.id<? AND (?='' OR p.author=?) ORDER BY p.id DESC LIMIT 21`).bind(u.id,u.id,u.id,u.id,before,author,author).all();
  const rows=items.results as Array<Record<string,unknown>>;const shown=rows.slice(0,20);const ids=shown.map(x=>x.id as string);let media:Record<string,unknown>[]=[];
  if(ids.length)media=(await db().driver.query(`SELECT post,key,kind,mime,filename,size,position FROM post_media WHERE post IN (${ids.map((_,i)=>'$'+(i+1)).join(',')}) ORDER BY post,position`,ids)).rows;
  for(const row of shown)row.media=media.filter(item=>item.post===row.id);return json({items:shown,next:rows.length>20?rows[19].id:null,user:u});
 }
 if(p.action==='publish'){
  const body=str(p.body,3000);const count=await db().prepare('SELECT count(*) n FROM posts WHERE author=? AND created>?').bind(u.id,Date.now()-86400000).first<{n:number}>();if((count?.n||0)>=50)throw new ApiError('Vous pouvez publier 50 fois par jour.',429);
  const created=Date.now(),id=String(created).padStart(15,'0')+'-'+crypto.randomUUID();await db().prepare('INSERT INTO posts(id,author,body,created) VALUES (?,?,?,?)').bind(id,u.id,body,created).run();return json({id});
 }
 const id=str(p.id,100),post=await db().prepare(`SELECT p.* FROM posts p JOIN users u ON u.id=p.author WHERE p.hidden=0 AND p.id=? AND u.closed=0 AND ${visible}`).bind(id,u.id,u.id,u.id).first<{author:string}>();if(!post)throw new ApiError('Publication indisponible',404);
 if(p.action==='delete'||p.action==='edit'){
  if(post.author!==u.id)throw new ApiError('Cette publication ne vous appartient pas.',403);
  if(p.action==='edit')await db().prepare('UPDATE posts SET body=?,edited=? WHERE id=? AND author=?').bind(str(p.body,3000),Date.now(),id,u.id).run();
  else {const files=await db().prepare('SELECT key FROM post_media WHERE post=?').bind(id).all<{key:string}>();await db().batch([db().prepare('DELETE FROM post_comments WHERE post=?').bind(id),db().prepare('DELETE FROM post_likes WHERE post=?').bind(id),db().prepare('DELETE FROM post_media WHERE post=?').bind(id),db().prepare('DELETE FROM posts WHERE id=? AND author=?').bind(id,u.id)]);await Promise.all(files.results.map(f=>bucket().delete(f.key).catch(()=>{})));}return json({ok:true});
 }
 if(p.action==='like'){if(p.liked===true)await db().prepare('INSERT OR IGNORE INTO post_likes(post,user) VALUES (?,?)').bind(id,u.id).run();else await db().prepare('DELETE FROM post_likes WHERE post=? AND user=?').bind(id,u.id).run();return json({ok:true});}
 if(p.action==='comments'){
  const before=p.before?str(p.before,100):'~';const rows=await db().prepare('SELECT c.*,u.name,EXISTS(SELECT 1 FROM social_profiles sp WHERE sp.user=c.author AND sp.avatar IS NOT NULL) avatar FROM post_comments c JOIN users u ON u.id=c.author WHERE c.post=? AND c.id<? ORDER BY c.id DESC LIMIT 31').bind(id,before).all();return json({items:rows.results.slice(0,30),next:rows.results.length>30?rows.results[29].id:null});
 }
 if(p.action==='comment'){
  const count=await db().prepare('SELECT count(*) n FROM post_comments WHERE author=? AND created>?').bind(u.id,Date.now()-3600000).first<{n:number}>();if((count?.n||0)>=100)throw new ApiError('Trop de commentaires. Réessayez plus tard.',429);
  const created=Date.now();await db().prepare('INSERT INTO post_comments(id,post,author,body,created) VALUES (?,?,?,?,?)').bind(String(created).padStart(15,'0')+'-'+crypto.randomUUID(),id,u.id,str(p.body,1000),created).run();return json({ok:true});
 }
 if(p.action==='deleteComment'){await db().prepare('DELETE FROM post_comments WHERE id=? AND post=? AND (author=? OR ?=?)').bind(str(p.comment,100),id,u.id,post.author,u.id).run();return json({ok:true});}
 throw new ApiError('Action inconnue');
}catch(e){return fail(e);}}
