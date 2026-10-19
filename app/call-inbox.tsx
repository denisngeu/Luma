'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {ClientRequestError,requestJson} from '@/lib/client-request';
import {isAppVisible,watchAppVisibility} from '@/lib/app-visibility';

type IncomingCall={id:string;name:string;mode:string;state:string};
type NativeWindow=Window&{ReactNativeWebView?:{postMessage:(message:string)=>void};lumaDesktop?:{flashTaskbar?:()=>void}};

export default function CallInbox(){
 const pathname=usePathname();
 const eligible=['/fil','/messages','/amis','/communities','/parametres','/mes-donnees','/apparence','/native'].some(path=>pathname===path||pathname.startsWith(path+'/'));
 const [incoming,setIncoming]=useState<IncomingCall|null>(null);
 const [declining,setDeclining]=useState('');
 const [failure,setFailure]=useState<{id:string;message:string}|null>(null);
 const [ringBlocked,setRingBlocked]=useState(false);
 const declineRequest=useRef<AbortController|null>(null),unlockRing=useRef<(()=>void)|null>(null);
 const dismissed=useRef(new Set<string>());
 const call=eligible?incoming:null,incomingId=call?.id||null;

 useEffect(()=>{
  if(!eligible)return;
  let live=true,pending=false,lastConfirmed=Date.now();const controller=new AbortController();
  const poll=async()=>{
   if(pending||!live)return;
   if(!isAppVisible()&&!(window as NativeWindow).lumaDesktop){setIncoming(null);return;}
   pending=true;
   try{
    const data=await requestJson<{calls:IncomingCall[]}>('/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'incoming'}),cache:'no-store',signal:controller.signal});
    if(!Array.isArray(data.calls))throw Error('Appels illisibles');
    const next=data.calls.find(item=>item&&typeof item.id==='string'&&typeof item.name==='string'&&!dismissed.current.has(item.id)&&['preparing','ringing'].includes(item.state))||null;
    if(live){lastConfirmed=Date.now();setIncoming(next);}
   }catch(error){
    if(live&&(Date.now()-lastConfirmed>15000||error instanceof ClientRequestError&&[401,403,404].includes(error.status)))setIncoming(null);
   }finally{pending=false;}
  };
  void poll();const timer=setInterval(()=>void poll(),3500),unwatch=watchAppVisibility(()=>void poll());
  return()=>{live=false;controller.abort();clearInterval(timer);unwatch();};
 },[eligible,pathname]);

 useEffect(()=>{
  let live=true;queueMicrotask(()=>{if(live){if(!eligible)setIncoming(null);setDeclining('');}});
  declineRequest.current?.abort();declineRequest.current=null;
  return()=>{live=false;declineRequest.current?.abort();};
 },[eligible,pathname]);

 useEffect(()=>{
  const native=(window as NativeWindow).ReactNativeWebView;
  native?.postMessage(JSON.stringify({type:'incoming-call',id:incomingId}));
  return()=>native?.postMessage(JSON.stringify({type:'incoming-call',id:null}));
 },[incomingId]);

 useEffect(()=>{
  if(!incomingId)return;
  try{(window as NativeWindow).lumaDesktop?.flashTaskbar?.();}catch{}
  let notification:Notification|undefined;
  if(!(window as NativeWindow).ReactNativeWebView&&typeof Notification!=='undefined'&&Notification.permission==='granted'){
   try{notification=new Notification(incoming?.name||'Luma',{body:`Appel ${incoming?.mode==='video'?'vidéo':'vocal'} entrant`,icon:'/icons/icon-192.png',tag:'luma-call-'+incomingId});notification.onclick=()=>window.focus();}catch{}
  }
  return()=>notification?.close();
  // Updates of the same call must not recreate notifications every poll.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[incomingId]);

 useEffect(()=>{
  if(!incomingId||(window as NativeWindow).ReactNativeWebView)return;
  let context:AudioContext|undefined,stopped=false,resuming=false;
  const ring=async()=>{
   if(stopped||resuming)return;
   try{
    context||=new AudioContext();
    if(context.state!=='running'){
     setRingBlocked(true);resuming=true;await context.resume();resuming=false;
    }
    if(stopped||context.state!=='running')return;
    setRingBlocked(false);const now=context.currentTime;
    [0,.22].forEach(offset=>{const oscillator=context!.createOscillator(),gain=context!.createGain();oscillator.frequency.value=offset?660:523;gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(.14,now+offset+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.18);oscillator.connect(gain).connect(context!.destination);oscillator.start(now+offset);oscillator.stop(now+offset+.2);});
   }catch{resuming=false;if(!stopped)setRingBlocked(true);}
  };
  const unlock=()=>{if(!context)return;const waiting=resuming;void context.resume().then(()=>{if(!stopped){setRingBlocked(false);if(!waiting)void ring();}}).catch(()=>{});};
  unlockRing.current=unlock;
  void ring();const timer=window.setInterval(()=>void ring(),2200);
  return()=>{stopped=true;clearInterval(timer);if(unlockRing.current===unlock)unlockRing.current=null;void context?.close().catch(()=>{});};
 },[incomingId]);

 async function decline(){
  if(!call||declineRequest.current)return;
  const controller=new AbortController(),id=call.id;declineRequest.current=controller;setDeclining(id);setFailure(null);
  try{
   await requestJson('/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end',id}),signal:controller.signal});
   if(!controller.signal.aborted){dismissed.current.add(id);setIncoming(current=>current?.id===id?null:current);}
  }catch(error){
   if(!controller.signal.aborted){
    if(error instanceof ClientRequestError&&error.status===404){dismissed.current.add(id);setIncoming(current=>current?.id===id?null:current);}
    else setFailure({id,message:'Impossible de refuser cet appel. Vérifiez votre connexion puis réessayez.'});
   }
  }finally{if(declineRequest.current===controller){declineRequest.current=null;setDeclining('');}}
 }

 if(!call)return null;
 return <aside className="call-inbox" role="alert" aria-label="Appel entrant"><div className="call-pulse"/><div><strong>{call.name}</strong><span>Appel {call.mode==='video'?'vidéo':'vocal'} entrant{call.state==='preparing'?' · connexion en cours':''}</span></div><Link href={'/appel/'+encodeURIComponent(call.id)} aria-disabled={declining===call.id} onClick={event=>{if(declining===call.id)event.preventDefault();}}>Répondre</Link><button type="button" disabled={declining===call.id} onClick={()=>void decline()}>{declining===call.id?'Refus en cours…':'Refuser'}</button>{ringBlocked&&<button type="button" onClick={()=>unlockRing.current?.()}>Activer la sonnerie</button>}{failure?.id===call.id&&<p className="call-inbox-error">{failure.message}</p>}</aside>;
}
