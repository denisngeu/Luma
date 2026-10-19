'use client';
import {useEffect,useState} from 'react';
import {isAppVisible,watchAppVisibility} from '@/lib/app-visibility';
import {requestJson} from '@/lib/client-request';

export type ActiveRoom={id:string;participants:number;mode:string};

export function useActiveRooms(chats:readonly {id:string;kind:string}[]){
 const [rooms,setRooms]=useState<Record<string,ActiveRoom>>({});
 // Activity, unread counters and a new list object must not restart network work.
 const groupKey=JSON.stringify(chats.filter(chat=>chat.kind==='group').slice(0,12).map(chat=>chat.id).sort());
 useEffect(()=>{
  const ids=JSON.parse(groupKey) as string[];
  let live=true,pending=false,controller:AbortController|null=null,failures=0,nextAttempt=0;
  queueMicrotask(()=>{if(live)setRooms(current=>Object.fromEntries(Object.entries(current).filter(([id])=>ids.includes(id))));});
  if(!ids.length)return()=>{live=false;};
  const refresh=async()=>{
   if(!live||pending||!isAppVisible()||Date.now()<nextAttempt)return;
   pending=true;const batch=new AbortController();controller=batch;
   const rows=await Promise.all(ids.map(async chat=>{
    try{
     const data=await requestJson<{room:ActiveRoom|null}>('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'active',chat}),cache:'no-store',signal:batch.signal});
     return {chat,room:data.room,ok:true};
    }catch{return {chat,room:null,ok:false};}
   }));
   pending=false;
   if(!live||batch.signal.aborted)return;
   failures=rows.every(row=>row.ok)?0:Math.min(failures+1,3);
   nextAttempt=Date.now()+(failures?Math.min(60000,8000*2**failures):8000);
   setRooms(current=>{
    const next={...current};
    for(const row of rows){if(!row.ok)continue;if(row.room)next[row.chat]=row.room;else delete next[row.chat];}
    return JSON.stringify(next)===JSON.stringify(current)?current:next;
   });
  };
  const update=()=>{void refresh();};
  const visibility=()=>{
   if(!isAppVisible()){controller?.abort();return;}
   update();
  };
  void refresh();const timer=setInterval(update,8000),unwatch=watchAppVisibility(visibility);
  return()=>{live=false;controller?.abort();clearInterval(timer);unwatch();};
 },[groupKey]);
 return rooms;
}
