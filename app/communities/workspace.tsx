'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Hash,Plus,Users,Search,Pin,Send,Paperclip,BarChart3,MessageSquare,Shield,Clock,Bookmark,Settings,X,Copy,Megaphone,ArrowUpRight,Headphones,Bot,Volume2,SlidersHorizontal,Globe} from 'lucide-react';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {Switch} from '@/components/ui/switch';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {createCommunityRequests} from '@/lib/community-requests';
import {startVisiblePolling} from '@/lib/visible-polling';
import {useActiveRooms} from '@/hooks/use-active-rooms';
import {ClientRequestError} from '@/lib/client-request';
type Space={id:string;name:string;description:string;rules?:string;invite:string;role:string};
type Channel={id:string;name:string;topic?:string;mode?:string;space?:string;owner:string};
type Member={user:string;name:string;role:string};
type SpaceBot={kind:'welcome'|'moderation'|'digest';enabled:number;config:Record<string,unknown>|string};
type Message={id:string;body:string;name:string;author:string;created:number;scheduled:number;file?:string;filename?:string;reply?:string;replies:number;starred:number;pinned:number;edited:number};
type Reaction={message:string;emoji:string;count:number;mine:number};type Poll={message:string;options:string[];closed:number};type Vote={message:string;choice:number;count:number;mine:number};
type Feed={messages:Message[];reactions:Reaction[];polls:Poll[];votes:Vote[];pinned:Message[];more:boolean};
type Result=Feed&{spaces:Space[];space:Space;channels:Channel[];chats:Channel[];members:Member[];bots:SpaceBot[];role:string;user:{id:string;name:string};id:string;error?:string;invite:string};
const empty:Feed={messages:[],reactions:[],polls:[],votes:[],pinned:[],more:false};const emojis=['👍','❤️','🔥','🎉','😂','👀'];
function CommunityPicker({compact=false,onCreate,onJoin}:{compact?:boolean;onCreate:()=>void;onJoin:()=>void}){
 return <DropdownMenu><DropdownMenuTrigger className="community-picker-trigger" aria-label="Ajouter une communauté"><Plus size={18}/>{!compact&&<span className="community-picker-label">Ajouter</span>}</DropdownMenuTrigger><DropdownMenuContent className="community-picker-menu" align="start" collisionPadding={12}><DropdownMenuItem onSelect={onCreate}>Créer une communauté</DropdownMenuItem><DropdownMenuItem onSelect={onJoin}>Rejoindre une communauté</DropdownMenuItem></DropdownMenuContent></DropdownMenu>;
}
export default function Community(){
 const router=useRouter();
 const [spaces,setSpaces]=useState<Space[]>([]),[selected,setSelected]=useState(''),[space,setSpace]=useState<Space|null>(null),[channels,setChannels]=useState<Channel[]>([]),[directs,setDirects]=useState<Channel[]>([]),[active,setActiveState]=useState(''),[members,setMembers]=useState<Member[]>([]),[bots,setBots]=useState<SpaceBot[]>([]),[role,setRole]=useState('member'),[me,setMe]=useState({id:'',name:''}),[feed,setFeed]=useState<Feed>(empty),[thread,setThreadState]=useState<Message|null>(null),[threadFeed,setThreadFeed]=useState<Feed>(empty),[text,setTextState]=useState(''),[threadText,setThreadText]=useState(''),[modal,setModal]=useState(''),[name,setName]=useState(''),[description,setDescription]=useState(''),[settingsName,setSettingsName]=useState(''),[settingsDescription,setSettingsDescription]=useState(''),[rules,setRules]=useState(''),[welcome,setWelcome]=useState('Bienvenue {user} dans la communauté !'),[blockedWords,setBlockedWords]=useState(''),[code,setCode]=useState(''),[mode,setMode]=useState('text'),[question,setQuestion]=useState(''),[options,setOptions]=useState(['','']),[schedule,setSchedule]=useState(''),[query,setQuery]=useState(''),[results,setResults]=useState<Message[]|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[panel,setPanel]=useState(''),[mobile,setMobile]=useState(false),[edit,setEdit]=useState<Message|null>(null),[editText,setEditText]=useState(''),[older,setOlder]=useState<Feed>(empty),[saved,setSaved]=useState<Message[]>([]);
 const transport=useMemo(()=>createCommunityRequests(),[]);
 const request=useCallback((action:string,data:Record<string,unknown>={},chat=false,signal?:AbortSignal)=>transport.request<Result>(action,data,chat,signal),[transport]);
 const file=useRef<HTMLInputElement>(null),last=useRef<HTMLDivElement>(null),version=useRef(0);
 const mounted=useRef(false),currentChat=useRef(''),currentThread=useRef<string|null>(null),viewEpoch=useRef(0),revision=useRef(0),actionOwner=useRef<symbol|null>(null);
 const drafts=useRef(new Map<string,string>()),attempts=useRef(new Map<string,{fingerprint:string;id:string}>());
 const listingVersion=useRef(0),listingRequest=useRef<AbortController|null>(null),spaceRequest=useRef<AbortController|null>(null);
 const [feedError,setFeedError]=useState(''),[threadError,setThreadError]=useState(''),[refreshTick,setRefreshTick]=useState(0),[listingTick,setListingTick]=useState(0),[authRequired,setAuthRequired]=useState(false),[spaceLoading,setSpaceLoading]=useState(false);
 const activeRooms=useActiveRooms(channels.filter(c=>c.mode==='voice').map(c=>({id:c.id,kind:'group'})),true);
 const channel=[...channels,...directs].find(c=>c.id===active),staff=selected?['owner','moderator'].includes(role):channel?.owner===me.id;
 const canWrite=channel?.mode!=='voice'&&(channel?.mode!=='announcement'||staff);
 const initials=(value:string)=>value.split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
 const setThread=useCallback((value:Message|null)=>{currentThread.current=value?.id||null;setThreadState(value);},[]);
 const setText=useCallback((value:string)=>{drafts.current.set(currentChat.current,value);setTextState(value);},[]);
 const setActive=useCallback((id:string)=>{
  if(id===currentChat.current)return;
  currentChat.current=id;viewEpoch.current++;revision.current++;actionOwner.current=null;
  setBusy(false);setActiveState(id);setFeed(empty);setOlder(empty);setResults(null);setThread(null);setThreadFeed(empty);setThreadText('');
  setTextState(drafts.current.get(id)||'');setError('');setFeedError('');setThreadError('');setSaved([]);setSchedule('');
 },[setThread]);
 const dispose=useCallback(()=>{mounted.current=false;viewEpoch.current++;version.current++;listingVersion.current++;listingRequest.current?.abort();spaceRequest.current?.abort();transport.cancel();},[transport]);
 useEffect(()=>{mounted.current=true;return dispose;},[dispose]);
 const refreshSpaces=useCallback(async()=>{
  const generation=++listingVersion.current;listingRequest.current?.abort();const controller=new AbortController();listingRequest.current=controller;
  const [a,b]=await Promise.all([request('spaces',{},false,controller.signal),request('list',{},true,controller.signal)]);
  if(!mounted.current||controller.signal.aborted||generation!==listingVersion.current)throw new DOMException('Requête annulée.','AbortError');
  setSpaces(a.spaces);setMe(a.user);setDirects(b.chats);
  return {spaces:a.spaces,directs:b.chats};
 },[request]);
 const openSpace=useCallback(async(id:string,directId='')=>{
  spaceRequest.current?.abort();const controller=new AbortController();spaceRequest.current=controller;
  viewEpoch.current++;actionOwner.current=null;setBusy(false);setError('');setFeedError('');setThreadError('');setSpaceLoading(!!id);setSelected(id);setActive('');setChannels([]);setSpace(null);setMembers([]);setBots([]);setRole('member');setThread(null);setResults(null);setOlder(empty);setPanel('');setModal('');
  const generation=++version.current;
  if(!id){setActive(directId);return;}
  try{
   const data=await request('space',{space:id},false,controller.signal);
   if(!mounted.current||controller.signal.aborted||generation!==version.current)return;
   setSpace(data.space);setChannels(data.channels);setMembers(data.members);setBots(data.bots||[]);setRole(data.role);
   setSettingsName(data.space.name);setSettingsDescription(data.space.description||'');setRules(data.space.rules||'');
   for(const bot of data.bots||[]){
    const config=typeof bot.config==='string'?JSON.parse(bot.config):bot.config;
    if(bot.kind==='welcome'&&typeof config.message==='string')setWelcome(config.message);
    if(bot.kind==='moderation'&&Array.isArray(config.blockedWords))setBlockedWords(config.blockedWords.join(', '));
   }
   setActive(data.channels.find(c=>c.mode!=='voice')?.id||data.channels[0]?.id||'');setError('');setAuthRequired(false);
  }catch(error){if(mounted.current&&!controller.signal.aborted&&generation===version.current){setError((error as Error).message);if(error instanceof ClientRequestError&&error.status===401)setAuthRequired(true);}}
  finally{if(mounted.current&&generation===version.current)setSpaceLoading(false);}
 },[request,setActive,setThread]);
 useEffect(()=>{
  let live=true;const navigation=version.current;
  queueMicrotask(()=>{if(!live)return;setLoading(true);refreshSpaces().then(data=>{
   if(!live||navigation!==version.current)return;
   setAuthRequired(false);setError('');
   const target=new URLSearchParams(location.search).get('chat');
   if(target&&data.directs.some(c=>c.id===target))setActive(target);
   else if(data.spaces.length)void openSpace(data.spaces[0].id);
   else if(data.directs.length)setActive(data.directs[0].id);
  }).catch(error=>{if(live&&!(error instanceof DOMException&&error.name==='AbortError')){setError(error.message);setAuthRequired(error instanceof ClientRequestError&&error.status===401);}}).finally(()=>{if(live)setLoading(false);});});
  return()=>{live=false;};
 },[openSpace,refreshSpaces,setActive,listingTick]);
 useEffect(()=>{
  if(!active)return;
  let readGeneration=revision.current;
  return startVisiblePolling({
   read:async signal=>{const generation=revision.current;readGeneration=generation;const data=await request('feed',{chat:active},false,signal);return {data,generation};},
   onData:({data,generation})=>{if(currentChat.current===active&&generation===revision.current){setFeed(data);setFeedError('');setAuthRequired(false);}},
   onError:error=>{if(currentChat.current===active&&readGeneration===revision.current){setFeedError((error as Error).message);if(error instanceof ClientRequestError&&error.status===401)setAuthRequired(true);}},
  });
 },[active,request,refreshTick]);
 useEffect(()=>{
  const threadId=thread?.id;if(!active||!threadId)return;
  let readGeneration=revision.current;
  queueMicrotask(()=>{if(currentThread.current===threadId)setThreadFeed(empty);});
  return startVisiblePolling({
   read:async signal=>{const generation=revision.current;readGeneration=generation;const data=await request('feed',{chat:active,thread:threadId},false,signal);return {data,generation};},
   onData:({data,generation})=>{if(currentChat.current===active&&currentThread.current===threadId&&generation===revision.current){setThreadFeed(data);setThreadError('');}},
   onError:error=>{if(currentChat.current===active&&currentThread.current===threadId&&readGeneration===revision.current)setThreadError((error as Error).message);},
  });
 },[active,thread?.id,request,refreshTick]);
 useEffect(()=>{if(!older.messages.length&&!results)last.current?.scrollIntoView({behavior:document.documentElement.dataset.motion==='reduced'?'auto':'smooth'});},[feed.messages.length,older.messages.length,results]);
 useEffect(()=>{
  if(panel!=='saved'||!active)return;
  const controller=new AbortController();queueMicrotask(()=>{if(!controller.signal.aborted)setSaved([]);});
  request('saved',{chat:active},false,controller.signal).then(data=>{if(!controller.signal.aborted&&currentChat.current===active)setSaved(data.messages);}).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return()=>controller.abort();
 },[panel,active,request]);
 useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),3500);return()=>clearTimeout(timer);},[notice]);
 function context(){const generation=viewEpoch.current;return()=>mounted.current&&viewEpoch.current===generation;}
 async function runAction(work:(current:()=>boolean)=>Promise<void>){
  if(actionOwner.current||active!==currentChat.current)return;
  const owner=Symbol('community-action'),current=context();actionOwner.current=owner;revision.current++;setBusy(true);setError('');setNotice('');
  try{await work(current);}catch(error){if(current()&&!(error instanceof DOMException&&error.name==='AbortError')){setError((error as Error).message);if(error instanceof ClientRequestError&&error.status===401)setAuthRequired(true);}}
  finally{if(actionOwner.current===owner){actionOwner.current=null;if(mounted.current)setBusy(false);}}
 }
 async function reload(current=context()){
  const generation=++revision.current;
  const fresh=()=>current()&&generation===revision.current;
  if(active){
   const latest=await request('feed',{chat:active});if(!fresh())return;setFeed(latest);setFeedError('');
   if(older.messages.length){
    let cursor=latest.messages[0];let history:Feed={...empty};
    for(let i=0;i<Math.ceil(older.messages.length/80)&&cursor;i++){
     const page=await request('feed',{chat:active,before:cursor.created,beforeId:cursor.id});if(!fresh())return;
     history={...page,messages:[...page.messages,...history.messages],reactions:[...page.reactions,...history.reactions],polls:[...page.polls,...history.polls],votes:[...page.votes,...history.votes]};cursor=page.messages[0];if(!page.more)break;
    }
    if(fresh())setOlder(history);
   }
   if(panel==='saved'){const data=await request('saved',{chat:active});if(fresh())setSaved(data.messages);}
  }
  if(thread){const data=await request('feed',{chat:active,thread:thread.id});if(fresh()&&currentThread.current===thread.id){setThreadFeed(data);setThreadError('');}}
 }
 async function act(action:string,data:Record<string,unknown>={},chat=false){await runAction(async current=>{await request(action,data,chat);if(current())await reload(current);});}
 async function send(inThread=false){
  const body=inThread?threadText:text;if(!body.trim())return;
  const payload={chat:active,body,reply:inThread?thread?.id:undefined,scheduled:schedule?new Date(schedule).getTime():0};
  const key=active+':'+(payload.reply||''),fingerprint=JSON.stringify(payload),previous=attempts.current.get(key);
  await runAction(async current=>{
   const attempt=previous?.fingerprint===fingerprint?previous:{fingerprint,id:crypto.randomUUID()};attempts.current.set(key,attempt);
   await request('send',{...payload,clientId:attempt.id},true);if(attempts.current.get(key)===attempt)attempts.current.delete(key);
   if(!inThread&&drafts.current.get(active)===body){drafts.current.delete(active);if(current())setTextState('');}
   if(!current())return;
   if(inThread&&currentThread.current===thread?.id)setThreadText('');setSchedule('');setModal('');await reload(current);
  });
 }
 async function submitForm(){await runAction(async current=>{
  if(modal==='create'||modal==='join'){
   const data=await request(modal==='create'?'create_space':'join_space',modal==='create'?{name,description}:{code});await refreshSpaces();if(!current())return;const navigation=version.current+1;await openSpace(data.id);if(!mounted.current||version.current!==navigation)return;
  }else if(modal==='channel'){
   const data=await request('create_channel',{space:selected,name,topic:description,mode});if(!current())return;
   const listing=await request('space',{space:selected});if(!current())return;setChannels(listing.channels);setActive(data.id);setMobile(true);
  }else if(modal==='poll'){await request('poll',{chat:active,question,options});if(current())await reload(current);}
  else if(modal==='edit'&&edit){await request('edit',{message:edit.id,body:editText});if(current())await reload(current);}
  if(!current()&&modal!=='create'&&modal!=='join'&&modal!=='channel')return;
  setModal('');setName('');setDescription('');setCode('');setQuestion('');setOptions(['','']);
 });}
 async function saveCommunity(){if(!space)return;await runAction(async current=>{
  await request('update_space',{space:selected,name:settingsName,description:settingsDescription,rules});if(!current())return;
  const data=await request('space',{space:selected});if(!current())return;setSpace(data.space);setSpaces(list=>list.map(item=>item.id===selected?{...item,...data.space}:item));setNotice('Paramètres de la communauté enregistrés.');
 });}
 async function saveBot(kind:SpaceBot['kind'],enabled:boolean){await runAction(async current=>{
  await request('save_bot',{space:selected,kind,enabled,message:welcome,blockedWords,hour:18});if(!current())return;
  const data=await request('space',{space:selected});if(!current())return;setBots(data.bots||[]);setNotice(enabled?'Automatisation activée.':'Automatisation désactivée.');
 });}
 async function changeRole(target:Member){await runAction(async current=>{
  await request('role',{space:selected,user:target.user,role:target.role==='moderator'?'member':'moderator'});if(!current())return;
  const data=await request('space',{space:selected});if(current())setMembers(data.members);
 });}
 async function rotateInvite(){await runAction(async current=>{
  const data=await request('rotate_invite',{space:selected});if(!current())return;
  setSpace(previous=>previous?.id===selected?{...previous,invite:data.invite}:previous);setNotice('Ancien code invalidé. Les membres restent dans la communauté.');
 });}
 async function search(event:React.FormEvent){event.preventDefault();if(!query.trim()){setResults(null);return;}await runAction(async current=>{const data=await request('search',{chat:active,query});if(current())setResults(data.messages);});}
 async function upload(uploaded:File){
  if(uploaded.size>20*1024*1024){setError('Taille maximale : 20 Mo');return;}
  await runAction(async current=>{const data=new FormData();data.set('file',uploaded);data.set('chat',active);await transport.json('/api/files',{method:'POST',body:data},120000);if(current())await reload(current);});
  if(file.current)file.current.value='';
 }
 async function joinVoice(){if(!active)return;await runAction(async current=>{const data=await transport.json<{id:string}>('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'create',chat:active,mode:'audio'})});if(current())router.push('/salle/'+encodeURIComponent(data.id));});}
 async function previous(){await runAction(async current=>{
  const first=older.messages[0]||feed.messages[0],data=await request('feed',{chat:active,before:first?.created,beforeId:first?.id});if(!current())return;
  setOlder(old=>({...data,messages:[...data.messages,...old.messages],reactions:[...data.reactions,...old.reactions],polls:[...data.polls,...old.polls],votes:[...data.votes,...old.votes]}));
 });}
 const copy=(value:string)=>navigator.clipboard.writeText(value).then(()=>{if(mounted.current)setNotice('Invitation copiée');}).catch(()=>{if(mounted.current)setError('Copie indisponible. Sélectionnez le code manuellement.');});
 const combined:Feed={...feed,messages:[...older.messages,...feed.messages].filter((message,index,list)=>list.findIndex(x=>x.id===message.id)===index),reactions:[...feed.reactions,...older.reactions],polls:[...feed.polls,...older.polls],votes:[...feed.votes,...older.votes]};
 const displayError=error||feedError||threadError;
 function message(m:Message,data:Feed,inThread=false){const poll=data.polls.find(p=>p.message===m.id),votes=data.votes.filter(v=>v.message===m.id),total=votes.reduce((n,v)=>n+v.count,0),reactions=data.reactions.filter(r=>r.message===m.id);return <article key={m.id} className={'hub-message '+(m.author===me.id?'mine':'')}><div className="hub-avatar">{initials(m.name)}</div><div className="hub-message-main"><div className="hub-byline"><strong>{m.name}</strong><time>{new Date(m.scheduled||m.created).toLocaleString('fr-FR',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</time>{m.edited>0&&<small>modifié</small>}{m.pinned>0&&<Pin size={12}/>}</div>{m.scheduled>m.created&&<div className="hub-scheduled"><Clock size={13}/>Envoi programmé</div>}<p>{m.body}</p>{m.file&&<a className="hub-file" href={'/api/files?id='+m.file}><Paperclip size={18}/>{m.filename}</a>}{poll&&<div className="hub-poll"><div className="hub-poll-label"><BarChart3 size={15}/> Votes masqués aux membres · un choix</div>{poll.options.map((o,i)=>{const v=votes.find(v=>v.choice===i),percent=total?Math.round((v?.count||0)/total*100):0;return <button key={i} className={v?.mine?'voted':''} disabled={busy||!!poll.closed} onClick={()=>act('vote',{message:m.id,choice:i})}><span className="poll-bar" style={{width:percent+'%'}}/><span>{v?.mine?'✓ ':''}{o}</span><strong>{percent}%</strong></button>})}<footer><span>{total} vote{total!==1?'s':''} · {poll.closed?'Terminé':'Vous pouvez changer de choix'}</span>{!poll.closed&&(m.author===me.id||staff)&&<button disabled={busy} onClick={()=>act('poll_close',{message:m.id})}>Clore</button>}</footer></div>}<div className="hub-reactions">{reactions.map(r=><button key={r.emoji} className={r.mine?'chosen':''} disabled={busy} onClick={()=>act('react',{message:m.id,emoji:r.emoji,enabled:!r.mine})}>{r.emoji} {r.count}</button>)}<DropdownMenu><DropdownMenuTrigger className="add-reaction" aria-label="Réagir au message">☺ +</DropdownMenuTrigger><DropdownMenuContent>{emojis.map(emoji=><DropdownMenuItem key={emoji} onSelect={()=>act('react',{message:m.id,emoji,enabled:!reactions.some(r=>r.emoji===emoji&&r.mine)})}>{emoji} Réagir</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>{!inThread&&<button className="thread-link" onClick={()=>{setThread(m);setPanel('');setThreadText('');}}><MessageSquare size={14}/>{m.replies?`${m.replies} réponse${m.replies>1?'s':''}`:'Ouvrir un fil'}</button>}<DropdownMenu><DropdownMenuTrigger className="message-more" aria-label="Options du message">···</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem onSelect={()=>router.push('/signaler?kind=message&target='+encodeURIComponent(m.id))}>Signaler</DropdownMenuItem><DropdownMenuItem onSelect={()=>act('star',{message:m.id},true)}>{m.starred?'Retirer des favoris':'Enregistrer en favori'}</DropdownMenuItem>{staff&&<DropdownMenuItem onSelect={()=>act('pin',{message:m.id,enabled:!m.pinned})}>{m.pinned?'Désépingler':'Épingler'}</DropdownMenuItem>}{m.author===me.id&&!poll&&<DropdownMenuItem onSelect={()=>{setEdit(m);setEditText(m.body);setModal('edit');}}>Modifier mon message</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div></div></article>;}
 return <main className={'hub '+(mobile?'hub-mobile-chat':'')}><aside className="hub-channels"><nav className="community-mobile-rail" aria-label="Changer d’espace"><button className={!selected?'active':''} aria-label="Messages privés" aria-pressed={!selected} onClick={()=>{openSpace('',directs[0]?.id);setMobile(false);}}><MessageSquare size={17}/></button>{spaces.map(s=><button key={s.id} className={selected===s.id?'active':''} aria-label={s.name} aria-pressed={selected===s.id} onClick={()=>{openSpace(s.id);setMobile(false);}}><span>{initials(s.name)}</span></button>)}<CommunityPicker compact onCreate={()=>setModal('create')} onJoin={()=>setModal('join')}/></nav><div className="community-mobile-panel"><div className="stitch-page-topbar"><i/><span><small>LUMA • COMMUNAUTÉS</small><strong>Salons &amp; communautés</strong></span></div><header><span className="hub-brand">LUMA <b>COMMUNAUTÉS</b></span><div className="community-title"><div><h1>{space?.name||'Vos communautés'}</h1><p>{space?.description||'Choisissez un espace ou rejoignez vos proches.'}</p></div>{space&&staff&&<button title="Paramètres de la communauté" aria-label="Paramètres de la communauté" onClick={()=>{setPanel('settings');setThread(null);}}><Settings size={19}/></button>}</div></header><div className="hub-channel-tools"><button onClick={()=>setModal(selected?'invite':'join')}><ArrowUpRight size={16}/>{selected?'Inviter':'Rejoindre'}</button>{!selected||staff?<button onClick={()=>{setMode('text');setModal(selected?'channel':'create');}}><Plus size={16}/>{selected?'Créer un salon':'Créer'}</button>:<button disabled={!space||busy} onClick={()=>{setPanel('members');setThread(null);setMobile(true);}}><Users size={16}/>Membres</button>}</div><div className="community-switcher"><CommunityPicker onCreate={()=>setModal('create')} onJoin={()=>setModal('join')}/><button className={!selected?'active':''} onClick={()=>{openSpace('',directs[0]?.id);setMobile(false);}}><Users/>Messages privés</button>{spaces.map(s=><button key={s.id} className={selected===s.id?'active':''} onClick={()=>{openSpace(s.id);setMobile(false);}}><span>{initials(s.name)}</span>{s.name}</button>)}</div><div className="channel-list">{selected?<><div className="channel-section"><div className="channel-label"><span><Hash size={14}/>SALONS TEXTUELS <b>{channels.filter(c=>c.mode!=='voice').length}</b></span>{staff&&<button aria-label="Créer un salon textuel" onClick={()=>{setMode('text');setModal('channel');}}><Plus size={17}/></button>}</div>{channels.filter(c=>c.mode!=='voice').map(c=><button className={'channel '+(active===c.id?'active':'')} key={c.id} onClick={()=>{setActive(c.id);setMobile(true);setPanel('');}}>{c.mode==='announcement'?<Megaphone size={18}/>:<Hash size={19}/>}<span>{c.name}</span><small>{c.mode==='announcement'?'annonces':'texte'}</small></button>)}</div><div className="channel-section voice-section"><div className="channel-label"><span><Volume2 size={14}/>SALONS VOCAUX &amp; DIRECT <b>{channels.filter(c=>c.mode==='voice').length}</b></span>{staff&&<button aria-label="Créer un salon vocal" onClick={()=>{setMode('voice');setModal('channel');}}><Plus size={17}/></button>}</div>{channels.filter(c=>c.mode==='voice').map(c=>{const liveRoom=activeRooms[c.id];return <button className={'channel voice-channel '+(active===c.id?'active':'')+(liveRoom?' is-live':'')} key={c.id} onClick={()=>{if(liveRoom)router.push('/salle/'+encodeURIComponent(liveRoom.id));else{setActive(c.id);setMobile(true);setPanel('');}}}><Headphones size={19}/><span>{c.name}{liveRoom&&<b>{liveRoom.participants} en direct</b>}</span><small>{liveRoom?'rejoindre':'libre'}</small></button>})}</div></>:<><div className="channel-label"><span><MessageSquare size={14}/>DISCUSSIONS</span></div>{directs.map(c=><button className={'channel '+(active===c.id?'active':'')} key={c.id} onClick={()=>{setActive(c.id);setMobile(true);setPanel('');}}><MessageSquare size={18}/><span>{c.name}</span></button>)}</>}{(loading||spaceLoading)&&<p className="hub-small-empty" role="status">Chargement des salons…</p>}{!loading&&!spaceLoading&&!(selected?channels:directs).length&&<p className="hub-small-empty">{selected?'Aucun salon dans cette catégorie.':'Vos discussions privées apparaîtront ici.'}</p>}</div>{space&&<div className="hub-invite"><Shield size={20}/><strong>Accès sur invitation</strong><p>{members.length} membre{members.length>1?'s':''} · {channels.length} salon{channels.length>1?'s':''}</p><button onClick={()=>setModal('invite')}>Inviter <ArrowUpRight size={15}/></button></div>}<footer className="hub-profile"><div className="hub-avatar">{initials(me.name||'L')}</div><div><strong>{me.name||'Votre compte'}</strong><small>{role==='owner'?'Propriétaire':role==='moderator'?'Modérateur':'Membre'}</small></div><Link href="/parametres" aria-label="Paramètres du compte"><SlidersHorizontal size={18}/></Link></footer></div></aside>
 <section className="hub-conversation"><header className="hub-header"><button className="hub-back" aria-label="Retour aux salons" onClick={()=>setMobile(false)}><ArrowLeft size={20}/></button>{channel?.mode==='voice'?<Headphones className="channel-hash"/>:<Hash className="channel-hash"/>}<div><h2>{channel?.name||'Une place pour chaque conversation'}</h2><p>{channel?.topic||'Discussions, projets et communautés réunis.'}</p></div>{active&&<div className="hub-header-actions">{channel?.mode==='voice'&&<button className="voice-join" title="Rejoindre le salon vocal" onClick={joinVoice}><Headphones size={19}/><span>Rejoindre</span></button>}<button title="Messages épinglés" onClick={()=>{setPanel(panel==='pins'?'':'pins');setThread(null);}}><Pin size={19}/><span>{feed.pinned.length}</span></button><button title="Messages favoris" onClick={()=>{setPanel(panel==='saved'?'':'saved');setThread(null);}}><Bookmark size={19}/></button>{space&&<button title="Membres et rôles" onClick={()=>{setPanel(panel==='members'?'':'members');setThread(null);}}><Users size={20}/><span>{members.length}</span></button>}</div>}</header>
 {displayError&&<div className="hub-error" role="alert">{displayError}{(feedError||threadError)&&<button onClick={()=>{setFeedError('');setThreadError('');setRefreshTick(value=>value+1);}}>Réessayer</button>}{authRequired&&<Link href="/connexion?returnTo=%2Fcommunities">Se connecter</Link>}{!me.id&&!authRequired&&<button disabled={loading} onClick={()=>setListingTick(value=>value+1)}>Réessayer le chargement</button>}{me.id&&selected&&!space&&<button onClick={()=>void openSpace(selected)}>Réessayer cette communauté</button>}<button aria-label="Fermer l’erreur" onClick={()=>{setError('');setFeedError('');setThreadError('');}}><X size={16}/></button></div>}
 {active?<><form className="hub-search" onSubmit={search}><Search size={16}/><input placeholder="Rechercher dans tout l’historique de ce salon…" value={query} onChange={e=>setQuery(e.target.value)} maxLength={100}/><button disabled={busy}>Rechercher</button>{results&&<button type="button" aria-label="Effacer la recherche" onClick={()=>{setResults(null);setQuery('');}}><X size={16}/></button>}</form>{feed.pinned.length>0&&!results&&<button className="hub-pinned-banner" onClick={()=>{setPanel('pins');setThread(null);}}><Pin size={14}/><span>{feed.pinned[0].body.slice(0,100)||feed.pinned[0].filename}</span><span>{feed.pinned.length} épinglé{feed.pinned.length>1?'s':''}</span></button>}<div className="hub-messages">{results?<div className="hub-results-label">{results.length} résultat{results.length>1?'s':''}{results.length===50?' (50 maximum)':''}</div>:<><div className="hub-channel-intro"><div><Hash size={30}/></div><h3>Bienvenue dans {channel?.name}</h3><p>{channel?.mode==='announcement'?'Les annonces de la communauté. Réagissez et votez pour participer.':'Partagez une idée. Lancez un fil. Décidez ensemble.'}</p></div>{(older.messages.length?older.more:feed.more)&&<button className="load-older" disabled={busy} onClick={previous}>Charger les messages précédents</button>}</>}{(results||combined.messages).map(m=>message(m,combined))}{!results&&!feed.messages.length&&<div className="hub-empty-chat"><MessageSquare size={26}/><h3>Tout commence par un message.</h3><p>{canWrite?'Écrivez à votre communauté ou créez un premier sondage.':'Les modérateurs publieront les premières annonces ici.'}</p></div>}<div ref={last}/></div><div className="hub-composer-wrap">{canWrite?<><form className="hub-composer" onSubmit={e=>{e.preventDefault();send();}}><button type="button" title="Joindre un fichier" disabled={busy} onClick={()=>file.current?.click()}><Paperclip size={22}/></button><input aria-label="Message dans le salon" value={text} maxLength={10000} onChange={e=>setText(e.target.value)} placeholder={'Écrire dans '+(channel?.name||'ce salon')}/><button type="button" title="Créer un sondage" onClick={()=>setModal('poll')}><BarChart3 size={21}/></button><button type="button" title="Programmer un message" disabled={!text.trim()} onClick={()=>setModal('schedule')}><Clock size={20}/></button><button className="hub-send" aria-label="Envoyer" disabled={!text.trim()||busy}><Send size={19}/></button><input hidden type="file" ref={file} onChange={e=>e.target.files?.[0]&&upload(e.target.files[0])}/></form><div className="hub-composer-hint"><span>Entrée pour envoyer · Fichiers jusqu’à 20 Mo</span><span>Fils · Sondages · Réactions</span></div></>:<div className="hub-readonly"><Shield size={17}/>Seuls les modérateurs publient dans ce salon d’annonces.</div>}</div></>:<div className="hub-welcome"><div className="welcome-symbol"><Globe size={44}/></div><span className="welcome-label">VOTRE NOUVEAU POINT DE RENCONTRE</span><h2>Plus qu’un groupe.<br/>Votre communauté.</h2><p>Des salons pour chaque sujet, des fils pour aller au fond des idées et des sondages pour avancer ensemble.</p><div><button className="hub-primary" onClick={()=>setModal('create')}><Plus size={18}/>Créer une communauté</button><button className="hub-secondary" onClick={()=>setModal('join')}>J’ai une invitation</button></div><div className="welcome-features"><span><Hash/> Salons thématiques</span><span><BarChart3/> Sondages anonymes</span><span><Shield/> Rôles et annonces</span></div>{loading&&<p>Chargement de vos espaces…</p>}</div>}</section>
 {(thread||panel)&&<aside className={'hub-detail '+(panel==='settings'?'community-settings':'')}><header><h3>{thread?'Fil de discussion':panel==='settings'?'Paramètres de la communauté':panel==='members'?'Membres':panel==='pins'?'Messages épinglés':'Favoris de ce salon'}</h3><button aria-label="Fermer le panneau" onClick={()=>{setThread(null);setPanel('');}}><X size={20}/></button></header><div className="hub-detail-body">{panel==='settings'&&space?<div className="community-settings-body"><section><span className="settings-kicker">VUE D’ENSEMBLE</span><label>Nom de la communauté<input value={settingsName} maxLength={80} onChange={e=>setSettingsName(e.target.value)}/></label><label>Description<textarea value={settingsDescription} maxLength={300} onChange={e=>setSettingsDescription(e.target.value)}/></label><label>Règles<textarea value={rules} maxLength={4000} placeholder="Décrivez les règles visibles par vos membres…" onChange={e=>setRules(e.target.value)}/></label><button className="hub-primary" disabled={busy||!settingsName.trim()} onClick={saveCommunity}>Enregistrer</button></section><section><span className="settings-kicker">ACCÈS ET MEMBRES</span><div className="settings-stat"><strong>{members.length}</strong><span>Membres</span><strong>{channels.length}</strong><span>Salons</span></div><button className="settings-wide" onClick={()=>setModal('invite')}><Copy/>Gérer l’invitation</button>{members.map(m=><div className="hub-member" key={m.user}><div className="hub-avatar">{initials(m.name)}</div><div><strong>{m.name}</strong><small>{m.role==='owner'?'Propriétaire':m.role==='moderator'?'Modérateur':'Membre'}</small></div>{role==='owner'&&m.role!=='owner'&&<button disabled={busy} onClick={()=>void changeRole(m)}>{m.role==='moderator'?'Rétrograder':'Promouvoir'}</button>}</div>)}</section><section><span className="settings-kicker"><Bot size={15}/> BOTS ET AUTOMATISATIONS</span><p className="settings-copy">Activez les assistants intégrés. Ils fonctionnent uniquement dans cette communauté.</p><article className="bot-card"><div><Bot/><span><strong>Accueil</strong><small>Souhaite la bienvenue aux nouveaux membres.</small></span><Switch aria-label="Activer le bot d’accueil" checked={!!bots.find(b=>b.kind==='welcome')?.enabled} disabled={role!=='owner'||busy} onCheckedChange={checked=>saveBot('welcome',checked)}/></div><label>Message<input value={welcome} maxLength={500} onChange={e=>setWelcome(e.target.value)}/><small>Utilisez {'{user}'} pour insérer le pseudo.</small></label></article><article className="bot-card"><div><Shield/><span><strong>AutoMod</strong><small>Bloque les messages contenant certains termes.</small></span><Switch aria-label="Activer AutoMod" checked={!!bots.find(b=>b.kind==='moderation')?.enabled} disabled={role!=='owner'||busy} onCheckedChange={checked=>saveBot('moderation',checked)}/></div><label>Termes bloqués<input value={blockedWords} placeholder="terme 1, terme 2" onChange={e=>setBlockedWords(e.target.value)}/></label></article><article className="bot-card"><div><Clock/><span><strong>Résumé</strong><small>Prépare le récapitulatif quotidien de l’activité.</small></span><Switch aria-label="Activer le résumé" checked={!!bots.find(b=>b.kind==='digest')?.enabled} disabled={role!=='owner'||busy} onCheckedChange={checked=>saveBot('digest',checked)}/></div></article>{role!=='owner'&&<p className="settings-copy">Seul le propriétaire peut modifier les bots.</p>}</section></div>:thread?threadFeed.messages.map(m=>message(m,threadFeed,true)):panel==='members'?members.map(m=><div className="hub-member" key={m.user}><div className="hub-avatar">{initials(m.name)}</div><div><strong>{m.name}</strong><small>{m.role==='owner'?'Propriétaire':m.role==='moderator'?'Modérateur':'Membre'}</small></div></div>):(panel==='pins'?feed.pinned:saved).map(m=>message(m,combined,true))}{!thread&&!['members','settings'].includes(panel)&&!(panel==='pins'?feed.pinned:saved).length&&<p className="hub-small-empty">Aucun message pour le moment.</p>}</div>{thread&&canWrite&&<form className="thread-composer" onSubmit={e=>{e.preventDefault();send(true);}}><input aria-label="Réponse dans le fil" placeholder="Répondre dans ce fil…" value={threadText} onChange={e=>setThreadText(e.target.value)} maxLength={10000}/><button aria-label="Envoyer la réponse" disabled={busy||!threadText.trim()}><Send size={18}/></button></form>}</aside>}
 <Dialog open={!!modal} onOpenChange={o=>!o&&setModal('')}><DialogContent className="hub-dialog"><DialogTitle>{({create:'Créer une communauté',join:'Rejoindre une communauté',channel:'Créer un salon',poll:'Faire un sondage',invite:'Inviter votre communauté',schedule:'Programmer un message',edit:'Modifier mon message'} as Record<string,string>)[modal]}</DialogTitle><DialogDescription>{modal==='poll'?'Un vote par personne. Les résultats ne révèlent pas les votants.':modal==='invite'?'Le code donne accès à tous les salons de cette communauté. Le site doit également être partagé avec vos invités.':'Organisez vos échanges à votre façon.'}</DialogDescription>{['create','channel'].includes(modal)&&<><label>Nom<input value={name} onChange={e=>setName(e.target.value)} maxLength={60} placeholder={modal==='create'?'Ex. Les créatifs':'Ex. idées-et-inspirations'}/></label><label>{modal==='create'?'Description':'Sujet du salon'}<input value={description} onChange={e=>setDescription(e.target.value)} maxLength={200} placeholder="À quoi sert cet espace ?"/></label>{modal==='channel'&&<Tabs value={mode} onValueChange={setMode}><TabsList><TabsTrigger value="text">Discussion</TabsTrigger><TabsTrigger value="announcement">Annonces</TabsTrigger><TabsTrigger value="voice">Vocal</TabsTrigger></TabsList></Tabs>}<button className="hub-primary" disabled={busy||!name.trim()} onClick={submitForm}>Créer {modal==='create'?'ma communauté':'le salon'}</button></>}{modal==='join'&&<><label>Code d’invitation<input value={code} onChange={e=>setCode(e.target.value)} placeholder="Collez le code reçu"/></label><button className="hub-primary" disabled={busy||!code.trim()} onClick={submitForm}>Rejoindre</button></>}{modal==='poll'&&<><label>Votre question<input value={question} onChange={e=>setQuestion(e.target.value)} maxLength={200} placeholder="Quand se retrouve-t-on ?"/></label>{options.map((o,i)=><label key={i}>Réponse {i+1}<input value={o} onChange={e=>setOptions(options.map((v,j)=>i===j?e.target.value:v))} maxLength={100}/></label>)}{options.length<8&&<button className="hub-secondary" onClick={()=>setOptions([...options,''])}>+ Ajouter une réponse</button>}<button className="hub-primary" disabled={busy||!question.trim()||options.some(o=>!o.trim())} onClick={submitForm}>Publier le sondage</button></>}{modal==='invite'&&space&&<><code className="invite-code">{space.invite}</code><button className="hub-primary" onClick={()=>copy(space.invite)}><Copy size={17}/>Copier l’invitation</button>{role==='owner'&&<button className="hub-secondary" disabled={busy} onClick={()=>void rotateInvite()}>Créer un nouveau code et invalider l’ancien</button>}</>}{modal==='schedule'&&<><label>Date et heure<input type="datetime-local" value={schedule} onChange={e=>setSchedule(e.target.value)}/></label><p>{text}</p><button className="hub-primary" disabled={busy||!schedule} onClick={()=>send()}>Programmer l’envoi</button></>}{modal==='edit'&&<><label>Message<textarea value={editText} maxLength={10000} onChange={e=>setEditText(e.target.value)}/></label><button className="hub-primary" disabled={busy||!editText.trim()} onClick={submitForm}>Enregistrer les modifications</button></>}{error&&<p className="hub-error" role="alert">{error}</p>}</DialogContent></Dialog>{notice&&<div className="hub-toast" role="status">{notice}</div>}</main>;
}




