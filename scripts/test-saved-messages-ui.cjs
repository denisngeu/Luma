const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http'),{mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path'),assert=require('node:assert/strict'),{build}=require('esbuild'),compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/saved-messages-ui');mkdirSync(dir,{recursive:true});mkdirSync('outputs',{recursive:true});
const wait=ms=>new Promise(r=>setTimeout(r,ms));async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
let server,win,run=0;const states=new Map();
const saved=[{id:'old',chat:'old-chat',chat_name:'Ancienne discussion',chat_kind:'direct',body:'Un message enregistré bien avant les derniers échanges.',author:'peer',name:'Contact',created:1600000000000,scheduled:0,scheduled_pending:0,file:'file-reference',filename:'document-avec-un-nom-de-fichier-tres-long.pdf'},
 {id:'group',chat:'group-chat',chat_name:'Notre groupe',chat_kind:'group',body:'Une idée à conserver.\nVoici la suite de notre projet.',author:'peer',name:'Contact',created:1600000000001,scheduled:0,scheduled_pending:0},
 {id:'more',chat:'direct-chat',chat_name:'Contact',chat_kind:'direct',body:'Un autre favori plus ancien.',author:'peer',name:'Contact',created:1500000000000,scheduled:0,scheduled_pending:0}];
app.whenReady().then(async()=>{try{
 writeFileSync(path.join(dir,'navigation.ts'),`export const usePathname=()=>'/messages';export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(url){window.__destination=url;}});`);
 writeFileSync(path.join(dir,'link.tsx'),`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({children,prefetch,replace,scroll,...props}){return <a {...props}>{children}</a>}`);
 writeFileSync(path.join(dir,'image.tsx'),`import React from 'react';export default function Image({priority,fill,...props}){return <img {...props}/>}`);
 writeFileSync(path.join(dir,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Messenger from '../../app/messenger';import Shell from '../../app/app-shell';import Theme from '../../app/theme-provider';createRoot(document.getElementById('root')).render(<React.StrictMode><Theme/><Shell><Messenger/></Shell></React.StrictMode>);`);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts'),'next/link':path.join(dir,'link.tsx'),'next/image':path.join(dir,'image.tsx')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
 const css=compiledStyles();
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/')){
   let raw='';for await(const chunk of req)raw+=chunk;const p=JSON.parse(raw||'{}'),referer=new URL(req.headers.referer||'http://local'),key=referer.searchParams.get('run'),scenario=referer.searchParams.get('case');
   if(!states.has(key))states.set(key,{saved:0,remove:0,read:0,includes:[],removed:new Set()});const state=states.get(key);let data={ok:true};
   res.setHeader('Content-Type','application/json');
   if(url.pathname==='/api/chat'){
    if(p.action==='list'){if(scenario==='slow-list')await wait(700);state.includes.push(p.include);data={user:{id:'me',name:'Moi'},chats:[{id:'direct-chat',name:'Contact',kind:'direct',unread:2},{id:'group-chat',name:'Notre groupe',kind:'group',unread:0},...(p.include==='old-chat'?[{id:'old-chat',name:'Ancienne discussion',kind:'direct'}]:[])]};}
    if(p.action==='saved'){
     state.saved++;if(scenario==='retry'&&state.saved===1){res.statusCode=503;res.end(JSON.stringify({error:'Favoris temporairement indisponibles.'}));return;}
     if(scenario==='expired'&&state.saved===2){res.statusCode=401;res.end(JSON.stringify({error:'Session expirée.'}));return;}
     if(p.after){if((scenario==='race'||scenario==='remove-expired-late'))await wait(700);data={messages:(scenario==='race'?[saved[0],saved[2]]:[saved[2]]),next:null};}
     else data={messages:scenario==='empty'?[]:saved.slice(0,2).filter(m=>!state.removed.has(m.id)),next:scenario==='empty'?null:{created:1600000000000,id:'cursor'}};
    }
    if(p.action==='star'){state.remove++;if((scenario==='remove-expired'||scenario==='remove-expired-late')){res.statusCode=401;res.end(JSON.stringify({error:'Session expirée.'}));return;}assert.equal(p.starred,false);if(scenario==='retry'&&state.remove===1){res.statusCode=503;res.end(JSON.stringify({error:'Retrait temporairement impossible.'}));return;}state.removed.add(p.message);data={ok:true,starred:false};}
    if(p.action==='messages')data={messages:[{id:'message',chat:p.chat,body:p.chat==='old-chat'?'Conversation ancienne ouverte.':'Bonjour dans cette discussion.',author:'peer',name:'Contact',created:1700000000000,scheduled:0}],readCursor:{sequence:1,through:0}};
    if(p.action==='read'){state.read++;data={ok:true,unread:0};}
   }else if(url.pathname==='/api/rooms')data={rooms:{}};else if(url.pathname==='/api/calls')data={items:[],calls:[]};
   res.end(JSON.stringify(data));return;
  }
  if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  if(url.pathname==='/luma-logo.png'){res.end(readFileSync('public/luma-logo.png'));return;}
  const mode=url.searchParams.get('theme')||'dark';res.setHeader('Content-Type','text/html');res.end('<html data-luma="'+mode+'" data-motion="reduced"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><script>localStorage.setItem("luma-theme",JSON.stringify({mode:"'+mode+'",accent:"#7068ff"}));</script><div id="root"></div><script src="/app.js"></script></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 async function open(width,mode,scenario='normal'){win=new BrowserWindow({width,height:844});const key=String(++run);await win.loadURL(origin+'/messages?theme='+mode+'&case='+scenario+'&run='+key);await win.page.getByRole('button',{name:'Favoris',exact:true}).click();await win.page.getByRole('heading',{name:'Messages favoris',exact:true}).waitFor({state:'visible'});return key;}
 // Use an explicit callback because locator counts are asynchronous.
 async function loaded(){await until(async()=>await win.page.getByRole('status').filter({hasText:'Chargement des favoris'}).count()===0,'favorites response');}
 for(const width of [320,390,1280])for(const mode of ['light','dark']){
  // Opening the collection without choosing any chat must work on every surface.
  const key=await open(width,mode);await loaded();assert.equal(await win.page.locator('.messenger-saved-card').count(),2);assert.equal(states.get(key).read,0,'collection does not mark chats read');
  const metrics=await win.page.locator('.messenger-saved-panel').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth,targets:[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect().height),fonts:[...el.querySelectorAll('.messenger-message-body')].map(p=>parseFloat(getComputedStyle(p).fontSize))}));assert.equal(metrics.overflow,false);assert.ok(metrics.targets.every(h=>h>=44),'touch controls stay usable');assert.ok(metrics.fonts.every(size=>size===16),'saved message size follows user setting');
  writeFileSync('outputs/saved-messages-'+width+'-'+mode+'.png',await win.page.screenshot());
  await win.page.getByRole('button',{name:'Charger plus de favoris',exact:true}).click();await until(async()=>await win.page.locator('.messenger-saved-card').count()===3,'next page');
  await win.page.locator('.messenger-saved-card').filter({hasText:'Ancienne discussion'}).getByRole('button',{name:'Ouvrir la discussion',exact:true}).click();await win.page.getByText('Conversation ancienne ouverte.',{exact:true}).waitFor({state:'visible'});
  await until(()=>states.get(key).includes.includes('old-chat'),'older discussion remains available in list refresh');
  if(width<761)await win.page.getByRole('button',{name:'Revenir aux discussions',exact:true}).click();
  await win.page.getByRole('button',{name:'Favoris',exact:true}).click();await loaded();
  await win.page.getByRole('button',{name:'Retirer le favori de Contact dans Notre groupe',exact:true}).click();await until(async()=>await win.page.locator('.messenger-saved-card').count()===1,'remove saved message');assert.equal(states.get(key).remove,1);
  win.destroy();win=null;
 }
 let key=await open(320,'dark','empty');await loaded();await win.page.getByText('Aucun message favori',{exact:true}).waitFor({state:'visible'});await win.page.getByRole('button',{name:'Revenir aux discussions',exact:true}).click();await win.page.getByRole('button',{name:'Favoris',exact:true}).waitFor({state:'visible'});win.destroy();win=null;
 key=await open(390,'light','retry');await loaded();await win.page.getByRole('alert').filter({hasText:'Favoris temporairement indisponibles.'}).waitFor({state:'visible'});await win.page.getByRole('button',{name:'Réessayer les favoris',exact:true}).click();await loaded();
 const remove=win.page.getByRole('button',{name:'Retirer le favori de Contact dans Notre groupe',exact:true});await remove.click();await win.page.getByRole('alert').filter({hasText:'Retrait temporairement impossible.'}).waitFor({state:'visible'});assert.equal(await win.page.locator('.messenger-saved-card').count(),2);await remove.click();await until(async()=>await win.page.locator('.messenger-saved-card').count()===1,'retry removal');win.destroy();win=null;
 key=await open(390,'dark','race');await loaded();await win.page.getByRole('button',{name:'Charger plus de favoris',exact:true}).click();await win.page.getByRole('button',{name:'Retirer le favori de Contact dans Ancienne discussion',exact:true}).click();await loaded();assert.equal(await win.page.locator('.messenger-saved-card').filter({hasText:'Ancienne discussion'}).count(),0,'late pagination cannot restore a removed favorite');assert.equal(await win.page.locator('.messenger-saved-card').count(),2);win.destroy();win=null;
 key=await open(390,'dark','expired');await loaded();await win.page.getByRole('button',{name:'Actualiser les favoris',exact:true}).click();await win.page.getByRole('alert').filter({hasText:'Session expirée.'}).waitFor({state:'visible'});assert.equal(await win.page.locator('.messenger-saved-card').count(),0,'expired session clears cached saved content');await win.page.getByRole('button',{name:'Réessayer les favoris',exact:true}).click();await loaded();assert.equal(await win.page.locator('.messenger-saved-card').count(),2,'collection recovers after authentication is restored');assert.equal(await win.page.getByRole('link',{name:'Se reconnecter',exact:true}).count(),0,'restored session clears stale login prompt');
 win.destroy();win=null;key=await open(320,'dark','slow-list');await loaded();await wait(900);assert.equal(await win.page.getByRole('heading',{name:'Messages favoris',exact:true}).isVisible(),true,'initial chat loading does not hide a collection already opened by the user');
 win.destroy();win=null;key=await open(390,'dark','remove-expired');await loaded();await win.page.getByRole('button',{name:'Retirer le favori de Contact dans Notre groupe',exact:true}).click();await win.page.getByRole('link',{name:'Se reconnecter',exact:true}).waitFor({state:'visible'});assert.equal(await win.page.getByText('Aucun message favori',{exact:true}).count(),0,'authentication failure is not an empty collection');
 win.destroy();win=null;key=await open(390,'dark','visibility');await loaded();const calls=states.get(key).saved;await win.page.evaluate(()=>window.dispatchEvent(new Event('luma-native-background')));await wait(150);assert.equal(states.get(key).saved,calls,'background does not fetch');await win.page.evaluate(()=>window.dispatchEvent(new Event('luma-native-active')));await until(()=>states.get(key).saved>calls,'resume refreshes favorites');await loaded();
 win.destroy();win=null;key=await open(390,'dark','remove-expired-late');await loaded();await win.page.getByRole('button',{name:'Charger plus de favoris',exact:true}).click();await win.page.getByRole('button',{name:'Retirer le favori de Contact dans Notre groupe',exact:true}).click();await win.page.getByRole('link',{name:'Se reconnecter',exact:true}).waitFor({state:'visible'});await loaded();assert.equal(await win.page.locator('.messenger-saved-card').count(),0,'late response cannot restore content after access expires');
 console.log('PASS favorites with no selected chat, old discussion opening, pagination, file references, removal and retries, late-response protection, session expiry, empty state, touch controls and both themes on mobile/desktop.');
}catch(error){console.error(error);process.exitCode=1;}finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}});
setTimeout(()=>app.exit(1),180000);
