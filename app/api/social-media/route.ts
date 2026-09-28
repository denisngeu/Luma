import {ApiError,bucket,db,fail,sameOrigin,user} from '@/lib/chat-server';

const allowed=new Map([
 ['image/jpeg','image'],['image/png','image'],['image/webp','image'],['image/gif','image'],['image/avif','image'],
 ['video/mp4','video'],['video/webm','video'],['video/quicktime','video']
]);

export async function POST(request:Request){const keys:string[]=[];try{
 sameOrigin(request);const u=await user();
 if(Number(request.headers.get('content-length')||0)>82*1024*1024)throw new ApiError('Publication trop volumineuse (80 Mo maximum).',413);
 const form=await request.formData(),body=String(form.get('body')||'').trim();
 if(body.length>3000)throw new ApiError('Le texte est limité à 3 000 caractères.');
 const files=form.getAll('media').filter((value):value is File=>value instanceof File&&value.size>0);
 if(!body&&files.length===0)throw new ApiError('Ajoutez un texte, une photo ou une vidéo.');
 if(files.length>4)throw new ApiError('Quatre médias maximum par publication.');
 let total=0;for(const file of files){const kind=allowed.get(file.type);if(!kind)throw new ApiError('Format accepté : JPG, PNG, WebP, GIF, AVIF, MP4, WebM ou MOV.',415);const max=kind==='image'?12*1024*1024:60*1024*1024;if(file.size>max)throw new ApiError(kind==='image'?'Une image dépasse 12 Mo.':'Une vidéo dépasse 60 Mo.',413);total+=file.size;}if(total>80*1024*1024)throw new ApiError('Les médias dépassent 80 Mo au total.',413);
 const count=await db().prepare('SELECT count(*) n FROM posts WHERE author=? AND created>?').bind(u.id,Date.now()-86400000).first<{n:number}>();if((count?.n||0)>=50)throw new ApiError('Vous pouvez publier 50 fois par jour.',429);
 const created=Date.now(),id=String(created).padStart(15,'0')+'-'+crypto.randomUUID();
 for(const file of files){const key=crypto.randomUUID();keys.push(key);await bucket().put(key,file.stream(),{httpMetadata:{contentType:file.type}});}
 await db().batch([db().prepare('INSERT INTO posts(id,author,body,created) VALUES (?,?,?,?)').bind(id,u.id,body,created),...files.map((file,i)=>db().prepare('INSERT INTO post_media(post,key,kind,mime,filename,size,position) VALUES (?,?,?,?,?,?,?)').bind(id,keys[i],allowed.get(file.type),file.type,file.name.replace(/[\r\n\x00-\x1f]/g,'').slice(0,200)||`media-${i+1}`,file.size,i))]);
 return Response.json({id});
}catch(e){await Promise.all(keys.map(key=>bucket().delete(key).catch(()=>{})));return fail(e);}}

export async function GET(request:Request){try{
 const u=await user(),key=new URL(request.url).searchParams.get('key')||'';if(!/^[0-9a-f-]{36}$/i.test(key))throw new ApiError('Média introuvable',404);
 const media=await db().prepare(`SELECT m.mime,m.filename FROM post_media m JOIN posts p ON p.id=m.post JOIN users a ON a.id=p.author WHERE m.key=? AND p.hidden=0 AND a.closed=0 AND (p.author=? OR EXISTS(SELECT 1 FROM friendships f WHERE f.state='accepted' AND ((f.sender=? AND f.recipient=p.author) OR (f.recipient=? AND f.sender=p.author))))`).bind(key,u.id,u.id,u.id).first<{mime:string;filename:string}>();
 if(!media)throw new ApiError('Média introuvable',404);const file=await bucket().get(key);if(!file)throw new ApiError('Média introuvable',404);
 return new Response(file.body,{headers:{'Content-Type':media.mime,'Content-Disposition':`inline; filename*=UTF-8''${encodeURIComponent(media.filename)}`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(e){return fail(e);}}
