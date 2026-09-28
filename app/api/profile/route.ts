import {ApiError,bucket,db,fail,sameOrigin,str,user} from '@/lib/chat-server';

const avatarTypes=new Set(['image/jpeg','image/png','image/webp','image/avif']);

export async function POST(request:Request){let uploaded:string|undefined;try{
 sameOrigin(request);const u=await user();const type=request.headers.get('content-type')||'';
 if(type.startsWith('multipart/form-data')){
  if(Number(request.headers.get('content-length')||0)>6*1024*1024)throw new ApiError('Photo trop volumineuse (5 Mo maximum).',413);
  const form=await request.formData(),name=str(form.get('name'),60),bio=typeof form.get('bio')==='string'?String(form.get('bio')).trim():'';if(bio.length>280)throw new ApiError('La bio est limitée à 280 caractères.');
  const image=form.get('avatar'),old=await db().prepare('SELECT avatar FROM social_profiles WHERE user=?').bind(u.id).first<{avatar:string|null}>();let key=old?.avatar||null,mime:string|null=null;
  if(image instanceof File&&image.size){if(image.size>5*1024*1024||!avatarTypes.has(image.type))throw new ApiError('Choisissez une image JPG, PNG, WebP ou AVIF de 5 Mo maximum.',415);uploaded=crypto.randomUUID();await bucket().put(uploaded,image.stream(),{httpMetadata:{contentType:image.type}});key=uploaded;mime=image.type;}
  await db().batch([db().prepare('UPDATE users SET name=? WHERE id=? AND closed=0').bind(name,u.id),db().prepare('INSERT INTO social_profiles(user,bio,avatar,avatar_mime) VALUES (?,?,?,?) ON CONFLICT(user) DO UPDATE SET bio=excluded.bio,avatar=COALESCE(excluded.avatar,social_profiles.avatar),avatar_mime=COALESCE(excluded.avatar_mime,social_profiles.avatar_mime)').bind(u.id,bio,key,mime)]);
  if(uploaded&&old?.avatar&&old.avatar!==uploaded)await bucket().delete(old.avatar).catch(()=>{});return Response.json({ok:true,avatar:!!key});
 }
 if(!type.startsWith('application/json'))throw new ApiError('Format invalide',415);const p=await request.json() as Record<string,unknown>;
 const notifications=['all','mentions','none'].includes(String(p.notifications))?String(p.notifications):'mentions';
 await db().prepare('INSERT INTO user_preferences("user",notifications,call_camera,call_noise_suppression,call_echo_cancellation,reduce_motion,updated) VALUES (?,?,?,?,?,?,?) ON CONFLICT("user") DO UPDATE SET notifications=excluded.notifications,call_camera=excluded.call_camera,call_noise_suppression=excluded.call_noise_suppression,call_echo_cancellation=excluded.call_echo_cancellation,reduce_motion=excluded.reduce_motion,updated=excluded.updated').bind(u.id,notifications,p.callCamera?1:0,p.noiseSuppression===false?0:1,p.echoCancellation===false?0:1,p.reduceMotion?1:0,Date.now()).run();return Response.json({ok:true});
 }catch(e){if(uploaded)await bucket().delete(uploaded).catch(()=>{});return fail(e);}}

export async function GET(request:Request){try{const u=await user(),url=new URL(request.url),target=url.searchParams.has('avatar')?u.id:url.searchParams.get('user');
 if(!target){const profile=await db().prepare("SELECT u.name,COALESCE(s.bio,'') bio,(s.avatar IS NOT NULL) avatar,COALESCE(p.notifications,'mentions') notifications,COALESCE(p.call_camera,0) call_camera,COALESCE(p.call_noise_suppression,1) call_noise_suppression,COALESCE(p.call_echo_cancellation,1) call_echo_cancellation,COALESCE(p.reduce_motion,0) reduce_motion FROM users u LEFT JOIN social_profiles s ON s.user=u.id LEFT JOIN user_preferences p ON p.\"user\"=u.id WHERE u.id=?").bind(u.id).first();return Response.json({profile},{headers:{'Cache-Control':'private, no-store'}});}
 const visible=await db().prepare(`SELECT s.avatar,s.avatar_mime FROM social_profiles s WHERE s.user=? AND s.avatar IS NOT NULL AND (?=s.user OR EXISTS(SELECT 1 FROM friendships f WHERE f.state='accepted' AND ((f.sender=? AND f.recipient=s.user) OR (f.recipient=? AND f.sender=s.user))) OR EXISTS(SELECT 1 FROM space_members mine JOIN space_members theirs ON theirs.space=mine.space WHERE mine.user=? AND theirs.user=s.user))`).bind(target,u.id,u.id,u.id,u.id).first<{avatar:string;avatar_mime:string}>();
 if(!visible)throw new ApiError('Photo indisponible',404);const file=await bucket().get(visible.avatar);if(!file)throw new ApiError('Photo indisponible',404);return new Response(file.body,{headers:{'Content-Type':visible.avatar_mime||'image/jpeg','Cache-Control':'private, max-age=300','X-Content-Type-Options':'nosniff'}});
 }catch(e){return fail(e);}}
