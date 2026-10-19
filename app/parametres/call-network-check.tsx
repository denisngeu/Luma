'use client';
import {useEffect,useRef,useState} from 'react';
import {Network} from 'lucide-react';
import {requestJson} from '@/lib/client-request';
import {probeCallNetwork,type CallNetworkResult} from '@/lib/call-network-probe';

export default function CallNetworkCheck(){
 const [busy,setBusy]=useState(false),[result,setResult]=useState<CallNetworkResult|null>(null),[error,setError]=useState('');
 const pending=useRef<AbortController|null>(null);
 useEffect(()=>()=>{pending.current?.abort();pending.current=null;},[]);
 async function test(){
  if(pending.current){pending.current.abort();pending.current=null;setBusy(false);setError('');setResult(null);return;}
  const controller=new AbortController();pending.current=controller;setBusy(true);setResult(null);setError('');
  try{
   const config=await requestJson<{iceServers:RTCIceServer[]}>('/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'config'}),signal:controller.signal});
   if(!Array.isArray(config.iceServers))throw Error('Configuration des appels indisponible.');
   const report=await probeCallNetwork(config.iceServers,controller.signal);
   if(!controller.signal.aborted)setResult(report);
  }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Test de connexion indisponible.');}
  finally{if(pending.current===controller){pending.current=null;setBusy(false);}}
 }
 return <div className="settings-network-check"><div><Network aria-hidden="true"/><strong>Connexion des appels</strong></div><p>Vérifiez le réseau sans lancer d’appel ni activer le micro.</p><button type="button" onClick={()=>void test()}>{busy?'Annuler le test':'Tester la connexion d’appel'}</button>{busy&&<p role="status">Vérification du transfert par le relais…</p>}{error&&<p className="privacy-error" role="alert">{error}</p>}{result&&<p className={result.ok?'privacy-success':'privacy-error'} role={result.ok?'status':'alert'}>{result.message}</p>}</div>;
}
