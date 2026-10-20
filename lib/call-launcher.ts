import {ClientRequestError,requestJson} from './client-request';

type CallTarget={chat?:string;peer?:string;mode:string;group?:boolean};

// One launcher per mounted screen: prevent same-tick duplicate presses and
// retain the request ID when the server may have accepted a lost response.
export function createCallLauncher(){
 const attempts=new Map<string,string>();let pending:AbortController|null=null;
 return {
  isPending(){return pending!==null;},
  cancel(){pending?.abort();},
  async start(target:CallTarget):Promise<string|null>{
   if(pending)return null;
   const controller=new AbortController();pending=controller;
   const key=JSON.stringify(target),requestId=attempts.get(key)||crypto.randomUUID();attempts.set(key,requestId);
   try{
    const result=await requestJson<{id:string}>(target.group?'/api/rooms':'/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',...target,requestId}),signal:controller.signal});
    if(typeof result?.id!=='string'||!result.id)throw new ClientRequestError('Réponse d’appel invalide. Réessayez.');
    attempts.delete(key);return (target.group?'/salle/':'/appel/')+encodeURIComponent(result.id);
   }catch(error){
    if(error instanceof ClientRequestError&&error.status>=400&&error.status<500)attempts.delete(key);
    throw error;
   }finally{if(pending===controller)pending=null;}
  },
 };
}
