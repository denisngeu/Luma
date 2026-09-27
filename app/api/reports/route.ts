import {ApiError,db,fail,sameOrigin,str,user} from '@/lib/chat-server';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
const visibility:Record<string,string>={
 message:`SELECT m.id,substr(m.body,1,100)||coalesce(' · '||m.filename,'') label FROM messages m JOIN chats c ON c.id=m.chat WHERE m.hidden=0 AND c.locked=0 AND NOT EXISTS(SELECT 1 FROM spaces s WHERE s.id=c.space AND s.locked=1) AND (m.scheduled<=$2 OR m.author=$1) AND (EXISTS(SELECT 1 FROM members x WHERE x.chat=c.id AND x."user"=$1) OR EXISTS(SELECT 1 FROM space_members x WHERE x.space=c.space AND x."user"=$1))`,
 post:`SELECT p.id,substr(p.body,1,100) label FROM posts p WHERE p.hidden=0 AND p.created<=$2 AND (p.author=$1 OR EXISTS(SELECT 1 FROM friendships f WHERE f.state='accepted' AND ((f.sender=$1 AND f.recipient=p.author) OR (f.recipient=$1 AND f.sender=p.author))))`,
 user:`SELECT u.id,u.name label FROM users u WHERE u.closed=0 AND $2>0 AND (u.id=$1 OR EXISTS(SELECT 1 FROM friendships f WHERE (f.sender=$1 AND f.recipient=u.id) OR (f.recipient=$1 AND f.sender=u.id)) OR EXISTS(SELECT 1 FROM space_members a JOIN space_members b ON a.space=b.space WHERE a."user"=$1 AND b."user"=u.id))`,
 space:`SELECT s.id,s.name label FROM spaces s WHERE $2>0 AND EXISTS(SELECT 1 FROM space_members m WHERE m.space=s.id AND m."user"=$1)`
};
export async function GET(request:Request){try{const u=await user(),params=new URL(request.url).searchParams,kind=params.get('kind')||'message',target=(params.get('target')||'').slice(0,150);if(!Object.hasOwn(visibility,kind))throw new ApiError('Type invalide.');return json({items:(await db().driver.query('SELECT * FROM ('+visibility[kind]+') eligible ORDER BY (id=$3) DESC,id DESC LIMIT 100',[u.id,Date.now(),target])).rows});}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 sameOrigin(request);const u=await user();const raw=await request.text();if(raw.length>3000)throw new ApiError('Requête trop longue.',413);
 let p;try{p=JSON.parse(raw);}catch{throw new ApiError('Requête invalide.');}if(!p||Array.isArray(p))throw new ApiError('Requête invalide.');
 const kind=str(p.kind,20),target=str(p.target,150),reason=str(p.reason,1000);if(reason.length<10)throw new ApiError('Précisez le motif (10 caractères minimum).');
 if(!Object.hasOwn(visibility,kind))throw new ApiError('Type invalide.');
 const exists=await db().driver.query('SELECT id FROM ('+visibility[kind]+') eligible WHERE id=$3',[u.id,Date.now(),target]);if(!exists.rows.length)throw new ApiError('Contenu inaccessible.',404);
 const now=Date.now();
 const result=await db().driver.query(`INSERT INTO reports(id,reporter,kind,target,reason,created) SELECT $1,$2,$3,$4,$5,$6 WHERE (SELECT count(*) FROM reports WHERE reporter=$2 AND created>$7)<20 ON CONFLICT DO NOTHING RETURNING id`,[crypto.randomUUID(),u.id,kind,target,reason,now,now-86400000]);
 if(!result.rows.length)throw new ApiError('Déjà signalé, ou limite de 20 signalements par jour atteinte.',409);
 return json({ok:true});
}catch(e){return fail(e);}}
