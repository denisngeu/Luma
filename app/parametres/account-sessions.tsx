'use client';
import {useEffect,useState} from 'react';
import {Laptop,LogOut} from 'lucide-react';
type Session={created:number|string;expires:number|string};
type SessionsResponse={sessions?:Session[];revoked?:number;error?:string};
function sessionError(error:unknown){
 if(error instanceof TypeError||error instanceof SyntaxError)return 'Le service des sessions est indisponible. Vérifiez votre connexion puis réessayez.';
 return error instanceof Error?error.message:'Vérification impossible. Réessayez.';
}
async function loadSessions(signal?:AbortSignal){
 const response=await fetch('/api/auth/sessions',{cache:'no-store',signal});
 const data=await response.json() as SessionsResponse;
 if(!response.ok||!Array.isArray(data.sessions))throw Error(data.error||'Impossible de vérifier les sessions.');
 return data.sessions;
}
function sessionDate(value:number|string){
 const date=new Date(Number(value));
 return Number.isNaN(date.getTime())?'Date indisponible':date.toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'});
}
export default function AccountSessions(){
 const [sessions,setSessions]=useState<Session[]|null>(null),[notice,setNotice]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  const controller=new AbortController();
  void loadSessions(controller.signal).then(rows=>{if(!controller.signal.aborted)setSessions(rows);}).catch(e=>{if(!controller.signal.aborted)setError(sessionError(e));});
  return()=>controller.abort();
 },[]);
 async function retry(){
  if(busy)return;setBusy(true);setError('');
  try{setSessions(await loadSessions());}catch(e){setError(sessionError(e));}finally{setBusy(false);}
 }
 async function revoke(){
  if(busy||sessions===null||sessions.length<2)return;
  setBusy(true);setError('');setNotice('');let revoked=false;
  try{
   const response=await fetch('/api/auth/sessions',{method:'DELETE'}),data=await response.json() as SessionsResponse;
   if(!response.ok)throw Error(data.error||'Déconnexion impossible.');
   revoked=true;const count=data.revoked||0;setNotice(count===0?'Aucune autre session à déconnecter.':count===1?'1 autre session déconnectée.':`${count} autres sessions déconnectées.`);
   setSessions(await loadSessions());
  }catch(e){
   if(revoked){setSessions(null);setError('La déconnexion a réussi, mais la liste des sessions ne peut pas être actualisée. Réessayez la vérification.');}
   else setError(sessionError(e));
  }finally{setBusy(false);}
 }
 return <section className="account-sessions">
  <div><Laptop/><span><strong>Appareils connectés</strong><small>{sessions===null?(error?'Vérification indisponible':'Vérification…'):`${sessions.length} session${sessions.length!==1?'s':''} active${sessions.length!==1?'s':''}`}</small></span></div>
  <button disabled={busy||sessions===null||sessions.length<2} onClick={()=>void revoke()}><LogOut size={17}/>{busy&&sessions!==null?'Déconnexion…':'Déconnecter les autres appareils'}</button>
  {sessions!==null&&<details className="session-details"><summary>Détails des sessions</summary><p>Connexions enregistrées sur votre compte.</p><ul>{sessions.map((session,index)=><li key={`${session.created}-${session.expires}-${index}`}><strong>Session du {sessionDate(session.created)}</strong><small>Expiration : {sessionDate(session.expires)}</small></li>)}</ul>{!sessions.length&&<p>Aucune session enregistrée.</p>}</details>}
  {notice&&<p role="status">{notice}</p>}{error&&<p className="privacy-error" role="alert">{error}</p>}
  {sessions===null&&error&&<button disabled={busy} onClick={()=>void retry()}>{busy?'Vérification…':'Réessayer la vérification'}</button>}
 </section>;
}
