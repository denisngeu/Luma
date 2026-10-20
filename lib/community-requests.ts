import {requestJson} from './client-request';

export function createCommunityRequests(){
 const pending=new Set<AbortController>();
 async function json<T>(url:string,init:RequestInit={},timeout=12000){
  const controller=new AbortController(),parent=init.signal;
  const abort=()=>controller.abort();
  if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
  pending.add(controller);
  try{return await requestJson<T>(url,{...init,signal:controller.signal},timeout);}
  finally{pending.delete(controller);parent?.removeEventListener('abort',abort);}
 }
 return {
  json,
  request<T>(action:string,data:Record<string,unknown>={},chat=false,signal?:AbortSignal){
   return json<T>(chat?'/api/chat':'/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data}),signal,cache:'no-store'});
  },
  cancel(){for(const controller of pending)controller.abort();pending.clear();},
 };
}
