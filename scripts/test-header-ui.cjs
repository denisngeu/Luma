/* Header controls and the actual messenger, using only isolated local fixtures. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/header-ui');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,friendCalls=0,incomingCalls=0;
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'navigation.ts'),"import {useSyncExternalStore} from 'react';const subscribe=fn=>{window.addEventListener('popstate',fn);return()=>window.removeEventListener('popstate',fn);};export const usePathname=()=>useSyncExternalStore(subscribe,()=>location.pathname,()=>'/fil');const router={push(url){history.pushState(null,'',url);window.dispatchEvent(new PopStateEvent('popstate'));}};export const useRouter=()=>router;");
  writeFileSync(path.join(dir,'image.tsx'),"import React from 'react';export default function Image({src,alt,width,height,className}){return <img src={src} alt={alt} width={width} height={height} className={className}/>;}");
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React from 'react';import {createRoot} from 'react-dom/client';import {usePathname} from 'next/navigation';import Header from '../../app/desktop-header';import Messenger from '../../app/messenger';
   const original=window.fetch,scenario=new URLSearchParams(location.search).get('case')||'';
   window.fetch=(url,options={})=>original(url,{...options,headers:{...options.headers,'x-test-case':scenario}});
   function TestApp(){const path=usePathname();return <><Header/><div style={{paddingTop:50}}>{path==='/messages'?<Messenger/>:<h1>Fil de test</h1>}</div></>;}
   createRoot(document.getElementById('root')).render(<React.StrictMode><TestApp/></React.StrictMode>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts'),'next/image':path.join(dir,'image.tsx')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  const styles=compiledStyles();
  server=createServer(async(req,res)=>{
   if(req.url.startsWith('/api/')){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw||'{}'),scenario=req.headers['x-test-case'];res.setHeader('Content-Type','application/json');
    if(req.url==='/api/friends'){
     friendCalls++;await wait(scenario==='slow'?1800:80);
     if(scenario==='expired'){res.statusCode=401;res.end('{"error":"Session expirée"}');return;}
     res.end(JSON.stringify({user:{id:'me'},items:[{id:'received',name:'Alice',recipient:'me',state:'pending'},{id:'sent',name:'Sortante',recipient:'other',state:'pending'},{id:'accepted',name:'Déjà ami',recipient:'me',state:'accepted'}]}));return;
    }
    if(req.url==='/api/calls'){
     incomingCalls++;await wait(scenario==='slow'||scenario==='slow-calls'?1800:80);
     if(scenario==='partial'){res.statusCode=503;res.end('{"error":"Appels indisponibles"}');return;}
     res.end(JSON.stringify({calls:[{id:'call-1',name:'Bob',mode:'video'}]}));return;
    }
    if(req.url==='/api/chat'){
     if(p.action==='list')res.end(JSON.stringify({user:{id:'me',name:'Moi'},chats:[{id:'bob',name:'Bob',kind:'direct',preview:'Bonjour'},{id:'alice',name:'Alice',kind:'direct',preview:'Salut'}]}));
     else res.end(JSON.stringify({messages:[{id:'msg',body:'Bonjour',author:'bob',name:'Bob',created:1700000000000,scheduled:0}]}));return;
    }
    res.end('{}');return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   if(req.url==='/luma-logo.png'){res.setHeader('Content-Type','image/png');res.end(readFileSync('public/luma-logo.png'));return;}
   res.setHeader('Content-Type','text/html');res.end('<html data-luma="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  win=new BrowserWindow({width:1280,height:850});await win.loadURL(origin+'/fil');
  await until(()=>run(win,"!!document.querySelector('button[aria-label=Notifications]')"),'header loaded');
  assert.equal(friendCalls+incomingCalls,0,'no notification requests before opening');
  await win.page.getByRole('button',{name:'Notifications',exact:true}).click();
  await until(()=>run(win,"document.querySelector('.notification-center')?.textContent.includes('Appel vidéo entrant')"),'real notification categories loaded');
  assert.equal(await win.page.locator('.notification-center li').count(),2,'received friendship and incoming call only');
  assert.equal(await win.page.locator('.notification-center a[href="/amis#demandes"]').count(),1);
  assert.equal(await win.page.locator('.notification-center a[href="/appel/call-1"]').count(),1);
  await win.page.keyboard.press('Escape');await until(()=>run(win,"!document.querySelector('.notification-center')"),'Escape closes notifications');
  assert.equal(await run(win,"document.activeElement?.getAttribute('aria-label')"),'Notifications','focus returns to bell');
  const previous=friendCalls+incomingCalls;await wait(200);assert.equal(friendCalls+incomingCalls,previous,'closed center does not poll');
  await win.page.getByRole('button',{name:'Rechercher',exact:true}).click();await win.page.waitForURL('**/messages?recherche=1');
  await until(()=>run(win,"document.activeElement?.getAttribute('placeholder')==='Rechercher une discussion...'"),'navigation focuses discussion search');
  const search=win.page.getByRole('textbox',{name:'Rechercher une discussion',exact:true});await search.fill('Alice');
  await win.page.keyboard.press('Control+k');
  await until(()=>run(win,"document.activeElement.selectionStart===0&&document.activeElement.selectionEnd===5"),'shortcut selects existing query');
  await win.page.keyboard.type('Bob');assert.equal(await search.inputValue(),'Bob');
  await win.page.getByRole('button',{name:'Notifications',exact:true}).click();
  await win.page.keyboard.press('Control+k');
  await until(()=>run(win,"!document.querySelector('.notification-center')&&document.activeElement?.getAttribute('placeholder')==='Rechercher une discussion...'"),'search shortcut closes modal and focuses search');
  await win.page.setViewportSize({width:390,height:844});
  await win.page.getByRole('button',{name:'Ouvrir la discussion avec Bob',exact:true}).press('Enter');
  await until(()=>run(win,"document.querySelector('.stitch-messenger-root').classList.contains('mobile-chat')"),'mobile chat opened');
  await win.page.locator('.messenger-mobile-menu summary').click();
  await win.page.getByRole('button',{name:'Rechercher une discussion',exact:true}).click();
  await until(()=>run(win,"!document.querySelector('.stitch-messenger-root').classList.contains('mobile-chat')&&document.activeElement?.getAttribute('placeholder')==='Rechercher une discussion...'"),'mobile search returns to list and focuses');
  const box=await search.boundingBox();assert.ok(box&&box.width>0,'mobile search visible');
  await win.page.getByRole('button',{name:'Ouvrir la discussion avec Bob',exact:true}).press('Enter');
  await win.page.locator('.messenger-mobile-menu summary').click();
  assert.equal(await win.page.locator('.messenger-menu-action:visible').count(),3,'all mobile menu actions are reachable');
  await win.page.locator('.messenger-menu-action').filter({hasText:'Messages favoris'}).click();
  await until(()=>run(win,"!!document.querySelector('.stitch-saved-empty')"),'mobile favorites view opens');
  await win.page.locator('.messenger-mobile-menu summary').click();
  await win.page.getByRole('button',{name:'Informations de la discussion',exact:true}).click();
  await until(()=>run(win,"!!document.querySelector('.messenger-details')"),'mobile details opens outside hidden sidebar');
  const details=await win.page.locator('.messenger-details').boundingBox();assert.ok(details.x>=0&&details.x+details.width<=390,'details fits mobile width');
  await win.page.keyboard.press('Escape');await until(()=>run(win,"!document.querySelector('.messenger-details')"),'details closes with Escape');
  assert.equal(await run(win,"document.activeElement?.getAttribute('aria-label')"),'Options de la discussion','details returns focus to visible menu');
  await win.page.setViewportSize({width:320,height:740});
  await win.page.locator('.messenger-mobile-menu summary').click();
  const menu=await win.page.locator('.messenger-mobile-menu>div').boundingBox();assert.ok(menu.x>=0&&menu.x+menu.width<=320,'menu fits narrow phone');
  for(const action of await win.page.locator('.messenger-menu-action').all()){const box=await action.boundingBox();assert.ok(box.height>=44,'mobile menu touch target');}
  writeFileSync(path.join(dir,'mobile-menu-320.png'),(await win.webContents.capturePage()).toPNG());
  await win.page.keyboard.press('Escape');
  assert.equal(await win.page.locator('.messenger-mobile-menu').getAttribute('open'),null,'Escape closes mobile menu');
  await win.page.setViewportSize({width:1280,height:850});
  await win.page.getByRole('button',{name:'Options et profil',exact:true}).click();
  await until(()=>run(win,"!!document.querySelector('.messenger-details')"),'desktop details opens');
  const desktopDetails=await win.page.locator('.messenger-details').boundingBox();assert.ok(desktopDetails.x>=0&&desktopDetails.y>=0&&desktopDetails.x+desktopDetails.width<=1280,'desktop details stays on screen');
  await win.page.getByRole('button',{name:'Fermer les détails',exact:true}).click();
  await win.loadURL(origin+'/fil?case=partial');await win.page.getByRole('button',{name:'Notifications',exact:true}).click();
  await until(()=>run(win,"document.querySelector('.notification-center [role=alert]')?.textContent.includes('appels entrants')"),'partial failure shown');
  assert.equal(await win.page.locator('.notification-center li').count(),1,'working notification source remains available');
  assert.equal(await win.page.locator('.notification-empty').count(),0,'failure is not reported as no notifications');
  await win.loadURL(origin+'/fil?case=slow-calls');await win.page.getByRole('button',{name:'Notifications',exact:true}).click();
  await until(()=>run(win,"!!document.querySelector('.notification-center a[href=\"/amis#demandes\"]')"),'friend requests appear before slow calls finish');
  assert.equal(await win.page.locator('.notification-center [role=status]').count(),1,'slow source does not block available notifications');
  await win.page.getByRole('button',{name:'Fermer les notifications',exact:true}).click();
  await win.loadURL(origin+'/fil?case=expired');await win.page.getByRole('button',{name:'Notifications',exact:true}).click();
  await until(()=>run(win,"!!document.querySelector('.notification-center a[href*=connexion]')"),'expired session offers login');
  assert.equal(await win.page.locator('.notification-center li').count(),0,'expired session clears all private entries');
  await win.loadURL(origin+'/fil?case=slow');await win.page.getByRole('button',{name:'Notifications',exact:true}).click();
  await win.page.getByRole('button',{name:'Fermer les notifications',exact:true}).click();await wait(1900);
  assert.equal(await win.page.locator('.notification-center').count(),0,'late responses do not reopen closed modal');
  console.log('PASS notification sources and links, no closed polling, Escape/focus restore, partial errors, expired sessions, late response cancellation, search navigation, Ctrl+K and mobile search return.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));writeFileSync(path.join(dir,'debug.png'),(await win.webContents.capturePage()).toPNG());}catch{}process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
