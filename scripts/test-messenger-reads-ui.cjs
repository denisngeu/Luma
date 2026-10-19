/* Actual messenger component with controlled read/refresh races; local fixtures only. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/messenger-reads');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,reads=[],lists=0,holdList=false,heldList,failRead=false,arrivalDuringRead=false,longHistory=false;
const ownMessages=[];
const unread={a:2,b:1},sequence={a:2,b:3};
const listing=()=>({user:{id:'me',name:'Moi'},chats:[{id:'a',name:'Alice',kind:'direct',unread:unread.a},{id:'b',name:'Bob',kind:'direct',unread:unread.b}]});
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'navigation.ts'),require('./test-navigation-fixture.cjs'));
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React from 'react';import {createRoot} from 'react-dom/client';import Messenger from '../../app/messenger';import NotificationCenter from '../../app/notification-center';
   window.__hidden=false;Object.defineProperty(document,'hidden',{get:()=>window.__hidden});
   createRoot(document.getElementById('root')).render(<React.StrictMode><NotificationCenter/><Messenger/></React.StrictMode>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  const styles=compiledStyles();
  server=createServer(async(req,res)=>{
   if(req.url==='/api/friends'||req.url==='/api/calls'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/api/friends'?{user:{id:'me'},items:[]}:{calls:[]}));return;}
   if(req.url==='/api/chat'){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw);res.setHeader('Content-Type','application/json');
    if(p.action==='list'){
     lists++;const data=listing();
     if(holdList){holdList=false;heldList=()=>res.end(JSON.stringify(data));return;}
     res.end(JSON.stringify(data));return;
    }
    if(p.action==='messages'){res.end(JSON.stringify({messages:[{id:p.chat+'-old',author:p.chat,name:'Contact',body:'Message de la veille',created:1699913600000,scheduled:0},{id:p.chat+'-'+sequence[p.chat],author:p.chat,name:p.chat==='a'?'Alice':'Bob',body:'Message '+p.chat+' '+sequence[p.chat]+(longHistory?'\n'+Array.from({length:180},(_,i)=>'Historique '+i).join('\n'):''),created:1700000000000,scheduled:0},...ownMessages],readCursor:{sequence:sequence[p.chat],through:0}}));return;}
    if(p.action==='send'){ownMessages.push({id:'own-'+ownMessages.length,author:'me',name:'Moi',body:p.body,created:Date.now(),scheduled:0,scheduled_pending:0});res.end(JSON.stringify({id:ownMessages.at(-1).id}));return;}
    if(p.action==='read'){
     reads.push({chat:p.chat,cursor:p.cursor});await wait(160);
     if(failRead){res.statusCode=503;res.end('{"error":"Lecture non synchronisée"}');return;}
     if(arrivalDuringRead){arrivalDuringRead=false;unread[p.chat]=1;sequence[p.chat]++;}
     else unread[p.chat]=0;
     res.end(JSON.stringify({ok:true,unread:unread[p.chat]}));return;
    }
    res.end('{"ok":true}');return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   res.setHeader('Content-Type','text/html');res.end('<html data-luma="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  win=new BrowserWindow({width:390,height:844});await win.loadURL(origin+'/messages');
  await until(()=>run(win,"!!document.querySelector('[aria-label=\"Ouvrir la discussion avec Alice\"]')"),'discussion list loaded');
  await wait(250);assert.equal(reads.length,0,'mobile list does not choose or mark a default conversation read');
  assert.equal(await win.page.locator('[aria-label="2 messages non lus"]').count(),1,'unread badge remains before a conversation is opened');
  await win.page.getByRole('button',{name:'Non lus',exact:true}).click();
  assert.equal(await win.page.getByRole('button',{name:/Ouvrir la discussion avec/}).count(),2,'unread filter uses actual counters');
  await win.page.getByRole('button',{name:'Ouvrir la discussion avec Alice',exact:true}).click();
  await until(()=>reads.length===1&&unread.a===0,'visible conversation acknowledged');
  assert.equal(await win.page.locator('.messenger-day-divider time').count(),2,'history is grouped by its two actual dates');
  assert.equal(await win.page.locator('.messenger-day-divider time').last().innerText(),new Date(1700000000000).toLocaleDateString('fr-FR',{dateStyle:'long'}),'old history does not show today as its date');
  await until(()=>run(win,"!document.querySelector('[aria-label=\"Ouvrir la discussion avec Alice\"]')"),'confirmed read removed from unread filter');
  assert.equal(reads[0].chat,'a');
  await win.page.getByRole('button',{name:'Revenir aux discussions',exact:true}).click();
  assert.equal(await win.page.getByRole('button',{name:/Ouvrir la discussion avec/}).count(),1);
  await run(win,'window.__hidden=true');
  await win.page.getByRole('button',{name:'Ouvrir la discussion avec Bob',exact:true}).click();
  await wait(250);assert.equal(reads.length,1,'background conversation never acknowledged');
  holdList=true;
  await run(win,"window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))");
  await until(()=>!!heldList&&reads.length===2&&unread.b===0,'foreground resumes read and refresh');
  const priorLists=lists;heldList();heldList=null;
  await until(()=>lists>priorLists,'stale list replaced after read confirmation');
  assert.equal(await win.page.locator('[aria-label="1 message non lu"]').count(),0,'stale refresh cannot restore an already-read badge');
  // A failed acknowledgement must retain the server count until a successful retry.
  unread.b=1;sequence.b++;failRead=true;
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>reads.length===3,'new snapshot tries read sync');
  await wait(200);assert.equal(unread.b,1);
  assert.equal(await win.page.locator('[aria-label="1 message non lu"]').count(),1,'failed read is not optimistically cleared');
  failRead=false;await run(win,"window.dispatchEvent(new Event('focus'))");
  await until(()=>reads.length===4&&unread.b===0,'read retry succeeds');
  await until(()=>run(win,"!document.querySelector('[aria-label=\"1 message non lu\"]')"),'retry updates count');
  // The response can legitimately retain one unread message which arrived during acknowledgement.
  unread.b=1;sequence.b++;arrivalDuringRead=true;
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>reads.length===5&&unread.b===1,'concurrent arrival preserved by server count');
  await wait(200);assert.equal(await win.page.locator('[aria-label="1 message non lu"]').count(),1,'read response count is respected');
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>reads.length===6&&unread.b===0,'newly rendered snapshot acknowledged separately');
  longHistory=true;unread.b=1;sequence.b++;await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>unread.b===0,'long history initially follows latest message');
  await run(win,"document.querySelector('main>section').scrollTop=0");await wait(120);
  const beforeHistoryArrival=reads.length;unread.b=1;sequence.b++;const arriving=sequence.b;
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>run(win,"document.querySelector('main>section').textContent.includes('Message b "+arriving+"')"),'new message renders without interrupting history');
  await wait(200);assert.equal(reads.length,beforeHistoryArrival,'new off-screen message is not acknowledged');
  assert.equal(await run(win,"document.querySelector('main>section').scrollTop"),0,'history position remains unchanged');
  await win.page.getByRole('button',{name:'Aller aux derniers messages',exact:true}).click();
  await until(()=>reads.length===beforeHistoryArrival+1&&unread.b===0,'returning to bottom acknowledges the rendered message');
  longHistory=false;
  await win.page.getByRole('button',{name:'Notifications',exact:true}).click();
  const beforeOverlay=reads.length;unread.b=1;sequence.b++;const behindOverlay=sequence.b;
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>run(win,"document.querySelector('main>section').textContent.includes('Message b "+behindOverlay+"')"),'message received behind notifications');
  await wait(200);assert.equal(reads.length,beforeOverlay,'covered conversation is not marked read');
  await win.page.getByRole('button',{name:'Fermer les notifications',exact:true}).click();await run(win,"window.dispatchEvent(new Event('focus'))");
  await until(()=>reads.length===beforeOverlay+1&&unread.b===0,'closing notifications resumes actual reading');
  const stableReads=reads.length;await wait(4300);assert.equal(reads.length,stableReads,'idle message polls cause no duplicate read writes');
  await run(win,"window.dispatchEvent(new Event('luma-native-background'))");
  unread.b=1;sequence.b++;await run(win,"window.dispatchEvent(new Event('online'))");
  await wait(250);assert.equal(reads.length,stableReads,'native background overrides a WebView that still reports visible');
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>reads.length===stableReads+1&&unread.b===0,'native foreground resumes unread sync');
  await until(()=>run(win,"!document.querySelector('[aria-label=\"1 message non lu\"]')"),'native read confirmation updates filter');
  await win.page.getByRole('button',{name:'Revenir aux discussions',exact:true}).click();
  assert.equal(await win.page.getByText('Aucune discussion non lue.',{exact:true}).count(),1,'empty unread filter uses accurate wording');
  await win.page.getByRole('button',{name:'Toutes',exact:true}).click();await win.page.getByRole('button',{name:'Ouvrir la discussion avec Bob',exact:true}).click();
  longHistory=true;await run(win,"window.dispatchEvent(new Event('luma-native-active'))");await until(()=>run(win,"document.querySelector('main>section').textContent.includes('Historique 179')"),'history restored before own send');
  await run(win,"document.querySelector('main>section').scrollTop=0");await wait(120);
  const composer=win.page.getByPlaceholder('Écrivez votre message à Bob...', {exact:true});await composer.fill('Mon message depuis l’historique');await composer.press('Enter');
  await until(()=>ownMessages.length===1&&run(win,"(()=>{const pane=document.querySelector('main>section');return pane.scrollHeight-pane.clientHeight-pane.scrollTop<12;})()"),'own send returns to latest message');
  assert.equal(await win.page.locator('[aria-label="Envoyé"]').count(),1,'sent status does not claim recipient read');
  const planned=Date.now()+60000;ownMessages.push({id:'planned',author:'me',name:'Moi',body:'Plus tard',created:Date.now(),scheduled:planned,scheduled_pending:1});
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");await until(()=>run(win,"!!document.querySelector('[aria-label=\"Message programmé\"]')"),'scheduled preview is explicitly labelled');
  const beforeDesktop=reads.length;win.destroy();unread.a=2;sequence.a++;
  win=new BrowserWindow({width:1280,height:850});await win.loadURL(origin+'/messages');
  await until(()=>run(win,"!!document.querySelector('[aria-label=\"Ouvrir la discussion avec Alice\"]')"),'desktop list loaded');await wait(250);
  assert.equal(reads.length,beforeDesktop,'desktop startup does not mark a conversation read without a choice');
  assert.equal(await win.page.getByRole('heading',{name:'Sélectionnez une discussion',exact:true}).count(),1,'desktop waits for an explicit conversation');
  assert.equal(await win.page.locator('main textarea').count(),0,'empty desktop pane has no pretend composer');
  assert.equal(await win.page.getByRole('button',{name:'Appel vocal',exact:true}).count(),0,'empty desktop pane has no call controls');
  assert.equal(await win.page.locator('main time').count(),0,'empty desktop pane has no fabricated message date');
  await win.page.getByRole('button',{name:'Ouvrir la discussion avec Alice',exact:true}).click();await until(()=>reads.length===beforeDesktop+1&&unread.a===0,'desktop choice acknowledges visible conversation');
  win.destroy();unread.b=1;sequence.b++;win=new BrowserWindow({width:390,height:844});await win.loadURL(origin+'/messages?chat=b');
  await until(()=>run(win,"document.querySelector('.stitch-messenger-root').classList.contains('mobile-chat')"),'direct message link opens mobile conversation');
  await until(()=>reads.length===beforeDesktop+2&&unread.b===0,'explicit mobile link acknowledges chosen conversation');
  await win.page.getByPlaceholder('Écrivez votre message à Bob...', {exact:true}).fill('Brouillon Bob conservé');
  await run(win,"history.pushState({},'', '/messages?chat=a');window.dispatchEvent(new PopStateEvent('popstate'))");
  await until(()=>win.page.getByPlaceholder('Écrivez votre message à Alice...', {exact:true}).count(),'query navigation switches the mounted messenger');
  await win.page.getByPlaceholder('Écrivez votre message à Alice...', {exact:true}).fill('Brouillon Alice conservé');
  await run(win,"window.dispatchEvent(new Event('luma-chat-list-refresh'))");await wait(250);
  assert.equal(await win.page.getByPlaceholder('Écrivez votre message à Alice...', {exact:true}).inputValue(),'Brouillon Alice conservé','list refresh does not replay the link or reset the draft');
  await run(win,"history.pushState({},'', '/messages?chat=inaccessible');window.dispatchEvent(new PopStateEvent('popstate'))");
  await until(()=>win.page.getByText('Cette discussion est introuvable ou vous n’y avez plus accès.',{exact:true}).count(),'inaccessible link has a real error');
  assert.equal(await win.page.locator('main textarea').count(),0,'invalid link cannot leave the previous recipient selected');
  await run(win,"history.pushState({},'', '/messages?chat=b');window.dispatchEvent(new PopStateEvent('popstate'))");
  await until(()=>win.page.getByPlaceholder('Écrivez votre message à Bob...', {exact:true}).count(),'return to linked conversation');
  assert.equal(await win.page.getByPlaceholder('Écrivez votre message à Bob...', {exact:true}).inputValue(),'Brouillon Bob conservé','same-page navigation preserves each draft');
  await run(win,"history.pushState({},'', '/messages');window.dispatchEvent(new PopStateEvent('popstate'))");
  await until(()=>run(win,"!document.querySelector('.stitch-messenger-root').classList.contains('mobile-chat')"),'root messages link returns to conversation list');
  console.log('PASS real unread filtering, mobile visibility, background/foreground handling, stale list race, confirmed read counts, failed retry, concurrent arrivals and idle write deduplication.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));writeFileSync(path.join(dir,'debug.png'),(await win.webContents.capturePage()).toPNG());}catch{}process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
