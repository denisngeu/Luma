'use client';

declare global{interface Window{__lumaCallService?:boolean}}
type ServiceResult={requestId:string;token:string;ok:boolean;error?:string};

export function createNativeCallSession(context:string){
 let token:string|null=null;
 const cancellations=new Set<()=>void>();
 return {
  context,
  owns(value:unknown){return !!token&&token===value;},
  async start(camera=false){
   if(typeof window==='undefined'||!window.__lumaCallService||!window.ReactNativeWebView)return;
   const owner=token||crypto.randomUUID();token=owner;
   const requestId=crypto.randomUUID();
   await new Promise<void>((resolve,reject)=>{
    const cleanup=()=>{clearTimeout(timer);window.removeEventListener('luma-native-call-service',listener as EventListener);cancellations.delete(cancel);};
    const cancel=()=>{cleanup();reject(new DOMException('Appel terminé.','AbortError'));};
    const listener=(event:CustomEvent<ServiceResult>)=>{
     if(event.detail?.requestId!==requestId||event.detail.token!==owner)return;
     cleanup();
     if(event.detail.ok&&token===owner)resolve();
     else reject(new Error(event.detail.error||'Appel terminé.'));
    };
    const timer=setTimeout(()=>{cleanup();reject(Error('Le service d’appel Android ne répond pas. Réessayez.'));},8000);
    window.addEventListener('luma-native-call-service',listener as EventListener);
    cancellations.add(cancel);
    try{window.ReactNativeWebView!.postMessage(JSON.stringify({type:'call-session',action:'start',requestId,token:owner,camera}));}
    catch(error){cleanup();reject(error);}
   });
  },
  stop(){
   const owner=token;token=null;
   for(const cancel of [...cancellations])cancel();
   if(owner&&typeof window!=='undefined')window.ReactNativeWebView?.postMessage(JSON.stringify({type:'call-session',action:'stop',token:owner}));
  },
 };
}
