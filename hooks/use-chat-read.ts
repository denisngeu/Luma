'use client';

import {useEffect,useRef,type RefObject} from 'react';
import {isAppVisible,watchAppVisibility} from '@/lib/app-visibility';
import type {ReadCursor} from '@/lib/chat-reads';

type Options={
  active:string; mobile:boolean; blocked:boolean; snapshot:string;
  viewport:RefObject<HTMLElement|null>;
  api:(action:string,data?:Record<string,unknown>,signal?:AbortSignal)=>Promise<{unread?:number}>;
  onRead:(chat:string,unread:number)=>void;
};

export function useChatRead({active,mobile,blocked,snapshot,viewport,api,onRead}:Options){
  const current=useRef(''),seen=useRef(new Map<string,string>()),worker=useRef<(()=>void)|null>(null);
  // Publish only after the corresponding messages have rendered. A newer
  // snapshot waits for an in-flight acknowledgement rather than cancelling it.
  useEffect(()=>{current.current=snapshot;worker.current?.();},[snapshot]);
  useEffect(()=>{
    if(!active||blocked)return;
    let live=true,pending=false;const controller=new AbortController();
    const acknowledge=async()=>{
      if(!live||pending||!isAppVisible()||(matchMedia('(max-width:760px)').matches&&!mobile))return;
      if(document.querySelector('[role="dialog"][data-state="open"]'))return;
      const pane=viewport.current;
      if(!pane||pane.scrollHeight-pane.clientHeight-pane.scrollTop>12)return;
      const key=current.current;if(!key||seen.current.get(active)===key)return;
      let target:{chat:string;cursor:ReadCursor};
      try{target=JSON.parse(key);}catch{return;}
      if(target.chat!==active||!target.cursor?.sequence)return;
      pending=true;
      try{
        const result=await api('read',{chat:active,cursor:target.cursor},controller.signal);
        if(live){seen.current.set(active,key);if(Number.isSafeInteger(result.unread)&&Number(result.unread)>=0)onRead(active,Number(result.unread));}
      }catch{/* Keep the server count until a retry confirms this snapshot. */}
      finally{pending=false;if(live&&current.current!==key)queueMicrotask(()=>void acknowledge());}
    };
    const refresh=()=>{void acknowledge();};worker.current=refresh;
    queueMicrotask(refresh);const timer=setInterval(refresh,4000);
    const unwatch=watchAppVisibility(refresh);window.addEventListener('resize',refresh);
    const pane=viewport.current;pane?.addEventListener('scroll',refresh,{passive:true});
    return()=>{live=false;controller.abort();clearInterval(timer);if(worker.current===refresh)worker.current=null;unwatch();window.removeEventListener('resize',refresh);pane?.removeEventListener('scroll',refresh);};
  },[active,mobile,blocked,viewport,api,onRead]);
}
