/* Two isolated browsers with real WebRTC and synthetic devices; no production data. */
const {app,BrowserWindow,session}=process.env.LUMA_CALL_TEST_BROWSER==='edge'?require('./test-call-browser.cjs'):require('electron');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/call-ui');
const testWidth=Number(process.env.LUMA_CALL_TEST_WIDTH)||390;
const testTheme=process.env.LUMA_CALL_TEST_THEME==='light'?'light':'dark';
mkdirSync(dir,{recursive:true});
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
const wave=Buffer.alloc(44+48000*2*5);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(48000,24);wave.writeUInt32LE(96000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);for(let i=0;i<48000*5;i++)wave.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/48000)*12000),44+i*2);writeFileSync(path.join(dir,'tone.wav'),wave);
app.commandLine.appendSwitch('use-file-for-fake-audio-capture',path.join(dir,'tone.wav'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.setPath('userData',path.join(dir,'profile-'+Date.now()));
let server;const windows=[];let call={caller:'a',callee:'b',callerName:'Alice',calleeName:'Bob',mode:'audio',state:'preparing',offer:null,answer:null};
const participants=new Set(),signals={a:[],b:[]};
const memberships=new Map();let membershipClock=Date.now(),watchExpired=false,otherSawAbsence=false,loseRejoinResponse=false,expiredUser='a';
const callGets={a:0,b:0};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(200);}throw Error('Timeout '+label);}
async function run(w,code){return w.webContents.executeJavaScript(code,true);}
async function click(w,text){await run(w,`[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}))?.click()`);}
async function open(who,kind,base){
 const ses=session.fromPartition('calls-'+Date.now()+who);ses.setPermissionRequestHandler((_wc,p,cb)=>cb(p==='media'));ses.setPermissionCheckHandler((_wc,p)=>p==='media');
 const win=new BrowserWindow({show:false,width:testWidth,height:844,webPreferences:{session:ses,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 windows.push(win);await win.loadURL(base+'/?who='+who+'&kind='+kind);return win;
}
async function resumeExpiredRoom(a,b,loseResponse=false,expired='a',onRejoined){
 for(const w of [a,b])await run(w,'window.__beforeRejoinPeers=[...window.__peers]');
 expiredUser=expired;const returning=expired==='a'?a:b;
 watchExpired=true;otherSawAbsence=false;loseRejoinResponse=loseResponse;participants.delete(expired);await run(returning,"window.dispatchEvent(new Event('luma-native-active'))");
 await until(()=>participants.has(expired),'expired membership explicitly rejoins');
 assert.equal(otherSawAbsence,false,'the other peer has not observed the temporary absence');watchExpired=false;
 if(onRejoined){await until(()=>run(returning,"document.body.innerText.includes('Reconnexion au salon')"),'rejoin response applied before the next poll');await onRejoined();}
 await until(async()=>{for(const w of [a,b])await run(w,"window.dispatchEvent(new Event('luma-native-active'))");return (await Promise.all([a,b].map(w=>run(w,"window.__beforeRejoinPeers.every(p=>p.connectionState==='closed')&&window.__peers.some(p=>p.connectionState==='connected')")))).every(Boolean);},'changed membership rebuilds both peer connections');
}
app.on('window-all-closed',()=>{}); app.whenReady().then(async()=>{
 try{
 writeFileSync(path.join(dir,'entry.tsx'),`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import Call from '../../app/appel/[id]/room';import Room from '../../app/salle/[id]/room';
 import Preferences from '../../app/parametres/user-preferences';import Theme from '../../app/theme-provider';
 const p=new URLSearchParams(location.search);const original=window.fetch;
 // Simulate an Android WebView whose interval was suspended in the background.
 // Connection signals must be processed by the foreground/online handlers.
 if(p.get('kind')==='group'){const interval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>interval(fn,ms===1000?60000:ms,...args);}
 window.fetch=(url,options={})=>original(url,{...options,headers:{...options.headers,'x-test-user':p.get('who')}});
 if(p.get('kind')!=='settings'){
  window.__lumaCallService=true;window.__nativeStops=[];window.__nativeCallRequests=[];
  window.ReactNativeWebView={postMessage(raw){const message=JSON.parse(raw);
   if(message.type==='request-media-permissions'){queueMicrotask(()=>window.dispatchEvent(new CustomEvent('luma-native-permissions',{detail:{requestId:message.requestId,granted:true}})));return;}
   if(message.type!=='call-session')return;
   if(message.action==='stop'){window.__nativeStops.push(message.token);return;}
   window.__nativeCallRequests.push(message);window.__lastNativeToken=message.token;
   const ok=!window.__nativeReject;window.__nativeReject=false;
   const reply=()=>window.dispatchEvent(new CustomEvent('luma-native-call-service',{detail:{requestId:message.requestId,token:message.token,ok,error:ok?'':'Service Android refusé'}}));
   if(window.__holdNativeStart){window.__holdNativeStart=false;window.__releaseNativeStart=reply;}else queueMicrotask(reply);
  }};
 }
 localStorage.setItem('luma-media-devices',JSON.stringify({input:'default',output:'test-headphones'}));
 window.__captures=[];window.__cameraTracks=[];const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async constraints=>{window.__captures.push(constraints);if(window.__singleCamera&&constraints.video&&window.__cameraTracks.some(track=>track.readyState==='live'))throw new DOMException('Camera already in use','NotReadableError');const stream=await capture(constraints);window.__cameraTracks.push(...stream.getVideoTracks());window.__lastCapture=stream;return stream;};
 window.__outputs=[];HTMLMediaElement.prototype.setSinkId=async function(id){window.__outputs.push(id);};
 window.__peers=[];const Peer=window.RTCPeerConnection;window.RTCPeerConnection=class extends Peer{constructor(c){super(c);window.__peers.push(this);}};
 navigator.mediaDevices.getDisplayMedia=()=>navigator.mediaDevices.getUserMedia({video:true,audio:false});
 const root=createRoot(document.getElementById('root'));
 window.__unmount=()=>root.unmount();
 window.__contrast=(el,media=false)=>{const rgb=value=>(value.match(/[0-9.]+/g)||[]).map(Number),luminance=c=>{const n=c.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return n[0]*.2126+n[1]*.7152+n[2]*.0722;};let node=el,bg=[255,255,255];while(node){const c=rgb(getComputedStyle(node).backgroundColor);if(media&&c.length===4&&c[3]>0){bg=c.slice(0,3).map(v=>v*c[3]+255*(1-c[3]));break;}if(c.length===3||c[3]===1){bg=c.slice(0,3);break;}node=node.parentElement;}const a=luminance(rgb(getComputedStyle(el).color).slice(0,3)),b=luminance(bg);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
 root.render(<React.StrictMode><Theme/>{p.get('kind')==='settings'?<Preferences/>:p.get('kind')==='group'?<Room id="test"/>:<Call id="test"/>}</React.StrictMode>);
 `);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd()},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
 const styles=compiledStyles();
 server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){
   let body='';for await(const c of req)body+=c;const p=JSON.parse(body||'{}'),who=req.headers['x-test-user'];let out={};
   if(req.url==='/api/profile')out={profile:{name:'Test',bio:'',avatar:false,notifications:'all',call_camera:0,call_noise_suppression:1,call_echo_cancellation:1,reduce_motion:0}};
   else if(req.url==='/api/calls'){
    if(p.action==='config')out={iceServers:[],relayConfigured:true};
    if(p.action==='get'){callGets[who]++;out={call,me:who};}
    if(p.action==='offer'){call.offer=p.sdp;call.state='ringing';}
    if(p.action==='answer'){call.answer=p.sdp;call.state='active';}
    if(p.action==='end')call.state='ended';
   }else{
    const roster=()=>[...participants].map(user=>({user,name:user,joined:memberships.get(user)||1}));
    const info={me:who,room:{mode:'audio',kind:'voice',chat_name:'Test'},participants:roster(),ice:{iceServers:[]}};
    if(p.action==='info')out=info;
    if(p.action==='join'){if(!participants.has(who)){memberships.set(who,++membershipClock);signals[who]=[];}participants.add(who);out={...info,joined:memberships.get(who)};if(loseRejoinResponse&&who===expiredUser){loseRejoinResponse=false;res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Réponse de reprise perdue'}));return;}}
    if(p.action==='poll'){
     if(watchExpired&&who!==expiredUser&&!participants.has(expiredUser))otherSawAbsence=true;
     if(p.joined&&participants.has(who)&&p.joined!==memberships.get(who)){res.writeHead(409,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Session remplacée'}));return;}
     if(p.joined&&!participants.has(who))out={rejoin:true,participants:[],signals:[]};
     else if(p.reliable){signals[who]=signals[who].filter(signal=>!p.acknowledgements?.includes(signal.id));out={participants:roster(),signals:[...signals[who]]};}
     else out={participants:roster(),signals:signals[who]?.splice(0)||[]};
    }
    if(p.action==='signal')signals[p.recipient]?.push({id:require('node:crypto').randomUUID(),sender:who,type:p.type,payload:p.payload});
    if(p.action==='leave')participants.delete(who);
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(out));return;
  }
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  res.setHeader('Content-Type','text/html');res.end('<html data-luma="'+testTheme+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><script>localStorage.setItem("luma-theme",JSON.stringify({mode:"'+testTheme+'"}));</script><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button{font:inherit}'+styles+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const checks=[];
 for(const kind of ['private','group']){
  const a=await open('a',kind,base),b=await open('b',kind,base);
  await until(()=>run(a,"!!document.querySelector('button:not(:disabled)')"),'loaded');
  for(const w of [a,b]){
   await until(()=>run(w,"document.querySelectorAll('.call-preflight label,.room-preflight label').length>0"),kind+' preflight ready');
   assert.equal(await run(w,"[...document.querySelectorAll('.call-preflight label,.room-preflight label')].every(el=>parseFloat(getComputedStyle(el).fontSize)>=13&&el.getBoundingClientRect().height>=44)"),true,kind+' readable and touch-sized call preferences');
   assert.equal(await run(w,"[...document.querySelectorAll('.call-preflight label,.room-preflight label')].every(el=>window.__contrast(el)>=4.5)"),true,kind+' call preference contrast in '+testTheme+' theme');
   assert.equal(await run(w,"[...document.querySelectorAll('.call-room header>p,.room-page>header span')].every(el=>window.__contrast(el)>=4.5)"),true,kind+' call status contrast in '+testTheme+' theme');
  }
  if(kind==='private'){
   await until(()=>run(a,"!!document.querySelector('.call-start:not(:disabled)')"),'caller ready');
   await run(a,'window.__nativeReject=true');await click(a,'Démarrer');await until(()=>run(a,"document.body.innerText.includes('Service Android refusé')"),'native refusal shown');
   assert.equal(await run(a,'window.__captures.length'),0,'native refusal does not open the microphone');
   await run(a,'window.__holdNativeStart=true');await click(a,'Démarrer');await until(()=>run(a,'!!window.__releaseNativeStart'),'native startup waiting');
   assert.equal(await run(a,'window.__captures.length'),0,'capture waits for native foreground startup');await run(a,'window.__releaseNativeStart()');
   await until(()=>call.state==='ringing','offer');await until(()=>run(b,"!!document.querySelector('.call-start:not(:disabled)')"),'callee ready');await click(b,'Accepter');
   checks.push('native service startup gates capture and handles refusal');
  }
  else {for(const w of [a,b]){await until(()=>run(w,"!!document.querySelector('.room-lobby button:not(:disabled)')"),'room ready');await click(w,'Rejoindre le salon');}}
  if(kind==='group'){
   await until(async()=>{
    for(const w of [a,b])await run(w,"window.dispatchEvent(new Event('luma-native-active'));window.dispatchEvent(new Event('online'))");
    return (await Promise.all([a,b].map(w=>run(w,"window.__peers.some(p=>p.connectionState==='connected')")))).every(Boolean);
   },'group signaling after background resume');
   checks.push('group foreground signaling with suspended intervals');
  }
  for(const w of [a,b]){
   await until(()=>run(w,"window.__peers.some(p=>p.connectionState==='connected')"),kind+' connected');
   await until(()=>run(w,"(async()=>{for(const p of window.__peers){if(p.connectionState!=='connected')continue;for(const s of (await p.getStats()).values())if(s.type==='inbound-rtp'&&s.kind==='audio'&&s.bytesReceived>0&&s.totalAudioEnergy>0)return true;}return false;})()"),kind+' audio decoded');
  }
  checks.push(kind+' bidirectional audio energy');
  if(kind==='group'){
   await run(a,'window.__beforeRejoinCaptures=window.__captures.length;window.__beforeRejoinMic=window.__peers.flatMap(p=>p.getSenders()).find(s=>s.track?.kind==="audio").track');
   await click(a,'Micro');assert.equal(await run(a,'window.__beforeRejoinMic.enabled'),false,'mute applied before expiry');
   assert.equal(await run(a,"[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='Vous')?.querySelector('small')?.textContent"),'Micro coupé','local tile clearly identifies mute state');
   await resumeExpiredRoom(a,b,true);
   assert.equal(await run(a,'window.__captures.length===window.__beforeRejoinCaptures&&window.__beforeRejoinMic.enabled===false&&window.__beforeRejoinMic.readyState==="live"'),true,'rejoin preserves the microphone and mute preference without another capture');
   await click(a,'Activer micro');
   assert.equal(await run(a,"[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='Vous')?.querySelector('small')?.textContent"),'Micro actif','local tile updates when microphone is enabled');
   for(const w of [a,b])await until(()=>run(w,"(async()=>{for(const p of window.__peers){if(p.connectionState!=='connected')continue;for(const s of (await p.getStats()).values())if(s.type==='inbound-rtp'&&s.kind==='audio'&&s.totalAudioEnergy>0)return true;}return false;})()"),'bidirectional audio after membership expiry');
   checks.push('expired room membership retries a lost rejoin response, resets both peers, preserves muted microphone and restores bidirectional audio');
  }
  await run(a,"window.dispatchEvent(new CustomEvent('luma-native-call-ended',{detail:{token:'another-call'}}))");
  assert.equal(await run(a,"window.__peers.some(peer=>peer.connectionState==='connected')"),true,'another native session cannot end this call');
  // A stalled poll must time out, retain the media connection, and recover
  // through the same foreground handler that Android uses after suspension.
  await run(a,`window.__realTimeout=window.setTimeout;window.setTimeout=(fn,ms,...args)=>window.__realTimeout(fn,ms===12000?100:ms,...args);
   window.__beforeStall=window.fetch;window.__stallPoll=true;window.__pollAborted=0;
   window.fetch=(url,options={})=>{let body={};try{body=JSON.parse(options.body||'{}');}catch{}
    if(window.__stallPoll&&['get','poll'].includes(body.action)){window.__stallPoll=false;return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{window.__pollAborted++;reject(new DOMException('Timed out','AbortError'));},{once:true}));}
    return window.__beforeStall(url,options);};window.dispatchEvent(new Event('online'));`);
  await until(()=>run(a,"window.__pollAborted===1"),kind+' stalled poll aborted');
  assert.equal(await run(a,"window.__peers.some(peer=>peer.connectionState==='connected')"),true,kind+' timeout preserves active media');
  await until(async()=>{await run(a,"window.dispatchEvent(new Event('luma-native-active'))");return run(a,"!document.body.innerText.includes('Actualisation interrompue')&&!document.body.innerText.includes('Le serveur met trop de temps')");},kind+' recovered poll clears transient error');
  await run(a,'window.fetch=window.__beforeStall;window.setTimeout=window.__realTimeout');
  checks.push(kind+' bounded refresh timeout and foreground recovery preserve connected media');
  for(const w of [a,b]){
   assert.equal(await run(w,"window.__captures.find(c=>c.audio)?.audio.deviceId?.ideal"),'default',kind+' saved microphone applied');
   assert.equal(await run(w,"window.__outputs.includes('test-headphones')"),true,kind+' saved output applied');
  }
  checks.push(kind+' saved microphone and output applied');
  await click(a,'Caméra');
  await until(()=>run(b,"[...document.querySelectorAll('video')].some(v=>v.videoWidth>0)"),kind+' camera enabled after audio join');
  checks.push(kind+' camera enabled mid-call');
  await run(a,"window.__singleCamera=true;window.__oldCamera=window.__lastCapture.getVideoTracks()[0];window.__micTrack=window.__peers.flatMap(peer=>peer.getSenders()).find(sender=>sender.track?.kind==='audio').track");
  await click(a,'Retourner');
  await until(()=>run(a,"window.__oldCamera.readyState==='ended'&&window.__lastCapture.getVideoTracks()[0]!==window.__oldCamera&&window.__lastCapture.getVideoTracks()[0]?.readyState==='live'"),kind+' single-camera hardware switch');
  assert.equal(await run(a,"window.__micTrack.readyState==='live'&&window.__micTrack.enabled"),true,kind+' camera flip keeps microphone active');
  await run(a,'window.__singleCamera=false');checks.push(kind+' single-camera switch releases video only');
  assert.equal(await run(a,'document.documentElement.scrollWidth<=innerWidth'),true,kind+' mobile horizontal overflow');
  assert.equal(await run(a,"[...document.querySelectorAll('.call-controls button,.room-page>footer button')].every(button=>{const r=button.getBoundingClientRect(),text=button.querySelector('span')||button;return r.height>=44&&parseFloat(getComputedStyle(text).fontSize)>=11&&button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})"),true,kind+' readable call controls remain reachable');
  assert.equal(await run(a,"[...document.querySelectorAll('.call-expand')].every(button=>{const r=button.getBoundingClientRect();return r.width>=44&&r.height>=44&&button.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})"),true,kind+' expansion controls reachable without overlap');
  writeFileSync(path.join(dir,kind+'-mobile.png'),(await a.webContents.capturePage()).toPNG());
  await run(a,'window.__cameraBeforeShare=window.__lastCapture.getVideoTracks()[0]');
  await click(a,kind==='private'?'Partager l’écran':'Écran');
  await until(()=>run(a,"[...document.querySelectorAll('button')].some(b=>!b.disabled&&(b.textContent==='Arrêter le partage'||b.textContent==='Arrêter'))"),kind+' sharing');
  if(kind==='group'){
   await run(a,"window.__sharedTrack=window.__lastCapture.getVideoTracks()[0];window.__shareCaptures=window.__captures.length;[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='Votre écran').querySelector('.call-expand').click()");
   await run(b,"[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='a').querySelector('.call-expand').click()");
   await resumeExpiredRoom(a,b);
   assert.equal(await run(a,"(()=>{const self=[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='Votre écran');return self?.querySelector('video')?.srcObject?.getVideoTracks()[0]===window.__sharedTrack;})()"),true,'rejoined local preview remains the shared screen');
   assert.equal(await run(a,"window.__captures.length===window.__shareCaptures&&window.__sharedTrack.readyState==='live'&&window.__cameraBeforeShare.readyState==='live'&&window.__peers.filter(p=>p.connectionState==='connected').every(p=>p.getSenders().some(s=>s.track===window.__sharedTrack))"),true,'reconnection sends the same live screen without recapturing it or stopping the camera');
   for(const w of [a,b])assert.equal(await run(w,"!!document.querySelector('.is-expanded')"),true,'expanded sharing survives reconnection');
   await resumeExpiredRoom(a,b,false,'b',async()=>{assert.equal(await run(b,"document.querySelector('.is-expanded b')?.textContent==='a'"),true,'receiver keeps the expanded remote tile visible while rebuilding its connections');assert.equal(await run(b,"document.querySelector('.is-expanded small')?.textContent==='Connexion en cours…'"),true,'expanded receiver shows reconnection state until media returns');assert.equal(await run(b,"[...document.querySelectorAll('.is-expanded>b,.is-expanded>small')].every(el=>parseFloat(getComputedStyle(el).fontSize)>=12&&window.__contrast(el,true)>=4.5)"),true,'expanded call labels remain readable even over bright video');writeFileSync(path.join(dir,'group-sharing-reconnecting.png'),(await b.webContents.capturePage()).toPNG());});
   await until(()=>run(b,"[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='a')?.querySelector('video')?.videoWidth>0"),'remote shared video after reconnection');
   await until(()=>run(b,"(async()=>{for(const peer of window.__peers){if(peer.connectionState!=='connected')continue;for(const stat of (await peer.getStats()).values())if(stat.type==='inbound-rtp'&&stat.kind==='video'&&stat.framesDecoded>0)return true;}return false;})()"),'shared frames decoded after receiver reconnects');
   writeFileSync(path.join(dir,'group-sharing-reconnected.png'),(await b.webContents.capturePage()).toPNG());
   for(const w of [a,b])await run(w,"window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
   checks.push('sharing reconnects with its original screen track, matching preview and expanded view on both sides');
  }
  await run(b,kind==='group'?"[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='a').querySelector('.call-expand').click()":"document.querySelector('.call-expand').click()");
  await until(()=>run(b,"!!document.querySelector('.is-expanded')"),kind+' shared video expands');
  const fullscreen=await run(b,"(()=>{const r=document.querySelector('.is-expanded').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,viewportWidth:innerWidth,viewportHeight:innerHeight};})()");
  assert.equal(fullscreen.x,0);assert.equal(fullscreen.y,0);assert.equal(fullscreen.width,fullscreen.viewportWidth);assert.equal(fullscreen.height,fullscreen.viewportHeight,kind+' expanded video fills mobile viewport');
  writeFileSync(path.join(dir,kind+'-expanded.png'),(await b.webContents.capturePage()).toPNG());
  await run(b,"window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  await until(()=>run(b,"!document.querySelector('.is-expanded')"),kind+' Escape reduces video without leaving call');
  assert.equal(await run(b,"window.__peers.some(p=>p.connectionState==='connected')"),true);
  checks.push(kind+' reachable 44px expansion controls and full viewport sharing');
  await click(a,kind==='private'?'Arrêter le partage':'Arrêter');
  await until(()=>run(a,"[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Caméra')&&!b.disabled)"),kind+' camera restored');
  if(kind==='group')assert.equal(await run(a,"(()=>{const self=[...document.querySelectorAll('article')].find(el=>el.querySelector('b')?.textContent==='Vous');return window.__sharedTrack.readyState==='ended'&&self?.querySelector('video')?.srcObject?.getVideoTracks()[0]===window.__cameraBeforeShare;})()"),true,'stopping a reconnected share restores the original camera preview');
  checks.push(kind+' share/restore');
  // Refusing camera access must not trigger a second permission/capture request.
  await run(a,"window.__capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.__cameraRequests=0;navigator.mediaDevices.getUserMedia=()=>{window.__cameraRequests++;return Promise.reject(new DOMException('Permission denied','NotAllowedError'));}");
  await click(a,'Retourner');
  await until(()=>run(a,"!!document.querySelector('[role=alert]')&&[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Caméra')&&!button.disabled)"),kind+' permission denied');
  assert.equal(await run(a,'window.__cameraRequests'),1,kind+' repeated camera permission request');
  await run(a,'navigator.mediaDevices.getUserMedia=window.__capture');
  assert.equal(await run(a,"window.__micTrack.readyState==='live'&&window.__micTrack.enabled"),true,kind+' refused switch keeps microphone active');
  await click(a,'Caméra');await until(()=>run(a,"[...document.querySelectorAll('button')].some(button=>button.textContent.includes('Retourner')&&!button.disabled)"),kind+' camera can be enabled after refused switch');
  checks.push(kind+' camera refusal without duplicate request');
  // A device request can resolve after hangup; its stream must be stopped.
  await run(a,"navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await window.__capture(constraints);if(constraints.video&&!constraints.audio){window.__lateCamera=stream;return new Promise(resolve=>{window.__finishCamera=()=>resolve(stream);});}return stream;}");
  await click(a,'Retourner');
  await until(()=>run(a,'!!window.__finishCamera'),kind+' pending camera');
  await run(a,"window.dispatchEvent(new CustomEvent('luma-native-call-ended',{detail:{token:window.__lastNativeToken}}))");
  await run(a,'window.__finishCamera()');
  await until(()=>run(a,"window.__lateCamera.getTracks().every(t=>t.readyState==='ended')"),kind+' late camera released');
  checks.push(kind+' camera released after hangup during capture');
  assert.equal(await run(a,'window.__nativeStops.includes(window.__lastNativeToken)'),true,kind+' notification hangup stops the native service');
  checks.push(kind+' native notification hangup and service cleanup');
  if(kind==='private'){
   await until(()=>run(b,"document.body.innerText.includes('Appel terminé')"),'remote end observed');
   const count=callGets.b;await run(b,"window.dispatchEvent(new Event('online'))");await wait(1800);
   assert.equal(callGets.b,count,'an ended call does not resume polling');checks.push('private polling stops after remote hangup');
  }
  if(kind==='group')await click(b,'Quitter');
  a.destroy();b.destroy();participants.clear();
 }
 // Every participant can show video; roster order must never imply a muted audience.
 const roster=await open('a','group',base);
 await until(()=>run(roster,"!!document.querySelector('.room-lobby button:not(:disabled)')"),'roster ready');
 await click(roster,'Rejoindre le salon');
 for(const uid of ['b','c','d','e','f'])participants.add(uid);
 await run(roster,"window.dispatchEvent(new Event('online'))");
 await until(()=>run(roster,"document.querySelectorAll('.voice-speakers article').length===6"),'all six participants visible');
 assert.equal(await run(roster,"document.querySelectorAll('.voice-audience').length"),0,'no fabricated audience roles');
 await run(roster,"[...document.querySelectorAll('.voice-speakers article')].find(tile=>tile.querySelector('b').textContent==='f').querySelector('.call-expand').click()");
 await until(()=>run(roster,"!!document.querySelector('.voice-speakers article.is-expanded video')"),'sixth participant can expand video');
 assert.equal(await run(roster,"getComputedStyle(document.querySelector('.is-expanded video')).display!=='none'"),true);
 participants.delete('f');await run(roster,"window.dispatchEvent(new Event('online'))");
 await until(()=>run(roster,"window.dispatchEvent(new Event('online'));!document.querySelector('.is-expanded')&&document.querySelectorAll('.voice-speakers article').length===5"),'departing participant closes expanded tile');
 await click(roster,'Quitter');roster.destroy();participants.clear();checks.push('all six participants visible and expandable; departure restores room');
 // Development effect replays must preserve a waiting call; a real unmount
 // still needs to end it, even if the user never enabled their microphone.
 call={...call,state:'preparing',offer:null,answer:null};
 const waiting=await open('a','private',base);
 await until(()=>run(waiting,"!!document.querySelector('.call-start:not(:disabled)')"),'waiting call survived effect replay');
 assert.equal(call.state,'preparing');
 await run(waiting,'window.__unmount()');
 await until(()=>call.state==='ended','call ended on actual unmount');
 waiting.destroy();checks.push('private effect replay and actual unmount');
 const settings=await open('a','settings',base);
 await until(()=>run(settings,"[...document.querySelectorAll('button')].some(b=>b.textContent==='Tester le microphone')"),'microphone settings ready');
 await run(settings,"window.__permissionCalls=0;window.ReactNativeWebView={postMessage(message){const m=JSON.parse(message);if(m.type==='request-media-permissions'){window.__permissionCalls++;window.dispatchEvent(new CustomEvent('luma-native-permissions',{detail:{requestId:m.requestId,granted:true}}));}}}");
 await click(settings,'Tester le microphone');
 await until(()=>run(settings,'!!window.__lastCapture'),'settings microphone captured');
 assert.equal(await run(settings,'window.__permissionCalls'),1,'settings uses native microphone permissions');
 await run(settings,'window.__unmount()');
 await until(()=>run(settings,"window.__lastCapture.getTracks().every(t=>t.readyState==='ended')"),'settings microphone released on navigation');
 settings.destroy();checks.push('settings native microphone permission and cleanup on navigation');
 console.log('PASS '+checks.join('; '));
 writeFileSync(path.join(dir,'result.json'),JSON.stringify({ok:true,checks},null,2));
 }catch(e){for(let i=0;i<windows.length;i++){const w=windows[i];if(!w.isDestroyed())try{writeFileSync(path.join(dir,'debug-'+i+'.json'),JSON.stringify(await run(w,"(async()=>({text:document.body.innerText,media:[...document.querySelectorAll('video,audio')].map(v=>({paused:v.paused,muted:v.muted,tracks:v.srcObject?.getTracks().map(t=>({kind:t.kind,enabled:t.enabled,readyState:t.readyState,muted:t.muted}))})),stats:await Promise.all(window.__peers.map(async p=>[...(await p.getStats()).values()]))}))()"),null,2));}catch{}}console.error(e);writeFileSync(path.join(dir,'result.json'),JSON.stringify({ok:false,error:String(e)}));process.exitCode=1;}
 finally{for(const w of windows)if(!w.isDestroyed())w.destroy();server?.close();app.exit(process.exitCode||0);}
});
setTimeout(()=>{console.error('Test timeout');app.exit(1);},180000);



