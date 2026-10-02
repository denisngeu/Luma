'use client';
import {useEffect,useRef,useState} from 'react';
import {usePathname} from 'next/navigation';
import Link from 'next/link';

type IncomingCall={id:string;name:string;mode:string;state:string};
type NativeWindow=Window&{ReactNativeWebView?:{postMessage:(message:string)=>void}};

export default function CallInbox(){
 const pathname=usePathname();
 const [incoming,setIncoming]=useState<IncomingCall|null>(null);
 const polling=useRef(false);
 const incomingId=incoming?.id||null;

 useEffect(()=>{
  const active=['/fil','/messages','/amis','/communities','/parametres','/mes-donnees','/apparence','/native'].some(path=>pathname.startsWith(path));
  if(!active)return;
  let live=true;
  const poll=async()=>{
   if(polling.current||location.pathname.startsWith('/appel/'))return;
   if(document.hidden){if(live)setIncoming(null);return;}
   polling.current=true;
   try{
    const response=await fetch('/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'incoming'}),cache:'no-store'});
    if(response.ok){const data=await response.json() as {calls:IncomingCall[]};if(live)setIncoming(data.calls[0]||null);}
   }catch{}finally{polling.current=false;}
  };
  const wake=()=>{if(!document.hidden)void poll();};
  void poll();const timer=setInterval(poll,3500);
  document.addEventListener('visibilitychange',wake);window.addEventListener('focus',wake);
  return()=>{live=false;clearInterval(timer);document.removeEventListener('visibilitychange',wake);window.removeEventListener('focus',wake);};
 },[pathname]);

 useEffect(()=>{
  const native=(window as NativeWindow).ReactNativeWebView;
  native?.postMessage(JSON.stringify({type:'incoming-call',id:incomingId}));
  return()=>native?.postMessage(JSON.stringify({type:'incoming-call',id:null}));
 },[incomingId]);

 useEffect(()=>{
  if(!incomingId)return;
  if((window as NativeWindow).ReactNativeWebView)return;
  let context:AudioContext|undefined,stopped=false;
  const ring=async()=>{try{context||=new AudioContext();await context.resume();const now=context.currentTime;[0,.22].forEach(offset=>{const oscillator=context!.createOscillator(),gain=context!.createGain();oscillator.frequency.value=offset?660:523;gain.gain.setValueAtTime(.0001,now+offset);gain.gain.exponentialRampToValueAtTime(.14,now+offset+.02);gain.gain.exponentialRampToValueAtTime(.0001,now+offset+.18);oscillator.connect(gain).connect(context!.destination);oscillator.start(now+offset);oscillator.stop(now+offset+.2);});}catch{}};
  void ring();const timer=window.setInterval(()=>{if(!stopped)void ring();},2200);
  return()=>{stopped=true;clearInterval(timer);void context?.close();};
 },[incomingId]);

 if(!incoming)return null;
 return <aside className="call-inbox" role="alert"><div className="call-pulse"/><div><strong>{incoming.name}</strong><span>Appel {incoming.mode==='video'?'vidéo':'vocal'} entrant{incoming.state==='preparing'?' · connexion en cours':''}</span></div><Link href={'/appel/'+incoming.id}>Répondre</Link><button onClick={async()=>{await fetch('/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'end',id:incoming.id})});setIncoming(null);}}>Refuser</button></aside>;
}
