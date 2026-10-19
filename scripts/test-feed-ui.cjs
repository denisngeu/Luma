/* Real feed components, isolated HTTP fixtures and browser file uploads. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const dir=path.resolve('.sites-runtime/feed-ui');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==','base64');
const me={id:'me',name:'Moi',bio:'',avatar:false};
const post=(id,author,body,media=[])=>({id,author,name:author==='me'?'Moi':'Alice',avatar:false,body,media,created:1700000000000,edited:0,likes:0,liked:0,comments:0});
let posts=[post('mine','me','Publication personnelle'),post('alice-post','alice','Publication Alice')],comments=[],publishCalls=0,commentCalls=0,uploadCalls=0,holdFeed=false,pendingFeed,pendingFriends=[],failNextFeed=false,server,win;
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'navigation.ts'),`import {useSyncExternalStore} from 'react';const subscribe=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn);};export const usePathname=()=>'/fil';export function useSearchParams(){return new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));}`);
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React from 'react';import {createRoot} from 'react-dom/client';import Feed from '../../app/fil/feed';
   window.__navigate=id=>{history.pushState(null,'',id?'/fil?profil='+id:'/fil');window.dispatchEvent(new PopStateEvent('popstate'));};
   window.__urls=[];window.__revoked=[];const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   URL.createObjectURL=blob=>{const url=create(blob);window.__urls.push(url);return url;};URL.revokeObjectURL=url=>{window.__revoked.push(url);revoke(url);};
   const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<React.StrictMode><Feed/></React.StrictMode>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  server=createServer(async(req,res)=>{
   if(req.url==='/api/friends'){pendingFriends.push(res);return;}
   if(req.url==='/api/social'){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw);res.setHeader('Content-Type','application/json');
    if(p.action==='profile'){res.end(JSON.stringify({profile:p.user?{...me,id:p.user,name:'Alice'}:me}));return;}
    if(p.action==='feed'){
     const data={items:posts.filter(post=>!p.author||post.author===p.author),next:null};
     if(holdFeed&&!p.author){holdFeed=false;pendingFeed={res,data};return;}
     if(failNextFeed){failNextFeed=false;res.statusCode=503;res.end('{"error":"Actualisation temporairement indisponible."}');return;}
     res.end(JSON.stringify(data));return;
    }
    if(p.action==='publish'){publishCalls++;await wait(150);if(publishCalls===1){res.statusCode=503;res.end('{"error":"Publication temporairement indisponible."}');return;}posts=[post('published','me',p.body),...posts];res.end('{"id":"published"}');return;}
    if(p.action==='comments'){res.end(JSON.stringify({items:comments,next:null}));return;}
    if(p.action==='comment'){commentCalls++;await wait(100);comments.push({id:'comment-1',author:'me',name:'Moi',avatar:false,body:p.body,created:1700000000000});posts=posts.map(post=>post.id===p.id?{...post,comments:comments.length}:post);res.end('{"ok":true}');return;}
    res.end('{"ok":true}');return;
   }
   if(req.url==='/api/social-media'&&req.method==='POST'){
    const chunks=[];for await(const chunk of req)chunks.push(chunk);uploadCalls++;res.setHeader('Content-Type','application/json');
    assert.match(req.headers['content-type'],/^multipart\/form-data; boundary=/);assert.match(Buffer.concat(chunks).toString(),/filename="photo.png"/);
    if(uploadCalls===1){res.statusCode=503;res.end('{"error":"Média temporairement indisponible."}');return;}
    posts=[post('media-post','me','Avec une photo',[{key:'test-image',kind:'image',mime:'image/png',filename:'photo.png',size:png.length}]),...posts];failNextFeed=true;res.end('{"id":"media-post"}');return;
   }
   if(req.url.startsWith('/api/social-media?')){res.setHeader('Content-Type','image/png');res.end(png);return;}
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   const css=['app/themes.css','app/network.css','app/feed-v2.css'].map(file=>readFileSync(file,'utf8')).join('\n');
   res.setHeader('Content-Type','text/html');res.end('<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}'+css+'.network>.social-nav{display:none}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  win=new BrowserWindow({width:1100,height:850});await win.loadURL(origin+'/fil');
  await until(()=>run(win,"!!document.querySelector('.social-post')&&!document.querySelector('[role=status]')"),'feed loads without waiting for friend list');
  assert.ok(pendingFriends.length>0);for(const res of pendingFriends)if(!res.destroyed){res.statusCode=503;res.end('{"error":"Contacts indisponibles"}');}pendingFriends=[];
  await win.page.getByLabel('Qu’avez-vous envie de partager ?').fill('Mon nouveau message');
  await run(win,"const form=document.querySelector('.post-composer');form.requestSubmit();form.requestSubmit()");
  await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('Publication temporairement')"),'publish failure shown');
  assert.equal(publishCalls,1,'duplicate submission blocked');assert.equal(await win.page.getByLabel('Qu’avez-vous envie de partager ?').inputValue(),'Mon nouveau message','failed publication preserves draft');
  await win.page.getByRole('button',{name:'Publier',exact:true}).click();
  await until(()=>run(win,"[...document.querySelectorAll('.post-body')].some(p=>p.textContent==='Mon nouveau message')"),'published post refreshed');
  assert.equal(publishCalls,2);assert.equal(await win.page.getByLabel('Qu’avez-vous envie de partager ?').inputValue(),'');
  const own=win.page.locator('.social-post').filter({hasText:'Publication personnelle'});
  await own.getByRole('button',{name:'0 commentaires',exact:true}).click();await own.getByLabel('Votre commentaire').fill('Une seule réponse');
  await own.locator('form').evaluate(form=>{form.requestSubmit();form.requestSubmit();});
  await until(()=>run(win,"!!document.querySelector('.social-comment')"),'comment refreshed');assert.equal(commentCalls,1,'duplicate comment blocked');
  holdFeed=true;await win.page.getByRole('button',{name:'Actualiser le fil'}).click();await until(()=>!!pendingFeed,'old feed request held');
  await run(win,"window.__navigate('alice')");await until(()=>run(win,"document.querySelector('.feed-heading h1')?.textContent==='Alice'&&document.querySelectorAll('.post-body').length===1"),'profile filter loaded');
  if(!pendingFeed.res.destroyed)pendingFeed.res.end(JSON.stringify(pendingFeed.data));await run(win,'new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))');
  assert.equal(await run(win,"document.querySelector('.post-body').textContent"),'Publication Alice','old refresh does not replace selected profile');
  await run(win,"window.__navigate('')");await until(()=>run(win,"!!document.querySelector('.media-picker input:not(:disabled)')"),'main feed ready');
  const input=win.page.locator('.media-picker input');
  await input.setInputFiles(Array.from({length:5},(_,i)=>({name:'photo-'+i+'.png',mimeType:'image/png',buffer:png})));
  await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('Quatre médias')"),'media count warning');assert.equal(await run(win,"document.querySelectorAll('.composer-media img').length"),0);
  await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});await win.page.getByLabel('Qu’avez-vous envie de partager ?').fill('Avec une photo');
  await win.page.getByRole('button',{name:'Publier',exact:true}).click();await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('Média temporairement')"),'media failure shown');
  assert.equal(await run(win,"document.querySelectorAll('.composer-media img').length"),1,'failed media upload keeps preview');
  await win.page.getByRole('button',{name:'Publier',exact:true}).click();
  await until(()=>run(win,"document.querySelector('[role=status]')?.textContent.includes('Publication partagée')&&document.querySelector('[role=alert]')?.textContent.includes('Actualisation temporairement')"),'successful upload distinguished from refresh failure');
  await win.page.getByRole('button',{name:'Actualiser le fil'}).click();await until(()=>run(win,"!!document.querySelector('.social-post img[src*=social-media]')"),'uploaded media visible after refresh');
  await input.setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});await until(()=>run(win,"!!document.querySelector('.composer-media img')"),'preview before navigation');
  await run(win,'window.__unmount()');assert.equal(await run(win,"window.__urls.every(url=>window.__revoked.includes(url))"),true,'all preview URLs released');
  console.log('PASS independent feed loading, publish/comment duplicate guards, failed draft retention, profile race cancellation, media validation/upload retry and preview cleanup.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));}catch{}process.exitCode=1;}
 finally{win?.destroy();for(const res of pendingFriends)if(!res.destroyed)res.end('{}');if(pendingFeed&&!pendingFeed.res.destroyed)pendingFeed.res.end('{}');server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
