'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Bell,Camera,Mic2,Accessibility,Save,UserRound,Headphones,Activity} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import CallNetworkCheck from './call-network-check';
import {getUserMediaWithTimeout,mediaError} from '@/lib/call-media';
import {requestNativeMediaPermissions} from '@/lib/native-permissions';
import {ClientRequestError,requestJson} from '@/lib/client-request';
type Settings={name:string;bio:string;avatar:boolean;notifications:string;call_camera:number;call_noise_suppression:number;call_echo_cancellation:number;reduce_motion:number};
function storePreferences(settings:Settings){
 document.documentElement.setAttribute('data-motion',settings.reduce_motion?'reduced':'full');
 localStorage.setItem('luma-call-preferences',JSON.stringify({camera:!!settings.call_camera,noiseSuppression:!!settings.call_noise_suppression,echoCancellation:!!settings.call_echo_cancellation}));
 localStorage.setItem('luma-reduce-motion',settings.reduce_motion?'1':'0');
}
export default function UserPreferences(){const [data,setData]=useState<Settings|null>(null),[name,setName]=useState(''),[bio,setBio]=useState(''),[avatar,setAvatar]=useState<File|null>(null),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[error,setError]=useState(''),[inputs,setInputs]=useState<MediaDeviceInfo[]>([]),[outputs,setOutputs]=useState<MediaDeviceInfo[]>([]),[inputId,setInputId]=useState(''),[outputId,setOutputId]=useState(''),[micLevel,setMicLevel]=useState(0),[testingMic,setTestingMic]=useState(false);
 const micTest=useRef<{stream:MediaStream|null;context:AudioContext|null}|null>(null);
 const mounted=useRef(false),saveLock=useRef(false),loadingRequest=useRef<AbortController|null>(null),savingRequest=useRef<AbortController|null>(null),confirmed=useRef<Settings|null>(null);
 const [loading,setLoading]=useState(true),[expired,setExpired]=useState(false),[avatarVersion,setAvatarVersion]=useState(0);
 const [outputSupported,setOutputSupported]=useState(false);
 const loadProfile=useCallback(async()=>{
  loadingRequest.current?.abort();const controller=new AbortController();loadingRequest.current=controller;
  setLoading(true);setError('');setExpired(false);
  try{
   const response=await requestJson<{profile:Settings}>('/api/profile',{cache:'no-store',signal:controller.signal});
   const profile=response?.profile;
   if(!profile||typeof profile.name!=='string'||typeof profile.bio!=='string'||!['all','mentions','none'].includes(profile.notifications)||!(['call_camera','call_noise_suppression','call_echo_cancellation','reduce_motion'] as const).every(key=>[0,1,false,true].includes(profile[key])))throw Error('Profil reçu incomplet. Réessayez le chargement.');
   if(controller.signal.aborted)return;
   confirmed.current=profile;setData(profile);setName(profile.name);setBio(profile.bio);
   try{storePreferences(profile);}catch{/* Account preferences remain usable when device storage is unavailable. */}
  }catch(e){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Impossible de charger votre profil.');setExpired(e instanceof ClientRequestError&&e.status===401);}}
  finally{if(!controller.signal.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{
  mounted.current=true;queueMicrotask(()=>{if(mounted.current)void loadProfile();});
  queueMicrotask(()=>{if(!mounted.current)return;setOutputSupported(typeof HTMLMediaElement.prototype.setSinkId==='function');try{const saved=JSON.parse(localStorage.getItem('luma-media-devices')||'{}');setInputId(typeof saved.input==='string'?saved.input:'');setOutputId(typeof saved.output==='string'?saved.output:'');}catch{}});
  if(navigator.mediaDevices?.enumerateDevices)void navigator.mediaDevices.enumerateDevices().then(list=>{if(mounted.current){setInputs(list.filter(device=>device.kind==='audioinput'));setOutputs(list.filter(device=>device.kind==='audiooutput'));}}).catch(()=>{});
  return()=>{mounted.current=false;loadingRequest.current?.abort();savingRequest.current?.abort();const test=micTest.current;micTest.current=null;test?.stream?.getTracks().forEach(track=>track.stop());void test?.context?.close().catch(()=>{});};
 },[loadProfile]);
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview);},[preview]);
 function beginSave(){if(saveLock.current)return null;saveLock.current=true;const controller=new AbortController();savingRequest.current=controller;setBusy(true);setError('');setNotice('');return controller;}
 function finishSave(controller:AbortController){saveLock.current=false;if(savingRequest.current===controller)savingRequest.current=null;if(mounted.current)setBusy(false);}
 function saveError(e:unknown,controller:AbortController){if(!controller.signal.aborted){setError(e instanceof Error?e.message:'Enregistrement impossible. Réessayez.');if(e instanceof ClientRequestError&&e.status===401)setExpired(true);}}
 async function saveProfile(e:React.FormEvent){
  e.preventDefault();const controller=beginSave();if(!controller)return;
  const savedName=name.trim(),savedBio=bio.trim();
  try{
   const form=new FormData();form.set('name',savedName);form.set('bio',savedBio);if(avatar)form.set('avatar',avatar);
   const response=await requestJson<{ok:boolean;avatar:boolean}>('/api/profile',{method:'POST',body:form,signal:controller.signal},120000);
   if(!response?.ok)throw Error('Le serveur n’a pas confirmé l’enregistrement. Réessayez.');
   if(controller.signal.aborted)return;
   setData(current=>current?{...current,name:savedName,bio:savedBio,avatar:response.avatar}:current);
   setName(savedName);setBio(savedBio);setAvatar(null);setPreview('');setAvatarVersion(Date.now());setNotice('Profil enregistré.');
  }catch(e){saveError(e,controller);}finally{finishSave(controller);}
 }
 async function savePrefs(next=data){
  if(!next)return;const controller=beginSave();if(!controller)return;
  try{
   const response=await requestJson<{ok:boolean}>('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({notifications:next.notifications,callCamera:!!next.call_camera,noiseSuppression:!!next.call_noise_suppression,echoCancellation:!!next.call_echo_cancellation,reduceMotion:!!next.reduce_motion}),signal:controller.signal});
   if(!response?.ok)throw Error('Le serveur n’a pas confirmé les préférences. Réessayez.');
   if(controller.signal.aborted)return;
   confirmed.current=next;
   try{storePreferences(next);setNotice('Préférences enregistrées.');}
   catch{setNotice('Préférences enregistrées dans votre compte. Le stockage local de cet appareil est indisponible.');}
  }catch(e){
   if(!controller.signal.aborted&&confirmed.current){const previous=confirmed.current;setData(current=>current?{...current,notifications:previous.notifications,call_camera:previous.call_camera,call_noise_suppression:previous.call_noise_suppression,call_echo_cancellation:previous.call_echo_cancellation,reduce_motion:previous.reduce_motion}:current);}
   saveError(e,controller);
  }finally{finishSave(controller);}
 }
 function toggle(key:keyof Settings,checked:boolean,save=true){if(!data||saveLock.current)return;setError('');setNotice('');const next={...data,[key]:checked?1:0};setData(next);if(save)void savePrefs(next);}
 function rememberDevices(input=inputId,output=outputId){setError('');setNotice('');try{localStorage.setItem('luma-media-devices',JSON.stringify({input,output}));setNotice('Périphériques enregistrés sur cet appareil.');}catch{setError('Impossible d’enregistrer les périphériques sur cet appareil. Autorisez le stockage local puis réessayez.');}}
 function chooseAvatar(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file||saveLock.current)return;
  setError('');setNotice('');
  if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){setError('Choisissez une image JPG, PNG, WebP ou AVIF de 5 Mo maximum.');return;}
  setAvatar(file);setPreview(URL.createObjectURL(file));
 }
 async function testMicrophone(){
  if(micTest.current)return;
  const test:{stream:MediaStream|null;context:AudioContext|null}={stream:null,context:null};micTest.current=test;
  setTestingMic(true);setError('');setNotice('');setMicLevel(0);
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Le microphone nécessite une connexion HTTPS et un navigateur compatible.');
   await requestNativeMediaPermissions();if(micTest.current!==test)return;
   test.stream=await getUserMediaWithTimeout({audio:{deviceId:inputId?{exact:inputId}:undefined,noiseSuppression:!!data?.call_noise_suppression,echoCancellation:!!data?.call_echo_cancellation},video:false});
   if(micTest.current!==test)return;
   const list=await navigator.mediaDevices.enumerateDevices();if(micTest.current!==test)return;
   setInputs(list.filter(device=>device.kind==='audioinput'));setOutputs(list.filter(device=>device.kind==='audiooutput'));
   const context=new AudioContext();test.context=context;await context.resume();if(micTest.current!==test)return;
   const analyser=context.createAnalyser();analyser.fftSize=256;context.createMediaStreamSource(test.stream).connect(analyser);
   const values=new Uint8Array(analyser.frequencyBinCount),started=Date.now();
   await new Promise<void>(resolve=>{const sample=()=>{if(micTest.current!==test){resolve();return;}analyser.getByteFrequencyData(values);setMicLevel(Math.min(100,Math.round(values.reduce((sum,value)=>sum+value,0)/values.length*1.8)));if(Date.now()-started<3500)requestAnimationFrame(sample);else resolve();};sample();});
   if(micTest.current===test)setNotice('Test du microphone terminé.');
  }catch(e){if(micTest.current===test)setError(mediaError(e));}
  finally{
   test.stream?.getTracks().forEach(track=>track.stop());if(test.context&&test.context.state!=='closed')await test.context.close().catch(()=>{});
   if(micTest.current===test){micTest.current=null;setTestingMic(false);setMicLevel(0);}
  }
 }
 if(!data)return <section className="settings-section" aria-busy={loading}>{error?<p className="privacy-error" role="alert">{error}</p>:<p role="status">Chargement de vos préférences…</p>}{expired?<a href="/connexion?returnTo=%2Fparametres">Se reconnecter</a>:!loading&&<button onClick={()=>void loadProfile()}>Réessayer le chargement</button>}</section>;
 return <>{(error||notice)&&<div className="settings-feedback">{error&&<p className="privacy-error" role="alert">{error}{expired&&<> <a href="/connexion?returnTo=%2Fparametres">Se reconnecter</a></>}</p>}{notice&&<p className="privacy-success" role="status">{notice}</p>}</div>}<section className="settings-section" id="profil"><div className="settings-heading"><UserRound/><div><h2>Profil public</h2><p>Votre identité visible par vos amis et dans vos communautés.</p></div></div><form className="settings-profile" onSubmit={saveProfile}><label className="settings-avatar"><input type="file" disabled={busy} accept="image/jpeg,image/png,image/webp,image/avif" onChange={chooseAvatar}/><span>{preview?<img src={preview} alt="Nouvelle photo"/>:data.avatar?<img src={'/api/profile?avatar=1&v='+avatarVersion} alt="Votre photo"/>:<Camera/>}</span><strong>Changer la photo</strong></label><label>Pseudo<input disabled={busy} required minLength={2} maxLength={60} value={name} onChange={e=>setName(e.target.value)}/></label><label>Présentation<textarea disabled={busy} maxLength={280} value={bio} onChange={e=>setBio(e.target.value)}/></label><button disabled={busy}><Save/>Enregistrer le profil</button></form></section><section className="settings-section" id="notifications"><div className="settings-heading"><Bell/><div><h2>Notifications</h2><p>Choisissez quand Luma doit attirer votre attention.</p></div></div><label className="settings-choice">Alertes<select value={data.notifications} disabled={busy} onChange={e=>{if(saveLock.current)return;const next={...data,notifications:e.target.value};setData(next);void savePrefs(next);}}><option value="all">Tous les nouveaux messages</option><option value="mentions">Mentions et appels uniquement</option><option value="none">Aucune alerte</option></select></label></section><section className="settings-section" id="appels"><div className="settings-heading"><Mic2/><div><h2>Appels et salons vocaux</h2><p>Paramétrez vos périphériques, les autorisations et les filtres audio.</p></div></div><div className="settings-devices"><label><span><Mic2/>Périphérique d’entrée</span><select value={inputId} onChange={e=>{setInputId(e.target.value);rememberDevices(e.target.value,outputId);}}><option value="">Microphone par défaut</option>{inputs.map((device,index)=><option value={device.deviceId} key={device.deviceId}>{device.label||`Microphone ${index+1}`}</option>)}</select></label><label><span><Headphones/>Périphérique de sortie</span><select disabled={!outputSupported} title={!outputSupported?"La sortie audio se règle depuis votre appareil.":undefined} value={outputId} onChange={e=>{setOutputId(e.target.value);rememberDevices(inputId,e.target.value);}}><option value="">Sortie audio par défaut</option>{outputs.map((device,index)=><option value={device.deviceId} key={device.deviceId}>{device.label||`Sortie audio ${index+1}`}</option>)}</select></label><div className="microphone-test"><span><Activity/>Niveau de détection</span><div><i style={{width:`${micLevel}%`}}/></div><button type="button" disabled={testingMic} onClick={()=>void testMicrophone()}>{testingMic?'Test en cours…':'Tester le microphone'}</button></div></div><CallNetworkCheck/><div className="settings-signal"><h3>Traitements intelligents du signal</h3><label className="settings-switch"><span>Démarrer la caméra pendant les appels vidéo<small>Vous pourrez toujours la couper avant de rejoindre.</small></span><Switch disabled={busy} checked={!!data.call_camera} onCheckedChange={checked=>toggle('call_camera',checked)} aria-label="Démarrer la caméra pendant les appels vidéo"/></label><label className="settings-switch"><span>Réduction du bruit<small>Réduit les sons continus captés par le micro.</small></span><Switch disabled={busy} checked={!!data.call_noise_suppression} onCheckedChange={checked=>toggle('call_noise_suppression',checked)} aria-label="Activer la réduction du bruit"/></label><label className="settings-switch"><span>Suppression de l’écho<small>Recommandé quand vous utilisez les haut-parleurs.</small></span><Switch disabled={busy} checked={!!data.call_echo_cancellation} onCheckedChange={checked=>toggle('call_echo_cancellation',checked)} aria-label="Activer la suppression echo"/></label></div></section><section className="settings-section"><div className="settings-heading"><Accessibility/><div><h2>Accessibilité</h2><p>Adaptez les animations à votre confort.</p></div></div><label className="settings-switch"><span>Réduire les animations<small>Diminue les transitions et mouvements de l’interface.</small></span><Switch disabled={busy} checked={!!data.reduce_motion} onCheckedChange={checked=>toggle('reduce_motion',checked,false)} aria-label="Réduire les animations"/></label><button disabled={busy} onClick={()=>void savePrefs()}><Save/>Enregistrer les préférences</button></section></>}
