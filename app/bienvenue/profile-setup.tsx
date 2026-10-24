'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowRight,Camera,Check,Sparkles,Users,MessageCircle} from 'lucide-react';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {ClientRequestError,requestJson} from '@/lib/client-request';
import {normalizeProfileName,PROFILE_NAME_ERROR,PROFILE_NAME_MIN,PROFILE_NAME_MAX} from '@/lib/profile-name';
export default function ProfileSetup({returnTo}:{returnTo:string}){
 const router=useRouter(),previewRef=useRef(''),mounted=useRef(false),saveLock=useRef(false),dirty=useRef({name:false,bio:false});
 const loadingRequest=useRef<AbortController|null>(null),savingRequest=useRef<AbortController|null>(null);
 const [name,setName]=useState(''),[bio,setBio]=useState(''),[avatar,setAvatar]=useState<File|null>(null),[hasAvatar,setHasAvatar]=useState(false),[preview,setPreview]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[loading,setLoading]=useState(true),[ready,setReady]=useState(false),[expired,setExpired]=useState(false);
 const loadProfile=useCallback(async()=>{
  if(saveLock.current)return;loadingRequest.current?.abort();const controller=new AbortController();loadingRequest.current=controller;
  setLoading(true);setReady(false);setError('');setExpired(false);
  try{
   const response=await requestJson<{profile:{name:string;bio:string;avatar?:boolean|number}}>('/api/profile',{cache:'no-store',signal:controller.signal});
   if(!response?.profile||typeof response.profile.name!=='string'||typeof response.profile.bio!=='string')throw Error('Profil reçu incomplet. Réessayez le chargement.');
   if(!mounted.current||controller.signal.aborted)return;
   if(!dirty.current.name)setName(response.profile.name);if(!dirty.current.bio)setBio(response.profile.bio);setHasAvatar(!!response.profile.avatar);setReady(true);
  }catch(error){if(mounted.current&&!controller.signal.aborted){setError(error instanceof Error?error.message:'Impossible de charger votre profil.');setExpired(error instanceof ClientRequestError&&error.status===401);}}
  finally{if(mounted.current&&!controller.signal.aborted)setLoading(false);}
 },[]);
 useEffect(()=>{mounted.current=true;let live=true;queueMicrotask(()=>{if(live)void loadProfile();});return()=>{live=false;mounted.current=false;loadingRequest.current?.abort();savingRequest.current?.abort();if(previewRef.current)URL.revokeObjectURL(previewRef.current);};},[loadProfile]);
 function chooseAvatar(event:React.ChangeEvent<HTMLInputElement>){
  const file=event.target.files?.[0];event.target.value='';if(!file||saveLock.current)return;
  setError('');if(file.size>5*1024*1024||!['image/jpeg','image/png','image/webp','image/avif'].includes(file.type)){setError('Choisissez une image JPG, PNG, WebP ou AVIF de 5 Mo maximum.');return;}
  if(previewRef.current)URL.revokeObjectURL(previewRef.current);const next=URL.createObjectURL(file);previewRef.current=next;setAvatar(file);setPreview(next);
 }
 async function submit(event:React.FormEvent){
  event.preventDefault();if(saveLock.current||loading||!ready||expired)return;const displayName=normalizeProfileName(name);
  if(!displayName){setError(PROFILE_NAME_ERROR);return;}
  saveLock.current=true;setBusy(true);setError('');const controller=new AbortController();savingRequest.current=controller;let finished=false;
  try{
   const form=new FormData();form.set('name',displayName);form.set('bio',bio);if(avatar)form.set('avatar',avatar);
   const result=await requestJson<{ok:boolean}>('/api/profile',{method:'POST',body:form,signal:controller.signal},avatar?120000:12000);
   if(!result?.ok)throw Error('Le serveur n’a pas confirmé le profil. Réessayez.');
   if(!mounted.current||controller.signal.aborted)return;router.replace(returnTo);finished=true;
  }catch(error){if(mounted.current&&!controller.signal.aborted){setError(error instanceof Error?error.message:'Profil impossible à enregistrer.');setExpired(error instanceof ClientRequestError&&error.status===401);}}
  finally{if(!finished){saveLock.current=false;if(mounted.current)setBusy(false);}}
 }
 return <main className="welcome-profile"><section className="welcome-story"><Link href="/">Luma<span>●</span></Link><div><span>VOTRE IDENTITÉ</span><h1>Bienvenue dans<br/><em>votre cercle.</em></h1><p>Choisissez la façon dont vos amis et vos communautés vous verront.</p><div className="welcome-points"><span><MessageCircle/> Discutez sans perdre le fil</span><span><Users/> Rejoignez vos communautés</span><span><Sparkles/> Personnalisez votre expérience</span></div></div></section><section className="welcome-form"><form onSubmit={submit}><span className="step">ÉTAPE UNIQUE · PROFIL</span><h2>Comment doit-on vous appeler ?</h2><p>Vous pourrez modifier ces informations plus tard dans les paramètres.</p><label className="avatar-picker"><input type="file" accept="image/jpeg,image/png,image/webp,image/avif" disabled={busy} onChange={chooseAvatar}/><span>{preview?<img src={preview} alt="Aperçu de votre photo"/>:hasAvatar?<img src="/api/profile?avatar=1" alt="Votre photo actuelle"/>:<Camera/>}</span><strong>{preview||hasAvatar?'Changer la photo':'Ajouter une photo'}</strong><small>JPG, PNG, WebP ou AVIF · 5 Mo maximum</small></label><label>Pseudo<input required minLength={PROFILE_NAME_MIN} maxLength={PROFILE_NAME_MAX} disabled={busy} value={name} onChange={e=>{dirty.current.name=true;setName(e.target.value);}} placeholder="Votre pseudo"/></label><label>Quelques mots sur vous <small>Facultatif</small><textarea maxLength={280} disabled={busy} value={bio} onChange={e=>{dirty.current.bio=true;setBio(e.target.value);}} placeholder="Vos centres d’intérêt, votre rôle, ce que vous aimez…"/></label>{loading&&<p role="status">Chargement de votre profil…</p>}{error&&<div><p className="welcome-error" role="alert">{error}</p>{expired?<Link href={"/connexion?returnTo="+encodeURIComponent("/bienvenue?returnTo="+encodeURIComponent(returnTo))}>Se reconnecter</Link>:!ready&&!loading&&<button type="button" onClick={()=>void loadProfile()}>Réessayer le profil</button>}</div>}<button disabled={busy||loading||!ready||expired||!normalizeProfileName(name)}>{busy?'Création du profil…':'Entrer dans Luma'}<ArrowRight/></button><footer><Check/> Votre photo et votre pseudo restent modifiables.</footer></form></section></main>}
