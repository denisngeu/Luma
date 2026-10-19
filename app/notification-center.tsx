'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {Bell, Phone, RefreshCw, UserPlus, X} from 'lucide-react';
import {Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger} from '@/components/ui/dialog';
import {ClientRequestError, requestJson} from '@/lib/client-request';

type Item = {id:string; name:string; href:string; detail:string; kind:'friend'|'call'};
type Friends = {user:{id:string}; items:{id:string; name:string; recipient:string; state:string}[]};
type Calls = {calls:{id:string; name:string; mode:string}[]};

export default function NotificationCenter() {
  const [open,setOpen]=useState(false),[loading,setLoading]=useState(true),[items,setItems]=useState<Item[]>([]),[errors,setErrors]=useState<string[]>([]),[expired,setExpired]=useState(false);
  const pending=useRef<AbortController|null>(null);
  const searchAfterClose=useRef(false);
  const load=useCallback(async()=>{
    if(pending.current&&!pending.current.signal.aborted)return;
    const controller=new AbortController();pending.current=controller;
    setLoading(true);setErrors([]);setExpired(false);setItems([]);
    const post=(action:string)=>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action}),signal:controller.signal});
    const next:Item[]=[],failures:string[]=[];let unauthorized=false;
    const publish=()=>{if(!controller.signal.aborted&&!unauthorized){setItems([...next]);setErrors([...failures]);}};
    const failed=(error:unknown,message:string)=>{
      if(controller.signal.aborted||unauthorized)return;
      if(error instanceof ClientRequestError&&error.status===401){unauthorized=true;setExpired(true);setItems([]);setErrors(['Votre session a expiré. Reconnectez-vous pour consulter vos notifications.']);setLoading(false);}
      else{failures.push(message);publish();}
    };
    try {
      await Promise.allSettled([
        requestJson<Friends>('/api/friends',post('list')).then(friends=>{
          if(!Array.isArray(friends?.items)||typeof friends.user?.id!=='string')throw Error('Demandes illisibles');
          for(const friend of friends.items)if(friend&&friend.state==='pending'&&friend.recipient===friends.user.id&&typeof friend.id==='string'&&typeof friend.name==='string')next.push({id:'friend-'+friend.id,name:friend.name,href:'/amis#demandes',detail:'Vous a envoyé une demande d’ami',kind:'friend'});
          publish();
        }).catch(error=>failed(error,'Les demandes d’amis sont indisponibles. Réessayez.')),
        requestJson<Calls>('/api/calls',post('incoming')).then(calls=>{
          if(!Array.isArray(calls?.calls))throw Error('Appels illisibles');
          for(const call of calls.calls)if(call&&typeof call.id==='string'&&typeof call.name==='string')next.push({id:'call-'+call.id,name:call.name,href:'/appel/'+encodeURIComponent(call.id),detail:call.mode==='video'?'Appel vidéo entrant':'Appel vocal entrant',kind:'call'});
          publish();
        }).catch(error=>failed(error,'Les appels entrants sont indisponibles. Réessayez.')),
      ]);
    }finally{
      if(pending.current===controller)pending.current=null;
      if(!controller.signal.aborted)setLoading(false);
    }
  },[]);
  useEffect(()=>{
    if(!open)return;
    let live=true;queueMicrotask(()=>{if(live)void load();});
    const closeForSearch=()=>{searchAfterClose.current=true;setOpen(false);};window.addEventListener('luma-search-discussions',closeForSearch);
    return()=>{live=false;pending.current?.abort();pending.current=null;window.removeEventListener('luma-search-discussions',closeForSearch);};
  },[open,load]);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className="header-action-btn" title="Notifications" aria-label="Notifications"><Bell size={16}/></button></DialogTrigger>
    <DialogContent className="notification-center" showCloseButton={false} onCloseAutoFocus={event=>{
      if(searchAfterClose.current){
        event.preventDefault();searchAfterClose.current=false;
        queueMicrotask(()=>window.dispatchEvent(new Event('luma-search-discussions')));
      }
    }}>
      <div className="notification-heading"><DialogTitle>Notifications</DialogTitle><DialogClose asChild><button type="button" aria-label="Fermer les notifications"><X size={20}/></button></DialogClose></div>
      <DialogDescription>Demandes d’amis et appels entrants.</DialogDescription>
      {loading&&<p role="status">Vérification des notifications…</p>}
      {errors.map(error=><p className="notification-error" role="alert" key={error}>{error}</p>)}
      {!loading&&!expired&&items.length===0&&errors.length===0&&<p className="notification-empty">Aucune demande d’ami ni appel en attente.</p>}
      <ul>{items.map(item=><li key={item.id}><Link href={item.href} onClick={()=>setOpen(false)}>{item.kind==='friend'?<UserPlus/>:<Phone/>}<span><strong>{item.name}</strong><small>{item.detail}</small></span></Link></li>)}</ul>
      <div className="notification-actions">{expired?<Link href="/connexion?returnTo=%2Fmessages" onClick={()=>setOpen(false)}>Se reconnecter</Link>:<button type="button" disabled={loading} onClick={()=>void load()}><RefreshCw size={16}/>Actualiser</button>}<Link href="/parametres#notifications" onClick={()=>setOpen(false)}>Régler les alertes</Link></div>
    </DialogContent>
  </Dialog>;
}
