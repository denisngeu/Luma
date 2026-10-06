'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {ArrowLeft,Camera,CameraOff,Maximize2,Mic,MicOff,Minimize2,MonitorUp,Music2,PhoneOff,SwitchCamera,Users,Volume2} from 'lucide-react';
import {gatherIce,mediaError,screenSharingSupported,screenSharingUnavailable} from '@/lib/call-media';
import {Switch} from '@/components/ui/switch';
import {requestNativeMediaPermissions} from '@/lib/native-permissions';

type Person={user:string;name:string};
type Signal={sender:string;type:'offer'|'answer';payload:string};
type Info={me:string;room:{mode:string;kind:string;chat_name:string};participants:Person[];ice:RTCConfiguration};
async function request(action:string,data:Record<string,unknown>={}){
 const r=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data}),cache:'no-store'});
 const d=await r.json() as Info & {error?:string;signals:Signal[]};if(!r.ok)throw Error(d.error||'Salon indisponible');return d;
}
export default function Room({id}:{id:string}){
 const [info,setInfo]=useState<Info|null>(null),[people,setPeople]=useState<Person[]>([]),[joined,setJoined]=useState(false),[busy,setBusy]=useState(false),[muted,setMuted]=useState(false),[camera,setCamera]=useState(false),[sharing,setSharing]=useState(false),[error,setError]=useState(''),[joinMuted,setJoinMuted]=useState(false),[joinCamera,setJoinCamera]=useState(false),[noiseSuppression,setNoiseSuppression]=useState(true),[echoCancellation,setEchoCancellation]=useState(true),[canShare]=useState(screenSharingSupported),[streams,setStreams]=useState<Record<string,MediaStream>>({}),[facing,setFacing]=useState<'user'|'environment'>('user'),[expanded,setExpanded]=useState<string|null>(null);
 const local=useRef<MediaStream|null>(null),screen=useRef<MediaStream|null>(null),pcs=useRef(new Map<string,RTCPeerConnection>()),videoSenders=useRef(new Map<string,RTCRtpSender>()),timer=useRef<ReturnType<typeof setInterval>|null>(null),active=useRef(false),epoch=useRef(0),lock=useRef(false),soundContext=useRef<AudioContext|null>(null),soundTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 function dispose(){
  active.current=false;epoch.current++;if(soundTimer.current)clearTimeout(soundTimer.current);void soundContext.current?.close();soundContext.current=null;if(timer.current)clearInterval(timer.current);timer.current=null;
  pcs.current.forEach(pc=>{pc.onconnectionstatechange=null;pc.close();});pcs.current.clear();videoSenders.current.clear();
  screen.current?.getTracks().forEach(t=>{t.onended=null;t.stop();});screen.current=null;
  local.current?.getTracks().forEach(t=>t.stop());local.current=null;
 }
 useEffect(()=>{
  let live=true;
  queueMicrotask(()=>{if(!live)return;try{const p=JSON.parse(localStorage.getItem('luma-call-preferences')||'{}');setJoinCamera(!!p.camera);setNoiseSuppression(p.noiseSuppression!==false);setEchoCancellation(p.echoCancellation!==false);}catch{}});
  request('info',{id}).then(d=>{if(live){setInfo(d);setPeople(d.participants);}}).catch(e=>{if(live)setError(e.message);});
  const resume=()=>{if(active.current)void request('poll',{id}).catch(()=>{});};
  window.addEventListener('luma-native-active',resume);window.addEventListener('online',resume);
  return()=>{live=false;if(active.current)navigator.sendBeacon('/api/rooms',new Blob([JSON.stringify({action:'leave',id})],{type:'application/json'}));dispose();window.removeEventListener('luma-native-active',resume);window.removeEventListener('online',resume);};
 },[id]);
 async function send(uid:string,type:'offer'|'answer',pc:RTCPeerConnection,generation:number){
  await gatherIce(pc);if(epoch.current!==generation||!active.current)return;
  await request('signal',{id,recipient:uid,type,payload:JSON.stringify(pc.localDescription)});
 }
 function makePeer(uid:string,ice:RTCConfiguration,answering=false){
  const pc=new RTCPeerConnection(ice);pcs.current.set(uid,pc);
  const received=new MediaStream();
  pc.ontrack=e=>{
   if(!received.getTrackById(e.track.id))received.addTrack(e.track);
   setStreams(s=>({...s,[uid]:new MediaStream(received.getTracks())}));
  };
  pc.onconnectionstatechange=()=>{
   if(pc.connectionState==='failed')setError('Connexion avec un participant impossible. Vérifiez votre réseau puis quittez et rejoignez le salon.');
   if(pc.connectionState==='connected')setError('');
  };
  if(!answering){
   pc.addTransceiver(local.current!.getAudioTracks()[0],{direction:'sendrecv',streams:[local.current!]});
   videoSenders.current.set(uid,pc.addTransceiver(screen.current?.getVideoTracks()[0]||local.current!.getVideoTracks()[0]||'video',{direction:'sendrecv',streams:[local.current!]}).sender);
  }
  return pc;
 }
 async function attachAnswerTracks(uid:string,pc:RTCPeerConnection){
  for(const trans of pc.getTransceivers()){
   trans.direction='sendrecv';
   if(trans.receiver.track.kind==='audio')await trans.sender.replaceTrack(local.current!.getAudioTracks()[0]);
   else{videoSenders.current.set(uid,trans.sender);await trans.sender.replaceTrack(screen.current?.getVideoTracks()[0]||local.current?.getVideoTracks()[0]||null);}
  }
 }
 async function join(){
  if(lock.current||active.current)return;lock.current=true;setBusy(true);setError('');const generation=epoch.current;let registered=false;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Micro indisponible. Ouvrez Luma en HTTPS et autorisez son utilisation.');
    await requestNativeMediaPermissions(joinCamera);
    const stream=await navigator.mediaDevices.getUserMedia({audio:{noiseSuppression,echoCancellation},video:joinCamera?{width:{ideal:1280},height:{ideal:720},facingMode:{ideal:facing}}:false});
   if(epoch.current!==generation){stream.getTracks().forEach(t=>t.stop());return;}local.current=stream;
   stream.getAudioTracks().forEach(t=>t.enabled=!joinMuted);
   const d=await request('join',{id}) as Info;registered=true;
   if(epoch.current!==generation){await request('leave',{id});return;}
   active.current=true;setInfo(d);setMuted(joinMuted);setCamera(stream.getVideoTracks().length>0);setJoined(true);
   setStreams({[d.me]:stream});setPeople([{user:d.me,name:'Vous'}]);let polling=false;
   const poll=async()=>{
    if(polling||!active.current)return;polling=true;
    try{
     const update=await request('poll',{id}) as {participants:Person[];signals:Signal[]};
     if(epoch.current!==generation)return;setPeople(update.participants);
     const present=new Set(update.participants.map(p=>p.user));
     for(const [uid,pc] of pcs.current)if(!present.has(uid)){pc.close();pcs.current.delete(uid);videoSenders.current.delete(uid);setStreams(s=>{const next={...s};delete next[uid];return next;});}
     for(const signal of update.signals){
      if(!present.has(signal.sender))continue;
      let pc=pcs.current.get(signal.sender);
      if(signal.type==='offer'){
       if(pc){pc.close();pcs.current.delete(signal.sender);}
       pc=makePeer(signal.sender,d.ice,true);
       await pc.setRemoteDescription(JSON.parse(signal.payload));
       await attachAnswerTracks(signal.sender,pc);
       await pc.setLocalDescription(await pc.createAnswer());await send(signal.sender,'answer',pc,generation);
      }else if(pc?.signalingState==='have-local-offer')await pc.setRemoteDescription(JSON.parse(signal.payload));
     }
     for(const person of update.participants)if(person.user!==d.me&&!pcs.current.has(person.user)&&d.me.localeCompare(person.user)<0){
      const pc=makePeer(person.user,d.ice);
      await pc.setLocalDescription(await pc.createOffer());await send(person.user,'offer',pc,generation);
     }
    }catch(e){if(epoch.current===generation)setError(mediaError(e));}finally{polling=false;}
   };
   void poll();timer.current=setInterval(poll,1000);
  }catch(e){dispose();setJoined(false);if(registered)await request('leave',{id}).catch(()=>{});setError(mediaError(e));}
  finally{lock.current=false;setBusy(false);}
 }
 async function replaceVideo(track:MediaStreamTrack|null){await Promise.all([...videoSenders.current.values()].map(sender=>sender.replaceTrack(track)));}
 async function captureCamera(nextFacing=facing){await requestNativeMediaPermissions(true);try{return await navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:{exact:nextFacing}},audio:false});}catch{return navigator.mediaDevices.getUserMedia({video:{width:{ideal:1280},height:{ideal:720},facingMode:{ideal:nextFacing}},audio:false});}}
 async function installCamera(stream:MediaStream,nextFacing=facing){const track=stream.getVideoTracks()[0];if(!track)throw Error('Aucune caméra disponible.');const previous=local.current?.getVideoTracks()[0];await replaceVideo(track);if(previous){local.current?.removeTrack(previous);previous.stop();}local.current?.addTrack(track);setFacing(nextFacing);setCamera(true);if(info)setStreams(s=>({...s,[info.me]:new MediaStream(local.current!.getTracks())}));}
 async function toggleVideo(){
  if(lock.current||sharing||!local.current)return;lock.current=true;setBusy(true);setError('');const generation=epoch.current;let captured:MediaStream|null=null;
  try{
   const existing=local.current.getVideoTracks()[0];
   if(existing){existing.enabled=!existing.enabled;setCamera(existing.enabled);return;}
    captured=await captureCamera();
   if(epoch.current!==generation){captured.getTracks().forEach(t=>t.stop());return;}
    await installCamera(captured);
  }catch(e){captured?.getTracks().forEach(t=>t.stop());await replaceVideo(local.current?.getVideoTracks()[0]||null).catch(()=>{});setError(mediaError(e));}
  finally{lock.current=false;setBusy(false);}
 }
 async function switchCamera(){
  if(lock.current||sharing||!local.current)return;lock.current=true;setBusy(true);setError('');const generation=epoch.current,next=facing==='user'?'environment':'user';let captured:MediaStream|null=null;
  try{captured=await captureCamera(next);if(epoch.current!==generation){captured.getTracks().forEach(t=>t.stop());return;}await installCamera(captured,next);}catch(e){captured?.getTracks().forEach(t=>t.stop());setError(mediaError(e));}finally{lock.current=false;setBusy(false);}
 }
 async function stopSharing(){
  const stream=screen.current;screen.current=null;stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});
  await replaceVideo(local.current?.getVideoTracks()[0]||null);setSharing(false);
  if(local.current&&info)setStreams(s=>({...s,[info.me]:new MediaStream(local.current!.getTracks())}));
 }
 async function share(){
  if(lock.current)return;lock.current=true;setBusy(true);setError('');const generation=epoch.current;
  try{
   if(sharing){await stopSharing();return;}
   if(!screenSharingSupported())throw Error(screenSharingUnavailable);
   const stream=await navigator.mediaDevices.getDisplayMedia({video:true,audio:false});
   if(epoch.current!==generation){stream.getTracks().forEach(t=>t.stop());return;}
   screen.current=stream;const track=stream.getVideoTracks()[0];await replaceVideo(track);
   track.onended=()=>void stopSharing().catch(e=>setError(mediaError(e)));setSharing(true);
   setStreams(s=>({...s,[info!.me]:stream}));
  }catch(e){await stopSharing().catch(()=>{});setError(mediaError(e));}finally{lock.current=false;setBusy(false);}
 }

 async function sound(index:number){
  if(!local.current||soundContext.current)return;
  const generation=epoch.current,ctx=new AudioContext();soundContext.current=ctx;
  try{
   await ctx.resume();if(generation!==epoch.current||!local.current)return;
   const dest=ctx.createMediaStreamDestination();ctx.createMediaStreamSource(local.current).connect(dest);
   const restore=()=>{if(generation===epoch.current&&local.current)pcs.current.forEach(pc=>{const sender=pc.getSenders().find(s=>s.track?.kind==='audio');void sender?.replaceTrack(local.current!.getAudioTracks()[0]).catch(()=>{});});void ctx.close();if(soundContext.current===ctx)soundContext.current=null;};
   ctx.onstatechange=()=>{if(ctx.state==='suspended')restore();};
   await Promise.all([...pcs.current.values()].map(pc=>pc.getSenders().find(s=>s.track?.kind==='audio')?.replaceTrack(dest.stream.getAudioTracks()[0])));
   const presets=[[[523,.00,.42,'sine'],[659,.08,.42,'sine'],[784,.16,.55,'triangle']],[[880,.00,.16,'square'],[660,.18,.18,'square'],[880,.38,.22,'square']],[[196,.00,.38,'sawtooth'],[98,.12,.55,'sine']],[[392,.00,.24,'triangle'],[523,.16,.28,'triangle'],[659,.32,.32,'triangle'],[784,.48,.60,'sine']]] as const;
   let remaining=presets[index].length;presets[index].forEach(([hz,offset,duration,wave])=>{const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),at=ctx.currentTime+offset;osc.type=wave;osc.frequency.value=hz;filter.type='lowpass';filter.frequency.value=2400;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.13,at+.025);gain.gain.exponentialRampToValueAtTime(.0001,at+duration);osc.connect(filter).connect(gain).connect(dest);osc.start(at);osc.stop(at+duration+.03);osc.onended=()=>{remaining--;if(!remaining)restore();};});soundTimer.current=setTimeout(restore,2200);
  }catch(e){void ctx.close();soundContext.current=null;setError(mediaError(e));}
 }
 async function leave(){const wasActive=active.current;dispose();setJoined(false);setStreams({});setCamera(false);setSharing(false);if(wasActive)await request('leave',{id}).catch(()=>{});}
 return <main className="room-page"><header><Link href="/messages"><ArrowLeft/> Retour</Link><div><strong>{info?.room.chat_name||'Salon Luma'}</strong><span>{info?.room.kind==='voice'?'Salon vocal':'Appel de groupe'}</span></div><span><Users size={17}/>{people.length} participant{people.length!==1?'s':''}</span></header>
 {error&&<p className="room-error" role="alert">{error}</p>}
 <section className="room-stage">{!joined?<div className="room-lobby"><div><Users/></div><h1>Rejoignez la conversation</h1><p>Votre micro ne s’active qu’en rejoignant le salon.</p><section className="room-preflight">
 <label><Switch checked={joinMuted} onCheckedChange={setJoinMuted} aria-label="Micro coupé au démarrage"/>Micro coupé au démarrage</label>
 <label><Switch checked={joinCamera} onCheckedChange={setJoinCamera} aria-label="Activer ma caméra"/>Activer ma caméra</label>
 <label><Switch checked={noiseSuppression} onCheckedChange={setNoiseSuppression} aria-label="Réduire le bruit ambiant"/>Réduire le bruit ambiant</label>
 <label><Switch checked={echoCancellation} onCheckedChange={setEchoCancellation} aria-label="Éviter echo"/>Éviter l’écho</label></section>
 <button disabled={busy||!info} onClick={join}>{busy?'Connexion…':'Rejoindre le salon'}</button></div>:<div className="voice-live-stage"><section className="voice-topic"><span>● EN DIRECT</span><div><small>SUJET À L’AFFICHE</small><strong>{info?.room.chat_name||'Salon vocal'}</strong></div><b><Users size={13}/>{people.length} participant{people.length!==1?'s':''}</b></section><section className="voice-speakers"><header><h2>Sur scène</h2><span>{Math.min(people.length,4)} intervenant{Math.min(people.length,4)!==1?'s':''}</span><small>Audio HD</small></header><div>{people.slice(0,4).map(person=><article key={person.user} className={expanded===person.user?'is-expanded':''}><div className="room-avatar">{person.name.slice(0,2).toUpperCase()}</div><Remote stream={streams[person.user]} self={person.user===info?.me}/><b>{person.user===info?.me?(sharing?'Votre écran':'Vous'):person.name}</b><small>{person.user===info?.me?'Vous':'Intervenant'}</small><button className="call-expand" aria-label={expanded===person.user?'Réduire la vidéo':'Agrandir la vidéo ou le partage'} onClick={()=>setExpanded(expanded===person.user?null:person.user)}>{expanded===person.user?<Minimize2/>:<Maximize2/>}</button></article>)}</div></section>{people.length>4&&<section className="voice-audience"><header><h2>Dans l’audience</h2><span>{people.length-4} auditeur{people.length-4!==1?'s':''}</span></header><div>{people.slice(4).map(person=><article key={person.user}><div className="room-avatar">{person.name.slice(0,2).toUpperCase()}</div><Remote stream={streams[person.user]} self={person.user===info?.me}/><strong>{person.name}</strong><small>AUDITEUR</small></article>)}</div></section>}</div>}</section>
 {joined&&<><footer>
 <button className={muted?'off':''} onClick={()=>{local.current?.getAudioTracks().forEach(t=>t.enabled=muted);setMuted(!muted);}} aria-pressed={muted}>{muted?<MicOff/>:<Mic/>}<span>{muted?'Activer micro':'Micro'}</span></button>
 <button disabled={busy||sharing} className={!camera?'off':''} onClick={toggleVideo} aria-pressed={camera}>{camera?<Camera/>:<CameraOff/>}<span>Caméra</span></button>
 <button disabled={busy||sharing||!camera} onClick={switchCamera}><SwitchCamera/><span>Retourner</span></button>
 <button disabled={busy||!canShare} title={!canShare?screenSharingUnavailable:undefined} className={sharing?'active':''} onClick={share} aria-pressed={sharing}><MonitorUp/><span>{sharing?'Arrêter':'Écran'}</span></button>
 <button className="hangup" onClick={leave}><PhoneOff/><span>Quitter</span></button></footer>
 <details className="soundboard"><summary><Music2/> Soundboard HD</summary><div className="soundboard-grid">{[['✨','Halo'],['🔔','Double signal'],['💥','Impact'],['🏆','Victoire']].map(([emoji,name],i)=><button key={name} onClick={()=>void sound(i)}><span>{emoji}</span>{name}</button>)}</div></details>{!canShare&&<p className="room-capability">{screenSharingUnavailable}</p>}</>}
 </main>;
}
function Remote({stream,self=false}:{stream?:MediaStream;self?:boolean}){
 const ref=useRef<HTMLVideoElement>(null),audio=useRef<HTMLAudioElement>(null),[blocked,setBlocked]=useState(false);
 useEffect(()=>{
  const video=ref.current,speaker=audio.current;if(!video||!stream)return;
  const update=()=>{video.srcObject=new MediaStream(stream.getVideoTracks());void video.play().catch(()=>{});if(speaker&&!self){speaker.srcObject=new MediaStream(stream.getAudioTracks());void speaker.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true));}};
  update();stream.addEventListener('addtrack',update);
  return()=>{stream.removeEventListener('addtrack',update);video.srcObject=null;if(speaker)speaker.srcObject=null;};
 },[stream,self]);
 return <><audio ref={audio} autoPlay muted={self}/><video ref={ref} autoPlay playsInline muted/>{blocked&&<button className="call-audio-unlock" onClick={()=>void audio.current?.play().then(()=>setBlocked(false)).catch(()=>setBlocked(true))}><Volume2/>Activer le son</button>}</>;
}
