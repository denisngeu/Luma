import {requestJson} from './client-request';

// Scope requests to one visit. A network stall must neither freeze polling
// indefinitely nor leave requests alive after the user has left the call.
export function createCallTransport<T>(url:string,identity:Record<string,unknown>){
 const pending=new Set<AbortController>();
 return {
  cancel(){for(const controller of pending)controller.abort();pending.clear();},
  async request(action:string,data:Record<string,unknown>={}):Promise<T>{
   const controller=new AbortController();pending.add(controller);
   try{return await requestJson<T>(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...identity,...data}),cache:'no-store',signal:controller.signal});}
   finally{pending.delete(controller);}
  },
 };
}
