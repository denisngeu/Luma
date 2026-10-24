'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Bookmark,ExternalLink,Paperclip,RefreshCw,StarOff} from 'lucide-react';
import {ClientRequestError,requestJson} from '@/lib/client-request';
import {isAppVisible,watchAppVisibility} from '@/lib/app-visibility';

type Cursor={created:number;id:string};
type SavedMessage={id:string;chat:string;chat_name:string;chat_kind:string;body:string;name:string;created:number;scheduled:number;scheduled_pending:number;file?:string;filename?:string};
type Page={messages:SavedMessage[];next:Cursor|null};

export default function SavedMessages({onBack,onOpen}:{onBack:()=>void;onOpen:(chat:{id:string;name:string;kind:string})=>void}){
 const [items,setItems]=useState<SavedMessage[]>([]),[next,setNext]=useState<Cursor|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[actionError,setActionError]=useState(''),[expired,setExpired]=useState(false),[notice,setNotice]=useState(''),[removing,setRemoving]=useState<string[]>([]);
 const mounted=useRef(false),pending=useRef(false),failedCursor=useRef<Cursor|null>(null),lifetime=useRef<AbortController|null>(null),removeLocks=useRef(new Set<string>()),removed=useRef(new Set<string>()),accessVersion=useRef(0);
 const load=useCallback(async(after:Cursor|null)=>{
  if(pending.current||!mounted.current)return;pending.current=true;const version=accessVersion.current;if(!after)removed.current.clear();setLoading(true);setError('');setActionError('');failedCursor.current=after;
  try{
   const page=await requestJson<Page>('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'saved',after}),signal:lifetime.current?.signal});
   if(!Array.isArray(page.messages)||page.next&&(!Number.isSafeInteger(page.next.created)||typeof page.next.id!=='string'))throw Error('Réponse des favoris incomplète. Réessayez.');
   if(mounted.current&&version===accessVersion.current){const incoming=page.messages.filter(message=>!removed.current.has(message.id));setItems(current=>after?[...new Map([...current,...incoming].map(message=>[message.id,message])).values()]:incoming);setNext(page.next);setExpired(false);}
  }catch(error){if(mounted.current&&!lifetime.current?.signal.aborted&&version===accessVersion.current){if(error instanceof ClientRequestError&&[401,403].includes(error.status)){accessVersion.current++;setItems([]);setNext(null);setExpired(error.status===401);}setError(error instanceof Error?error.message:'Impossible de charger vos favoris.');}}
  finally{pending.current=false;if(mounted.current)setLoading(false);}
 },[]);
 useEffect(()=>{mounted.current=true;lifetime.current=new AbortController();let live=true;queueMicrotask(()=>{if(live)void load(null);});const unwatch=watchAppVisibility(()=>{if(isAppVisible())void load(null);});return()=>{live=false;mounted.current=false;lifetime.current?.abort();unwatch();};},[load]);
 async function remove(message:SavedMessage){
  if(removeLocks.current.has(message.id))return;removeLocks.current.add(message.id);setRemoving(current=>[...current,message.id]);setNotice('');setActionError('');
  try{
   const result=await requestJson<{ok:boolean;starred:boolean}>('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'star',message:message.id,starred:false}),signal:lifetime.current?.signal});
   if(!result.ok||result.starred!==false)throw Error('Le retrait du favori n’a pas été confirmé. Réessayez.');
   if(mounted.current){removed.current.add(message.id);setItems(current=>current.filter(item=>item.id!==message.id));setNotice('Message retiré des favoris.');window.dispatchEvent(new CustomEvent('luma-chat-messages-refresh',{detail:message.chat}));}
  }catch(error){if(mounted.current&&!lifetime.current?.signal.aborted){if(error instanceof ClientRequestError&&[401,403].includes(error.status)){accessVersion.current++;setItems([]);setNext(null);setExpired(error.status===401);}setActionError(error instanceof Error?error.message:'Impossible de retirer ce favori.');}}
  finally{removeLocks.current.delete(message.id);if(mounted.current)setRemoving(current=>current.filter(id=>id!==message.id));}
 }
 return <div className="messenger-saved-panel">
  <header><button type="button" onClick={onBack} aria-label="Revenir aux discussions"><ArrowLeft size={20}/></button><div><h2><Bookmark size={19}/>Messages favoris</h2><p>Vos messages enregistrés dans les discussions privées et les groupes.</p></div><button type="button" disabled={loading} onClick={()=>void load(null)} aria-label="Actualiser les favoris"><RefreshCw size={18}/></button></header>
  <section className="messenger-saved-list" aria-label="Messages favoris" aria-busy={loading}>
   {error&&<div className="messenger-saved-status" role="alert"><p>{error}</p><button type="button" disabled={loading} onClick={()=>void load(failedCursor.current)}>Réessayer les favoris</button></div>}
   {actionError&&<p className="messenger-saved-status" role="alert">{actionError}</p>}
   {expired&&<div className="messenger-saved-status"><a href="/connexion?returnTo=%2Fmessages">Se reconnecter</a></div>}
   {notice&&<p className="messenger-saved-status" role="status">{notice}</p>}
   {loading&&<p className="messenger-saved-status" role="status">Chargement des favoris…</p>}
   {!items.length&&!loading&&!error&&!actionError&&<div className="stitch-saved-empty"><Bookmark size={30}/><strong>Aucun message favori</strong><p>Utilisez l’étoile sous un message pour le retrouver ici, même s’il est ancien.</p></div>}
   {items.map(message=><article key={message.id} className="messenger-saved-card"><header><strong>{message.chat_name}</strong><small>{message.name} · <time dateTime={new Date(message.created).toISOString()}>{new Date(message.created).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})}</time></small></header>
    {!!message.scheduled_pending&&<small className="messenger-saved-scheduled">Programmé pour {new Date(message.scheduled).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'})}</small>}
    {message.body&&<p className="messenger-message-body">{message.body}</p>}
    {message.file&&<a className="stitch-message-file" href={'/api/files?id='+encodeURIComponent(message.file)} target="_blank" rel="noreferrer"><Paperclip size={18}/>{message.filename||'Pièce jointe'}<ExternalLink size={16}/></a>}
    <footer><button type="button" onClick={()=>onOpen({id:message.chat,name:message.chat_name,kind:message.chat_kind})}><ExternalLink size={16}/>Ouvrir la discussion</button><button type="button" disabled={removing.includes(message.id)} onClick={()=>void remove(message)} aria-label={'Retirer le favori de '+message.name+' dans '+message.chat_name}><StarOff size={16}/>{removing.includes(message.id)?'Retrait…':'Retirer'}</button></footer>
   </article>)}
   {next&&!error&&<button className="messenger-saved-more" type="button" disabled={loading} onClick={()=>void load(next)}>Charger plus de favoris</button>}
  </section>
 </div>;
}
