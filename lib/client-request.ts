export class ClientRequestError extends Error {
 readonly status:number;
 constructor(message:string,status=0){super(message);this.name='ClientRequestError';this.status=status;}
}

export async function requestJson<T>(url:string,init:RequestInit={},timeoutMs=12000):Promise<T>{
 const controller=new AbortController(),parent=init.signal;
 let timedOut=false;
 const abort=()=>controller.abort();
 if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});
 const timer=setTimeout(()=>{timedOut=true;controller.abort();},timeoutMs);
 try{
  const response=await fetch(url,{...init,signal:controller.signal});
  let data:T&{error?:string};
  try{data=await response.json();}catch{throw new ClientRequestError('Réponse du serveur illisible. Réessayez.',response.status);}
  if(!response.ok)throw new ClientRequestError(data?.error||'Le service est indisponible. Réessayez.',response.status);
  return data;
 }catch(error){
  if(timedOut)throw new ClientRequestError('Le serveur met trop de temps à répondre. Réessayez.');
  if(parent?.aborted)throw new DOMException('Requête annulée.','AbortError');
  if(error instanceof ClientRequestError)throw error;
  throw new ClientRequestError('Connexion au serveur impossible. Vérifiez votre réseau puis réessayez.');
 }finally{clearTimeout(timer);parent?.removeEventListener('abort',abort);}
}
