/* Real community component with delayed HTTP replies and a controlled clock. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path'),assert=require('node:assert/strict'),{build}=require('esbuild');
const dir=path.resolve('.sites-runtime/community-network');mkdirSync(dir,{recursive:true});
let server,win,failListing=true,holdFeed=false,holdSearch=false,holdThread=false,holdSend=false,ambiguous=false,holdSpace=false;
let feedRelease,searchRelease,threadRelease,sendRelease,spaceRelease;const reads=[],writes=[],batchRequests=[],accepted=new Map(),createdChannels=[];let createdSpace=null;
const wait=ms=>new Promise(r=>setTimeout(r,ms));const run=code=>win.webContents.executeJavaScript(code,true);
async function until(fn,label){for(let i=0;i<120;i++){if(await fn())return;await wait(50);}throw Error('Timeout '+label);}
const message=(id,chat,body,author='peer')=>({id,body,name:author==='me'?'Moi':'Contact',author,chat,created:1700000000000,scheduled:0,replies:1,starred:0,pinned:0,edited:0});
const contents={a:[message('a-one','a','Contenu du salon Alpha')],b:[message('b-one','b','Contenu du salon Bêta')]};
const feed=(chat,thread)=>({messages:thread?[message('thread-one',chat,'Réponse du fil '+chat)]:contents[chat]||[],reactions:[],polls:[],votes:[],pinned:[],more:false});
app.whenReady().then(async()=>{try{
 writeFileSync(path.join(dir,'navigation.ts'),"export const useRouter=()=>({push(url){window.__destination=url;}});");
 writeFileSync(path.join(dir,'entry.tsx'),`
 import React from 'react';import {createRoot} from 'react-dom/client';import Community from '../../app/communities/workspace';
 window.__now=Date.now();Date.now=()=>window.__now;window.__pollTimers=new Map();window.__voiceTick=null;let nextTimer=7000;
 const timeout=window.setTimeout.bind(window),clearTimeoutOriginal=window.clearTimeout.bind(window),interval=window.setInterval.bind(window),clearIntervalOriginal=window.clearInterval.bind(window);
 window.setTimeout=(fn,ms,...args)=>{if([4000,8000,16000,32000,60000].includes(ms)){const id=++nextTimer;window.__pollTimers.set(id,{at:window.__now+ms,fn:()=>fn(...args)});return id;}return timeout(fn,ms===12000&&window.__fastTimeout?80:ms,...args);};
 window.clearTimeout=id=>window.__pollTimers.delete(id)||clearTimeoutOriginal(id);
 window.setInterval=(fn,ms,...args)=>ms===8000?(window.__voiceTick=()=>fn(...args),6001):interval(fn,ms,...args);
 window.clearInterval=id=>id===6001?(window.__voiceTick=null):clearIntervalOriginal(id);
 window.__advance=ms=>{window.__now+=ms;const due=[...window.__pollTimers].filter(([,timer])=>timer.at<=window.__now);for(const [id,timer] of due){window.__pollTimers.delete(id);timer.fn();}};
 const fetchOriginal=window.fetch;window.__aborts=0;
 window.fetch=(url,options={})=>{let body={};try{body=JSON.parse(options.body||'{}')}catch{}
  if(options.signal)options.signal.addEventListener('abort',()=>window.__aborts++,{once:true});
  const ignore=body.action==='feed'&&window.__ignoreNextFeed||body.action==='search'&&window.__ignoreSearch||body.action==='space'&&window.__ignoreNextSpace;
  if(body.action==='space'&&window.__ignoreNextSpace)window.__ignoreNextSpace=false;
  if(body.action==='feed'&&window.__ignoreNextFeed)window.__ignoreNextFeed=false;
  return fetchOriginal(url,ignore?{...options,signal:undefined}:options);
 };
 const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<React.StrictMode><Community/></React.StrictMode>);
 `);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
 const css=require('./compiled-styles.cjs')();
 server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){
   let raw='';for await(const chunk of req)raw+=chunk;const p=JSON.parse(raw||'{}');res.setHeader('Content-Type','application/json');
   const finish=(data,status=200)=>{if(!res.destroyed){res.statusCode=status;res.end(JSON.stringify(data));}};
   if(req.url==='/api/rooms'){assert.equal(p.action,'active_many');assert.equal(p.chats.length,48);batchRequests.push(p);finish({rooms:Object.fromEntries(p.chats.map(id=>[id,null]))});return;}
   if(req.url==='/api/chat'){
    if(p.action==='list'){finish({user:{id:'me',name:'Moi'},chats:[]});return;}
    if(p.action==='send'){
     writes.push(p);assert.match(p.clientId,/^[0-9a-f-]{36}$/);
     if(!accepted.has(p.clientId)){const item=message('sent-'+p.clientId,p.chat,p.body,'me');accepted.set(p.clientId,item);contents[p.chat].push(item);}
     if(holdSend){holdSend=false;sendRelease=()=>finish({id:accepted.get(p.clientId).id});return;}
     if(ambiguous){ambiguous=false;finish({error:'Réponse perdue après enregistrement'},503);return;}
     finish({id:accepted.get(p.clientId).id});return;
    }
   }
   if(p.action==='spaces'){
    if(failListing){failListing=false;finish({error:'Chargement temporairement indisponible'},503);return;}
    finish({spaces:[{id:'space',name:'Communauté',role:'owner'},{id:'other',name:'Autre communauté',role:'owner'},...(createdSpace?[createdSpace]:[])],user:{id:'me',name:'Moi'}});return;
   }
   if(p.action==='create_channel'){const id='created-channel';createdChannels.push({id,name:p.name,mode:p.mode,owner:'me'});contents[id]=[];finish({id});return;}
   if(p.action==='join_space'){finish({id:'space'});return;}
   if(p.action==='create_space'){createdSpace={id:'created-space',name:p.name,description:p.description,role:'owner'};finish({id:createdSpace.id});return;}
   if(p.action==='space'){if(p.space==='created-space'){finish({space:{...createdSpace,invite:'local-created'},role:'owner',members:[],bots:[],channels:[{id:'created-space-text',name:'général',mode:'text',owner:'me'}]});return;}if(holdSpace&&p.space==='other'){holdSpace=false;spaceRelease=()=>finish({error:'Ancienne communauté indisponible'},503);return;}finish({space:{id:'space',name:'Communauté',description:'',invite:'local'},role:'owner',members:[],bots:[],channels:[{id:'a',name:'Alpha',mode:'text',owner:'me'},{id:'b',name:'Bêta',mode:'text',owner:'me'},...createdChannels,...Array.from({length:(req.headers.referer||'').includes('minimal=1')?0:48},(_,i)=>({id:'voice-'+i,name:'Vocal '+i,mode:'voice',owner:'me'}))]});return;}
   if(p.action==='feed'){
    reads.push(p);const data=structuredClone(feed(p.chat,p.thread));
    if(p.thread&&holdThread){holdThread=false;threadRelease=()=>finish(data);return;}
    if(!p.thread&&holdFeed){holdFeed=false;feedRelease=()=>finish(data);return;}
    finish(data);return;
   }
   if(p.action==='search'){if(holdSearch){holdSearch=false;searchRelease=()=>finish({messages:[message('old-search',p.chat,'Ancien résultat de recherche')]});return;}finish({messages:[]});return;}
   finish({ok:true});return;
  }
  if(req.url==='/app.js'){res.setHeader('Content-Type','application/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  res.setHeader('Content-Type','text/html');res.end('<html data-luma="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));win=new BrowserWindow({width:1280,height:850});await win.loadURL('http://127.0.0.1:'+server.address().port+'/communities');
 await until(()=>win.page.getByRole('alert').filter({hasText:'Chargement temporairement indisponible'}).count(),'initial load error');
 assert.equal(await win.page.getByRole('link',{name:'Se connecter',exact:true}).count(),0,'a transient failure is not a sign-in error');
 await win.page.getByRole('button',{name:'Réessayer le chargement',exact:true}).click();
 await until(()=>win.page.getByText('Contenu du salon Alpha',{exact:true}).count(),'initial channel');
 await until(()=>batchRequests.length===1,'all voice channels in one request');
 holdSpace=true;await run('window.__ignoreNextSpace=true');await win.page.locator('.community-switcher button').filter({hasText:'Autre communauté'}).click();await until(()=>spaceRelease,'old community held');
 await win.page.locator('.community-switcher button').filter({hasText:'Communauté'}).first().click();await until(()=>win.page.getByText('Contenu du salon Alpha',{exact:true}).count(),'back to original community');spaceRelease();spaceRelease=null;await wait(100);assert.equal(await win.page.getByRole('alert').filter({hasText:'Ancienne communauté indisponible'}).count(),0,'stale community errors stay out of current view');
 const channel=name=>win.page.locator('.channel:not(.voice-channel)').filter({hasText:name});
 const editor=()=>win.page.getByRole('textbox',{name:'Message dans le salon',exact:true});
 holdFeed=true;await run('window.__ignoreNextFeed=true;window.__advance(4000)');await until(()=>feedRelease,'pending feed read');const heldCount=reads.length;
 await run('window.__advance(12000)');assert.equal(reads.length,heldCount,'polls do not overlap while a request is pending');
 await channel('Bêta').click();await until(()=>win.page.getByText('Contenu du salon Bêta',{exact:true}).count(),'switch to Beta');feedRelease();feedRelease=null;await wait(100);
 assert.equal(await win.page.getByText('Contenu du salon Alpha',{exact:true}).count(),0,'late feed cannot replace a new channel');
 holdSearch=true;await run('window.__ignoreSearch=true');await win.page.getByPlaceholder('Rechercher dans tout l’historique de ce salon…').fill('ancien');await win.page.getByRole('button',{name:'Rechercher',exact:true}).click();await until(()=>searchRelease,'pending search');
 await channel('Alpha').click();await editor().fill('Brouillon Alpha');searchRelease();searchRelease=null;await wait(100);assert.equal(await win.page.getByText('Ancien résultat de recherche',{exact:true}).count(),0,'late search cannot replace a new channel');
 await channel('Bêta').click();await editor().fill('Brouillon Bêta');await channel('Alpha').click();assert.equal(await editor().inputValue(),'Brouillon Alpha','per-channel drafts survive navigation');
 ambiguous=true;await editor().fill('Message confirmé une seule fois');
 await run("(()=>{const input=document.querySelector('[aria-label=\"Message dans le salon\"]');input.form.requestSubmit();input.form.requestSubmit();})()");
 await until(()=>win.page.getByRole('alert').filter({hasText:'Réponse perdue après enregistrement'}).count(),'ambiguous send error');assert.equal(writes.length,1,'same-tick send lock');const originalId=writes[0].clientId;
 assert.equal(await editor().inputValue(),'Message confirmé une seule fois','failed response preserves draft');await editor().press('Enter');await until(()=>editor().inputValue().then(value=>value===''),'retry succeeds');assert.equal(writes[1].clientId,originalId,'retry keeps the accepted message identity');assert.equal(accepted.size,1);
 await editor().fill('Message confirmé une seule fois');await editor().press('Enter');await until(()=>writes.length===3,'intentional repeat');assert.notEqual(writes[2].clientId,originalId);assert.equal(accepted.size,2);
 await until(()=>win.page.getByText('Message confirmé une seule fois',{exact:true}).count().then(count=>count===2),'repeat rendered');
 holdSend=true;await editor().fill('Envoi tardif dans Alpha');await editor().press('Enter');await until(()=>sendRelease,'pending send');await channel('Bêta').click();await editor().fill('Nouveau brouillon Bêta');sendRelease();sendRelease=null;await wait(100);
 assert.equal(await editor().inputValue(),'Nouveau brouillon Bêta','late send cannot clear another channel draft');assert.equal(await win.page.getByText('Envoi tardif dans Alpha',{exact:true}).count(),0,'late send cannot replace another feed');
 await channel('Alpha').click();await until(()=>win.page.getByText('Envoi tardif dans Alpha',{exact:true}).count(),'original channel refreshed');assert.equal(await editor().inputValue(),'');
 holdThread=true;await win.page.getByRole('button',{name:'1 réponse',exact:true}).first().click();await until(()=>threadRelease,'thread read held');await channel('Bêta').click();threadRelease();threadRelease=null;await wait(100);assert.equal(await win.page.getByText('Réponse du fil a',{exact:true}).count(),0,'late thread cannot reopen old context');
 holdFeed=true;feedRelease=null;await run('window.__fastTimeout=true;window.__advance(60000)');await until(()=>feedRelease,'stalled refresh');await until(()=>win.page.getByRole('alert').filter({hasText:'Le serveur met trop de temps à répondre. Réessayez.'}).count(),'bounded refresh timeout');
 await win.page.getByRole('button',{name:'Réessayer',exact:true}).click();await until(()=>win.page.getByRole('alert').filter({hasText:'Le serveur met trop de temps à répondre. Réessayez.'}).count().then(n=>!n),'manual refresh recovers');
 const paused=reads.length,pausedVoice=batchRequests.length;await run("window.dispatchEvent(new Event('luma-native-background'));window.__advance(60000);window.__voiceTick?.()");await wait(100);assert.equal(reads.length,paused);assert.equal(batchRequests.length,pausedVoice,'background pauses room checks');
 await run("window.dispatchEvent(new Event('luma-native-active'))");await until(()=>reads.length>paused&&batchRequests.length>pausedVoice,'foreground resumes reads');
 await until(()=>run('window.__pollTimers.size>0'),'foreground read settled');holdFeed=true;feedRelease=null;await run('window.__advance(4000)');await until(()=>feedRelease,'read before unmount');const beforeUnmount=await run('window.__aborts');await run('window.__unmount();window.__advance(60000);window.__voiceTick?.()');await until(()=>run('window.__aborts').then(count=>count>beforeUnmount),'unmount aborts pending reads');
 await win.loadURL('http://127.0.0.1:'+server.address().port+'/communities?minimal=1');await until(()=>win.page.getByText('Contenu du salon Alpha',{exact:true}).count(),'creation fixture loaded');
 await win.page.getByRole('button',{name:'Créer un salon',exact:true}).click();await win.page.getByRole('dialog').getByLabel('Nom',{exact:true}).fill('Gamma');await win.page.getByRole('button',{name:'Créer le salon',exact:true}).click();
 await until(()=>win.page.locator('.hub-header h2').textContent().then(text=>text==='Gamma'),'created channel selected');await until(()=>win.page.getByRole('dialog').count().then(count=>!count),'channel dialog closes');assert.equal(await win.page.getByRole('button',{name:'Envoyer',exact:true}).isEnabled(),false);
 await win.page.getByRole('button',{name:'Ajouter une communauté',exact:true}).click();await win.page.getByRole('menuitem',{name:'Créer une communauté',exact:true}).click();await win.page.getByRole('dialog').getByLabel('Nom',{exact:true}).fill('Espace créé');await win.page.getByRole('button',{name:'Créer ma communauté',exact:true}).click();
 await until(()=>win.page.locator('.community-title h1').textContent().then(text=>text==='Espace créé'),'created community selected');await until(()=>win.page.getByRole('dialog').count().then(count=>!count),'community dialog closes');assert.equal(await win.page.getByRole('alert').count(),0);
 await win.page.getByRole('button',{name:'Ajouter une communauté',exact:true}).click();await win.page.getByRole('menuitem',{name:'Rejoindre une communauté',exact:true}).click();await win.page.getByRole('dialog').getByLabel('Code d’invitation',{exact:true}).fill('local-code');await win.page.getByRole('button',{name:'Rejoindre',exact:true}).click();
 await until(()=>win.page.locator('.community-title h1').textContent().then(text=>text==='Communauté'),'joined community selected');await until(()=>win.page.getByRole('dialog').count().then(count=>!count),'join dialog closes');
 writeFileSync(path.join(dir,'passed.txt'),'PASS initial retry, single-flight polling, stale feed/search/thread guards, per-channel drafts, idempotent retries, cross-channel sends, timeout recovery, background pause, batch room checks, creation navigation and unmount cancellation.');console.log(readFileSync(path.join(dir,'passed.txt'),'utf8'));
}catch(error){console.error(error);writeFileSync(path.join(dir,'requests.json'),JSON.stringify({reads,writes,batchRequests},null,2));if(win)try{writeFileSync(path.join(dir,'debug.png'),await win.page.screenshot());writeFileSync(path.join(dir,'debug.txt'),await run('document.body.innerText'));}catch{}process.exitCode=1;}
finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}});
setTimeout(()=>app.exit(1),180000);
