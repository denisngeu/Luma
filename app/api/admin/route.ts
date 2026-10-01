import {getChatGPTUser} from '@/app/chatgpt-auth';
import {isAdministrator} from '@/lib/admin';
import {adminAction} from '@/lib/admin-console';
import {ApiError,db,fail,sameOrigin} from '@/lib/chat-server';
const json=(data:unknown)=>Response.json(data,{headers:{'Cache-Control':'private, no-store'}});
async function identity(){const u=await getChatGPTUser();if(!u)throw new ApiError('Connexion requise.',401);if(!await isAdministrator(u.userId))throw new ApiError('Accès administrateur requis.',403);return u;}
export async function GET(request:Request){try{
 const me=await identity(),url=new URL(request.url),section=url.searchParams.get('section')||'overview';
 const search=(url.searchParams.get('q')||'').slice(0,100),page=Math.max(0,Math.min(100000,Number(url.searchParams.get('page'))||0));
 if(!Number.isInteger(page))throw new ApiError('Page invalide.');
 const now=Date.now(),driver=db().driver;
 if(section==='overview'){
  const start=Date.now();
  const stats=(await driver.query(`SELECT (SELECT count(*) FROM users WHERE closed=0) users,(SELECT count(*) FROM users WHERE suspended=1 AND closed=0) suspended,(SELECT count(DISTINCT "user") FROM auth_sessions WHERE expires>$1) sessions,(SELECT count(*) FROM messages) messages,(SELECT count(*) FROM messages WHERE created>$2) messages_today,(SELECT count(*) FROM spaces) spaces,(SELECT count(*) FROM calls WHERE state IN ('preparing','ringing','active') AND expires>$1) calls,(SELECT count(*) FROM reports WHERE state='open') reports,(SELECT count(*) FROM auth_accounts WHERE created>$2) signups_today`,[now,now-86400000])).rows[0];
  const activity=(await driver.query('SELECT floor(created/86400000)*86400000 AS "day",count(*) count FROM messages WHERE created>$1 GROUP BY 1 ORDER BY 1',[Math.floor(now/86400000)*86400000-13*86400000])).rows;
  return json({stats,activity,latency:Date.now()-start,checkedAt:now,me:me.userId});
 }
 if(section==='settings')return json({settings:(await driver.query('SELECT registrations_open,calls_open FROM service_settings WHERE id=1')).rows[0]});
 if(section==='simulation'){const {getSimulationStatus}=await import('@/lib/simulation');return json(await getSimulationStatus());}
 const queries:Record<string,string>={
  users:`SELECT u.id,u.name,u.role,u.closed,u.suspended,a.email,a.created,(SELECT count(*) FROM auth_sessions s WHERE s."user"=u.id AND s.expires>${now}) sessions FROM users u LEFT JOIN auth_accounts a ON a."user"=u.id WHERE strpos(lower(u.name||' '||coalesce(a.email,'')),lower($1))>0 ORDER BY a.created DESC NULLS LAST,u.id`,
  spaces:`SELECT s.id,s.name,s.description,s.locked,s.created,u.name owner,(SELECT count(*) FROM space_members m WHERE m.space=s.id) members,(SELECT count(*) FROM chats c WHERE c.space=s.id) channels FROM spaces s JOIN users u ON u.id=s.owner WHERE strpos(lower(s.name),lower($1))>0 ORDER BY s.created DESC,s.id`,
  chats:`SELECT c.id,c.name,c.kind,c.mode,c.locked,c.created,s.name space,(SELECT count(*) FROM messages m WHERE m.chat=c.id) messages FROM chats c LEFT JOIN spaces s ON s.id=c.space WHERE strpos(lower(c.name),lower($1))>0 ORDER BY c.created DESC,c.id`,
  calls:`SELECT c.id,c.mode,c.state,c.created,c.expires,a.name caller,b.name callee FROM calls c JOIN users a ON a.id=c.caller JOIN users b ON b.id=c.callee WHERE c.expires>${now} AND strpos(lower(a.name||' '||b.name),lower($1))>0 ORDER BY c.created DESC,c.id`,
  reports:`SELECT r.*,u.name reporter_name,CASE WHEN r.kind='message' THEN (SELECT body FROM messages WHERE id=r.target) WHEN r.kind='post' THEN (SELECT body FROM posts WHERE id=r.target) WHEN r.kind='user' THEN (SELECT name FROM users WHERE id=r.target) ELSE (SELECT name FROM spaces WHERE id=r.target) END content,CASE WHEN r.kind='message' THEN (SELECT hidden FROM messages WHERE id=r.target) WHEN r.kind='post' THEN (SELECT hidden FROM posts WHERE id=r.target) ELSE 0 END hidden FROM reports r JOIN users u ON u.id=r.reporter WHERE strpos(lower(r.reason||' '||r.state||' '||u.name),lower($1))>0 ORDER BY (r.state='open') DESC,r.created DESC,r.id`,
  audit:`SELECT a.id,a.actor,a.action,a.target,a.reason,a.before_state,a.after_state,a.created,coalesce(u.name,'Compte supprimé') actor_name FROM admin_audit a LEFT JOIN users u ON u.id=a.actor WHERE strpos(lower(a.action||' '||a.reason||' '||a.target),lower($1))>0 ORDER BY a.created DESC,a.id`
 };
 if(!Object.hasOwn(queries,section))throw new ApiError('Section inconnue.');
 const rows=(await driver.query(queries[section]+' LIMIT 31 OFFSET $2',[search,page*30])).rows;
 return json({items:rows.slice(0,30),more:rows.length>30,page,me:me.userId});
}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 sameOrigin(request);const me=await identity();
 if(!request.headers.get('content-type')?.startsWith('application/json'))throw new ApiError('Format invalide.',415);
 const raw=await request.text();if(raw.length>4096)throw new ApiError('Requête trop volumineuse.',413);
 let body;try{body=JSON.parse(raw);}catch{throw new ApiError('Requête invalide.');}
 if(!body||typeof body!=='object'||Array.isArray(body))throw new ApiError('Requête invalide.');
 if(body.action==='simulation_generate'){const {generateSimulationData}=await import('@/lib/simulation');return json(await generateSimulationData(me.userId));}
 if(body.action==='simulation_clear'){const {clearSimulationData}=await import('@/lib/simulation');return json(await clearSimulationData(me.userId));}
 return json(await adminAction(me.userId,body));
}catch(e){return fail(e);}}
