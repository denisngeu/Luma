/* Actual shared incoming-call component; local signaling and controlled audio only. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path'),assert=require('node:assert/strict');
const {build}=require('esbuild'),compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/call-inbox');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<130;i++){if(await fn())return;await wait(80);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,incoming={id:'call-1',name:'Alice',mode:'audio',state:'ringing'},polls=0,failEnd=false,holdIncoming=false,releaseIncoming,pollFailure=0;
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'navigation.ts'),"import {useSyncExternalStore} from 'react';export const usePathname=()=>useSyncExternalStore(cb=>{window.addEventListener('popstate',cb);return()=>window.removeEventListener('popstate',cb);},()=>location.pathname,()=>'/messages');");
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React from 'react';import {createRoot} from 'react-dom/client';import CallInbox from '../../app/call-inbox';
   window.__native=new URLSearchParams(location.search).has('native');window.__bridge=[];window.__notifications=[];window.__flashes=0;window.__tones=0;window.__contexts=[];window.__audioUnlocked=false;
   if(window.__native)window.ReactNativeWebView={postMessage:msg=>window.__bridge.push(JSON.parse(msg))};else window.lumaDesktop={flashTaskbar:()=>window.__flashes++};
   window.__navigate=path=>{history.pushState({},'',path);window.dispatchEvent(new PopStateEvent('popstate'));};
   window.Notification=class{static permission='granted';constructor(title,options){this.title=title;this.options=options;this.closed=false;window.__notifications.push(this);}close(){this.closed=true;}};
   window.AudioContext=class{constructor(){this.state='suspended';this.currentTime=0;this.destination={};this.waiters=[];this.resumes=0;window.__contexts.push(this);}resume(){this.resumes++;if(window.__audioUnlocked){this.state='running';this.waiters.splice(0).forEach(resolve=>resolve());return Promise.resolve();}return new Promise(resolve=>this.waiters.push(resolve));}close(){this.state='closed';this.waiters.splice(0).forEach(resolve=>resolve());return Promise.resolve();}createOscillator(){return{frequency:{value:0},connect:target=>target,start:()=>window.__tones++,stop(){}};}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}},connect:target=>target};}};
   createRoot(document.getElementById('root')).render(<React.StrictMode><CallInbox/></React.StrictMode>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  const styles=compiledStyles();
  server=createServer(async(req,res)=>{
   if(req.url==='/api/calls'){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw);res.setHeader('Content-Type','application/json');
    if(p.action==='incoming'){
     polls++;const snapshot=incoming;
     if(holdIncoming){holdIncoming=false;releaseIncoming=()=>res.end(JSON.stringify({calls:snapshot?[snapshot]:[]}));return;}
     if(pollFailure){res.statusCode=pollFailure;res.end('{"error":"Indisponible"}');return;}
     res.end(JSON.stringify({calls:incoming?[incoming]:[]}));return;
    }
    if(p.action==='end'){if(failEnd){res.statusCode=503;res.end('{"error":"Refus non confirmé"}');}else{incoming=null;res.end('{"ok":true}');}return;}
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   res.setHeader('Content-Type','text/html');res.end('<html data-luma="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  win=new BrowserWindow({width:390,height:844});await win.loadURL(origin+'/messages');
  const banner=()=>win.page.getByRole('alert',{name:'Appel entrant',exact:true}).count();
  await until(()=>banner(),'incoming call displayed');
  await until(()=>win.page.getByRole('button',{name:'Activer la sonnerie',exact:true}).isVisible(),'blocked autoplay explained');
  await wait(2400);assert.equal(await run(win,'window.__contexts[0].resumes'),1,'suspended audio does not accumulate resume attempts every ring');
  await run(win,'window.__audioUnlocked=true');await win.page.getByRole('button',{name:'Activer la sonnerie',exact:true}).click();
  await until(()=>run(win,'window.__tones===2'),'audio unlock plays a single two-tone ring');
  const previousPolls=polls;await run(win,"window.dispatchEvent(new Event('online'))");await until(()=>polls>previousPolls,'same-call poll refreshed');
  assert.equal(await run(win,'window.__notifications.length'),1,'same call creates one notification');assert.equal(await run(win,'window.__flashes'),1);
  assert.equal(await win.page.getByRole('link',{name:'Répondre',exact:true}).getAttribute('href'),'/appel/call-1');
  await run(win,"window.__navigate('/appel/call-1')");await until(async()=>!(await banner()),'answer page hides global incoming banner');
  assert.equal(await run(win,'window.__contexts[0].state'),'closed','answer navigation stops the ringtone');assert.equal(await run(win,'window.__notifications[0].closed'),true);
  const pollsInCall=polls;await wait(3700);assert.equal(polls,pollsInCall,'no incoming polling while already in call');
  await run(win,"window.__navigate('/messages')");await until(()=>banner(),'return to inbox refreshes incoming state');
  failEnd=true;await win.page.getByRole('button',{name:'Refuser',exact:true}).click();
  await until(()=>win.page.getByText('Impossible de refuser cet appel. Vérifiez votre connexion puis réessayez.',{exact:true}).isVisible(),'failed decline visible');assert.equal(await banner(),1,'failed decline never hides a still-ringing call');
  assert.equal(await run(win,"(()=>{const el=document.querySelector('.call-inbox'),box=el.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;})()"),true,'mobile call banner and error fit the viewport');
  holdIncoming=true;await run(win,"window.dispatchEvent(new Event('online'))");await until(()=>!!releaseIncoming,'older incoming request held');
  failEnd=false;await win.page.getByRole('button',{name:'Refuser',exact:true}).click();await until(async()=>!(await banner()),'decline confirmed');releaseIncoming();releaseIncoming=null;await wait(250);assert.equal(await banner(),0,'stale incoming reply cannot resurrect a declined call');
  incoming={id:'call-2',name:'Bob',mode:'video',state:'preparing'};await run(win,"window.dispatchEvent(new Event('online'))");await until(()=>banner(),'next caller displayed');
  pollFailure=503;await run(win,"window.originalNow=Date.now;Date.now=()=>window.originalNow()+20000;window.dispatchEvent(new Event('online'))");await until(async()=>!(await banner()),'unconfirmed stale call stops ringing during prolonged signaling failure');
  await run(win,'Date.now=window.originalNow');pollFailure=0;await run(win,"window.dispatchEvent(new Event('online'))");await until(()=>banner(),'polling recovers after network failure');
  pollFailure=401;await run(win,"window.dispatchEvent(new Event('online'))");await until(async()=>!(await banner()),'expired session clears the incoming call');pollFailure=0;
  win.destroy();win=new BrowserWindow({width:320,height:740});await win.loadURL(origin+'/messages?native=1');
  await until(()=>run(win,"window.__bridge.some(item=>item.id==='call-2')"),'native ringtone notified');assert.equal(await run(win,'window.__contexts.length'),0,'native wrapper owns its ringtone');
  assert.equal(await run(win,"(()=>{const el=document.querySelector('.call-inbox'),box=el.getBoundingClientRect();return box.left>=0&&box.right<=innerWidth+1&&el.scrollWidth<=el.clientWidth+1;})()"),true,'incoming actions fit a 320px Android viewport');
  await run(win,"window.dispatchEvent(new Event('luma-native-background'))");await until(async()=>!(await banner()),'native background clears the foreground banner');
  await run(win,"window.dispatchEvent(new Event('luma-native-active'))");await until(()=>banner(),'native foreground resumes incoming checks');
  await run(win,"window.__navigate('/appel/call-2')");await until(async()=>!(await banner()),'native answered route hides inbox');assert.equal(await run(win,'window.__bridge.at(-1).id'),null,'native ringtone explicitly stopped when answering');
  console.log('PASS incoming lifecycle, one notification per call, autoplay unlock, ring cleanup on answer, confirmed decline, stale replies, network recovery, expired session and native bridge.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));writeFileSync(path.join(dir,'debug.png'),(await win.webContents.capturePage()).toPNG());}catch{}process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
