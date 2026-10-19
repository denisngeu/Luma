/* Two isolated browsers with real WebRTC and synthetic devices; no production data. */
const {app,BrowserWindow,session}=process.env.LUMA_CALL_TEST_BROWSER==='edge'?require('./test-call-browser.cjs'):require('electron');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const dir=path.resolve('.sites-runtime/call-ui');
mkdirSync(dir,{recursive:true});
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
app.commandLine.appendSwitch('use-fake-ui-for-media-stream');
const wave=Buffer.alloc(44+48000*2*5);wave.write('RIFF');wave.writeUInt32LE(wave.length-8,4);wave.write('WAVEfmt ',8);wave.writeUInt32LE(16,16);wave.writeUInt16LE(1,20);wave.writeUInt16LE(1,22);wave.writeUInt32LE(48000,24);wave.writeUInt32LE(96000,28);wave.writeUInt16LE(2,32);wave.writeUInt16LE(16,34);wave.write('data',36);wave.writeUInt32LE(wave.length-44,40);for(let i=0;i<48000*5;i++)wave.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/48000)*12000),44+i*2);writeFileSync(path.join(dir,'tone.wav'),wave);
app.commandLine.appendSwitch('use-file-for-fake-audio-capture',path.join(dir,'tone.wav'));
app.commandLine.appendSwitch('autoplay-policy','no-user-gesture-required');
app.setPath('userData',path.join(dir,'profile-'+Date.now()));
let server;const windows=[];let call={caller:'a',callee:'b',callerName:'Alice',calleeName:'Bob',mode:'audio',state:'preparing',offer:null,answer:null};
const participants=new Set(),signals={a:[],b:[]};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(200);}throw Error('Timeout '+label);}
async function run(w,code){return w.webContents.executeJavaScript(code,true);}
async function click(w,text){await run(w,`[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}))?.click()`);}
async function open(who,kind,base){
 const ses=session.fromPartition('calls-'+Date.now()+who);ses.setPermissionRequestHandler((_wc,p,cb)=>cb(p==='media'));ses.setPermissionCheckHandler((_wc,p)=>p==='media');
 const win=new BrowserWindow({show:false,width:390,height:844,webPreferences:{session:ses,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 windows.push(win);await win.loadURL(base+'/?who='+who+'&kind='+kind);return win;
}
app.on('window-all-closed',()=>{}); app.whenReady().then(async()=>{
 try{
 writeFileSync(path.join(dir,'entry.tsx'),`
 import React from 'react';import {createRoot} from 'react-dom/client';
 import Call from '../../app/appel/[id]/room';import Room from '../../app/salle/[id]/room';
 import Preferences from '../../app/parametres/user-preferences';
 const p=new URLSearchParams(location.search);const original=window.fetch;
 // Simulate an Android WebView whose interval was suspended in the background.
 // Connection signals must be processed by the foreground/online handlers.
 if(p.get('kind')==='group'){const interval=window.setInterval.bind(window);window.setInterval=(fn,ms,...args)=>interval(fn,ms===1000?60000:ms,...args);}
 window.fetch=(url,options={})=>original(url,{...options,headers:{...options.headers,'x-test-user':p.get('who')}});
 localStorage.setItem('luma-media-devices',JSON.stringify({input:'default',output:'test-headphones'}));
 window.__captures=[];const capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
 navigator.mediaDevices.getUserMedia=async constraints=>{window.__captures.push(constraints);const stream=await capture(constraints);window.__lastCapture=stream;return stream;};
 window.__outputs=[];HTMLMediaElement.prototype.setSinkId=async function(id){window.__outputs.push(id);};
 window.__peers=[];const Peer=window.RTCPeerConnection;window.RTCPeerConnection=class extends Peer{constructor(c){super(c);window.__peers.push(this);}};
 navigator.mediaDevices.getDisplayMedia=()=>navigator.mediaDevices.getUserMedia({video:true,audio:false});
 const root=createRoot(document.getElementById('root'));
 window.__unmount=()=>root.unmount();
 root.render(<React.StrictMode>{p.get('kind')==='settings'?<Preferences/>:p.get('kind')==='group'?<Room id="test"/>:<Call id="test"/>}</React.StrictMode>);
 `);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd()},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
 server=createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){
   let body='';for await(const c of req)body+=c;const p=JSON.parse(body||'{}'),who=req.headers['x-test-user'];let out={};
   if(req.url==='/api/profile')out={profile:{name:'Test',bio:'',avatar:false,notifications:'all',call_camera:0,call_noise_suppression:1,call_echo_cancellation:1,reduce_motion:0}};
   else if(req.url==='/api/calls'){
    if(p.action==='config')out={iceServers:[],relayConfigured:true};
    if(p.action==='get')out={call,me:who};
    if(p.action==='offer'){call.offer=p.sdp;call.state='ringing';}
    if(p.action==='answer'){call.answer=p.sdp;call.state='active';}
    if(p.action==='end')call.state='ended';
   }else{
    const info={me:who,room:{mode:'audio',kind:'voice',chat_name:'Test'},participants:[...participants].map(user=>({user,name:user})),ice:{iceServers:[]}};
    if(p.action==='info')out=info;
    if(p.action==='join'){participants.add(who);out=info;}
    if(p.action==='poll'){out={participants:[...participants].map(user=>({user,name:user})),signals:signals[who].splice(0)};}
    if(p.action==='signal')signals[p.recipient].push({sender:who,type:p.type,payload:p.payload});
    if(p.action==='leave')participants.delete(who);
   }
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(out));return;
  }
  if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  res.setHeader('Content-Type','text/html');const css=['app/themes.css','app/social.css','app/globals.css','app/call-v2.css'].map(p=>readFileSync(p,'utf8')).join('\n');res.end('<html data-luma="dark"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;font-family:Arial,sans-serif}button{font:inherit}'+css+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const checks=[];
 for(const kind of ['private','group']){
  const a=await open('a',kind,base),b=await open('b',kind,base);
  await until(()=>run(a,"!!document.querySelector('button:not(:disabled)')"),'loaded');
  if(kind==='private'){await until(()=>run(a,"!!document.querySelector('.call-start:not(:disabled)')"),'caller ready');await click(a,'Démarrer');await until(()=>call.state==='ringing','offer');await until(()=>run(b,"!!document.querySelector('.call-start:not(:disabled)')"),'callee ready');await click(b,'Accepter');}
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
  for(const w of [a,b]){
   assert.equal(await run(w,"window.__captures.find(c=>c.audio)?.audio.deviceId?.ideal"),'default',kind+' saved microphone applied');
   assert.equal(await run(w,"window.__outputs.includes('test-headphones')"),true,kind+' saved output applied');
  }
  checks.push(kind+' saved microphone and output applied');
  await click(a,'Caméra');
  await until(()=>run(b,"[...document.querySelectorAll('video')].some(v=>v.videoWidth>0)"),kind+' camera enabled after audio join');
  checks.push(kind+' camera enabled mid-call');
  assert.equal(await run(a,'document.documentElement.scrollWidth<=innerWidth'),true,kind+' mobile horizontal overflow');
  writeFileSync(path.join(dir,kind+'-mobile.png'),(await a.webContents.capturePage()).toPNG());
  await click(a,kind==='private'?'Partager l’écran':'Écran');
  await until(()=>run(a,"[...document.querySelectorAll('button')].some(b=>!b.disabled&&(b.textContent==='Arrêter le partage'||b.textContent==='Arrêter'))"),kind+' sharing');
  await click(a,kind==='private'?'Arrêter le partage':'Arrêter');
  await until(()=>run(a,"[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Caméra')&&!b.disabled)"),kind+' camera restored');
  checks.push(kind+' share/restore');
  // Refusing camera access must not trigger a second permission/capture request.
  await run(a,"window.__capture=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);window.__cameraRequests=0;navigator.mediaDevices.getUserMedia=()=>{window.__cameraRequests++;return Promise.reject(new DOMException('Permission denied','NotAllowedError'));}");
  await click(a,'Retourner');
  await until(()=>run(a,"!!document.querySelector('[role=alert]')&&!document.querySelector('.call-controls button:disabled,.room-page footer button:disabled')"),kind+' permission denied');
  assert.equal(await run(a,'window.__cameraRequests'),1,kind+' repeated camera permission request');
  await run(a,'navigator.mediaDevices.getUserMedia=window.__capture');
  checks.push(kind+' camera refusal without duplicate request');
  // A device request can resolve after hangup; its stream must be stopped.
  await run(a,"navigator.mediaDevices.getUserMedia=async constraints=>{const stream=await window.__capture(constraints);if(constraints.video&&!constraints.audio){window.__lateCamera=stream;return new Promise(resolve=>{window.__finishCamera=()=>resolve(stream);});}return stream;}");
  await click(a,'Retourner');
  await until(()=>run(a,'!!window.__finishCamera'),kind+' pending camera');
  await click(a,kind==='private'?'Raccrocher':'Quitter');
  await run(a,'window.__finishCamera()');
  await until(()=>run(a,"window.__lateCamera.getTracks().every(t=>t.readyState==='ended')"),kind+' late camera released');
  checks.push(kind+' camera released after hangup during capture');
  if(kind==='group')await click(b,'Quitter');
  a.destroy();b.destroy();participants.clear();
 }
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



