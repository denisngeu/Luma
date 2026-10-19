/* Actual Messenger in Edge; delayed replies and failed refreshes use local fixtures. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/messenger-send');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(80);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,holdSend=false,releaseSend,ambiguous=false,failedRefresh=false,holdFile=false,releaseFile;
const sent=[],stored={a:[],b:[]},tokens=new Map();
const listing=()=>({user:{id:'me',name:'Moi'},chats:[{id:'a',name:'Alice',kind:'direct'},{id:'b',name:'Bob',kind:'direct'}]});
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'navigation.ts'),"export const useRouter=()=>({push(url){location.assign(url);}});");
  writeFileSync(path.join(dir,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import Messenger from '../../app/messenger';createRoot(document.getElementById('root')).render(<React.StrictMode><Messenger/></React.StrictMode>);");
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  const styles=compiledStyles();
  server=createServer(async(req,res)=>{
   if(req.url==='/api/chat'){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw);res.setHeader('Content-Type','application/json');
    if(p.action==='list'){res.end(JSON.stringify(listing()));return;}
    if(p.action==='messages'){
     if(failedRefresh&&p.chat==='a'){res.statusCode=503;res.end('{"error":"Actualisation temporairement indisponible"}');return;}
     res.end(JSON.stringify({messages:stored[p.chat]}));return;
    }
    if(p.action==='send'){
     sent.push(p);let message=tokens.get(p.clientId);
     if(!message){message={id:'own-'+sent.length,author:'me',name:'Moi',body:p.body,created:Date.now(),scheduled:p.scheduled};tokens.set(p.clientId,message);stored[p.chat].push(message);}
     const finish=()=>{if(ambiguous){ambiguous=false;res.statusCode=503;res.end('{"error":"Confirmation indisponible : réessayez"}');}else res.end(JSON.stringify({id:message.id}));};
     if(holdSend){holdSend=false;releaseSend=finish;}else finish();return;
    }
    res.end('{"ok":true}');return;
   }
   if(req.url==='/api/files'){
    for await(const part of req)void part;
    const finish=()=>{stored.a.push({id:'file-a',author:'me',name:'Moi',body:'Fichier pour Alice',created:Date.now(),scheduled:0});res.setHeader('Content-Type','application/json');res.end('{"ok":true}');};
    if(holdFile){holdFile=false;releaseFile=finish;}else finish();return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   res.setHeader('Content-Type','text/html');res.end('<html data-luma="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  win=new BrowserWindow({width:390,height:844});await win.loadURL(origin+'/messages');
  const open=async name=>{if(await win.page.getByRole('button',{name:'Revenir aux discussions',exact:true}).isVisible())await win.page.getByRole('button',{name:'Revenir aux discussions',exact:true}).click();await win.page.getByRole('button',{name:'Ouvrir la discussion avec '+name,exact:true}).click();};
  const editor=name=>win.page.getByPlaceholder('Écrivez votre message à '+name+'...', {exact:true});
  const text=()=>run(win,"document.querySelector('input[placeholder^=\"Écrivez\"]').value");
  await until(()=>run(win,"!!document.querySelector('[aria-label=\"Ouvrir la discussion avec Alice\"]')"),'list loaded');
  await open('Alice');await editor('Alice').fill('Brouillon Alice');await open('Bob');await editor('Bob').fill('Brouillon Bob');await open('Alice');
  assert.equal(await text(),'Brouillon Alice','switching discussion preserves its own draft');
  holdSend=true;
  await run(win,"(()=>{const input=document.querySelector('input[placeholder^=\"Écrivez\"]');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()");
  await until(()=>!!releaseSend,'send delayed');assert.equal(sent.length,1,'two same-tick submissions send once');
  await editor('Alice').fill('Suite du brouillon Alice');await open('Bob');assert.equal(await text(),'Brouillon Bob');releaseSend();releaseSend=null;
  await until(()=>win.page.getByTitle('Envoyer le message',{exact:true}).isEnabled(),'send completed');
  assert.equal(await text(),'Brouillon Bob','late acknowledgement preserves other draft');
  assert.equal(await win.page.locator('main>section').getByText('Brouillon Alice',{exact:true}).count(),0,'late acknowledgement does not replace another conversation');
  await open('Alice');assert.equal(await text(),'Suite du brouillon Alice','typing during send is preserved');
  await until(()=>win.page.locator('main>section').getByText('Brouillon Alice',{exact:true}).count(),'accepted message recovered in its conversation');
  failedRefresh=true;await editor('Alice').fill('Accepté malgré actualisation');await editor('Alice').press('Enter');
  await until(async()=>(await text())==='','accepted send clears its draft');
  await until(()=>win.page.locator('footer [role="alert"]').getByText('Actualisation temporairement indisponible',{exact:true}).count(),'refresh failure visible on mobile');
  assert.equal(stored.a.filter(m=>m.body==='Accepté malgré actualisation').length,1);assert.equal(await text(),'','refresh failure never restores an already-sent message');
  failedRefresh=false;await run(win,"window.dispatchEvent(new Event('luma-native-active'))");
  await until(()=>win.page.locator('main>section').getByText('Accepté malgré actualisation',{exact:true}).count(),'refresh recovers accepted message');
  ambiguous=true;await editor('Alice').fill('Nouvelle tentative sûre');await editor('Alice').press('Enter');
  await until(()=>win.page.locator('footer [role="alert"]').getByText('Confirmation indisponible : réessayez',{exact:true}).count(),'ambiguous confirmation retains visible feedback');
  assert.equal(await text(),'Nouvelle tentative sûre');
  await open('Bob');assert.equal(await win.page.locator('footer [role="alert"]').count(),0,'send failure belongs to its discussion');await open('Alice');
  await editor('Alice').press('Enter');await until(async()=>(await text())==='','retry confirmed');
  assert.equal(sent.at(-1).clientId,sent.at(-2).clientId,'retry reuses the same server deduplication key');assert.equal(stored.a.filter(m=>m.body==='Nouvelle tentative sûre').length,1);
  await editor('Alice').fill('Nouvelle tentative sûre');await editor('Alice').press('Enter');await until(()=>stored.a.filter(m=>m.body==='Nouvelle tentative sûre').length===2,'intentional repeated content is a new message');
  assert.notEqual(sent.at(-1).clientId,sent.at(-2).clientId);
  await until(()=>win.page.getByTitle('Joindre un fichier (jusqu’à 20 Mo)',{exact:true}).isEnabled(),'composer unlocked');
  holdFile=true;await win.page.locator('input[type="file"]').setInputFiles({name:'test.txt',mimeType:'text/plain',buffer:Buffer.from('test')});await until(()=>!!releaseFile,'upload delayed');
  await open('Bob');releaseFile();releaseFile=null;await until(()=>win.page.getByTitle('Joindre un fichier (jusqu’à 20 Mo)',{exact:true}).isEnabled(),'upload completed');
  assert.equal(await text(),'Brouillon Bob');assert.equal(await win.page.locator('main>section').getByText('Fichier pour Alice',{exact:true}).count(),0,'late upload cannot replace another conversation');
  await open('Alice');await until(()=>win.page.locator('main>section').getByText('Fichier pour Alice',{exact:true}).count(),'uploaded file shown in original discussion');
  ambiguous=true;await editor('Alice').fill('Programmé avec nouvelle tentative');await win.page.getByTitle("Planifier l'envoi",{exact:true}).click();
  const planned=new Date(Date.now()+120000),localDate=new Date(planned.getTime()-planned.getTimezoneOffset()*60000).toISOString().slice(0,16);
  await win.page.locator('input[type="datetime-local"]').fill(localDate);await win.page.getByRole('button',{name:'Confirmer l’envoi programmé',exact:true}).click();
  await until(()=>win.page.locator('[role="dialog"] [role="alert"]').isVisible(),'scheduled send failure visible in its dialog');
  const plannedAttempt=sent.at(-1);assert.ok(plannedAttempt.scheduled>Date.now());
  await run(win,'window.originalNow=Date.now;Date.now=()=>'+(plannedAttempt.scheduled+60000));
  await win.page.getByRole('button',{name:'Confirmer l’envoi programmé',exact:true}).click();
  await until(()=>win.page.locator('[role="dialog"]').count().then(count=>count===0),'retry after scheduled time acknowledged');
  await run(win,'Date.now=window.originalNow');assert.equal(sent.at(-1).clientId,plannedAttempt.clientId);assert.equal(stored.a.filter(m=>m.body==='Programmé avec nouvelle tentative').length,1);
  console.log('PASS per-chat drafts, same-tick send lock, typing during send, cross-chat replies/uploads, accepted-send refresh failure, visible mobile errors, retry identity and intentional repeated messages.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));writeFileSync(path.join(dir,'debug.png'),(await win.webContents.capturePage()).toPNG());}catch{}process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
