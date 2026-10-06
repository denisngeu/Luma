'use client';

type NativePermissionResult={requestId:string;granted:boolean;permanentlyDenied?:boolean;message?:string};

declare global{
 interface Window{ReactNativeWebView?:{postMessage:(message:string)=>void}}
}

export function requestNativeMediaPermissions(camera=false){
 if(typeof window==='undefined')return Promise.resolve();
 const bridge=window.ReactNativeWebView;
 if(!bridge)return Promise.resolve();
 const requestId=`media-${Date.now()}-${Math.random().toString(36).slice(2)}`;
 return new Promise<void>((resolve,reject)=>{
  const cleanup=()=>{window.removeEventListener('luma-native-permissions',listener as EventListener);clearTimeout(timer);};
  const listener=(event:CustomEvent<NativePermissionResult>)=>{
   if(event.detail?.requestId!==requestId)return;
   cleanup();
   if(event.detail.granted)resolve();
   else reject(Error(event.detail.message||'Autorisez le micro et la caméra dans les réglages de Luma.'));
  };
  const timer=setTimeout(()=>{cleanup();reject(Error('La demande d’autorisation Android n’a pas répondu. Ouvrez les réglages de Luma puis réessayez.'));},10000);
  window.addEventListener('luma-native-permissions',listener as EventListener);
  bridge.postMessage(JSON.stringify({type:'request-media-permissions',requestId,camera}));
 });
}
