'use client';
import { Fragment, useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {ClientRequestError,requestJson} from '@/lib/client-request';
import {isAppVisible,watchAppVisibility} from '@/lib/app-visibility';
import {useChatRead} from '@/hooks/use-chat-read';
import type {ReadCursor} from '@/lib/chat-reads';
import {ArrowDown} from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Chat = {
  id: string;
  name: string;
  kind: string;
  preview?: string;
  invite?: string;
  time?: string;
  unread?: number;
};

type Msg = {
  id: string;
  body: string;
  author: string;
  name: string;
  created: number;
  scheduled: number;
  activity_at?:number;
  scheduled_pending?:number;
  file?: string;
  filename?: string;
  reply?: string;
  starred?: number;
};

type ActiveRoom = { id: string; participants: number; mode: string };
type Draft = {text:string;reply:Msg|null;schedule:string};
const emptyDraft:Draft={text:'',reply:null,schedule:''};

export default function Messenger() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<string>('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [drafts,setDrafts]=useState<Record<string,Draft>>({});
  const draft=drafts[active]||emptyDraft;
  const {text,reply,schedule}=draft;
  const setText=(value:string|((current:string)=>string))=>setDrafts(current=>({...current,[active]:{...(current[active]||emptyDraft),text:typeof value==='function'?value(current[active]?.text||''):value}}));
  const setReply=(value:Msg|null)=>setDrafts(current=>({...current,[active]:{...(current[active]||emptyDraft),reply:value}}));
  const setSchedule=(value:string)=>setDrafts(current=>({...current,[active]:{...(current[active]||emptyDraft),schedule:value}}));
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'groups' | 'unread'>('all');
  const [view, setView] = useState<'chat' | 'saved'>('chat');
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<string>('');
  const [detail, setDetail] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'group' | 'direct'>('group');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [writeErrors,setWriteErrors]=useState<Record<string,string>>({});
  const [notice, setNotice] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [readSnapshot,setReadSnapshot]=useState('');
  const [atLatest,setAtLatest]=useState(true);
  const listEpoch=useRef(0);
  const composeLock=useRef(false),activeRef=useRef(active),mounted=useRef(true);
  const sendAttempts=useRef(new Map<string,{fingerprint:string;id:string}>());
  useEffect(()=>{activeRef.current=active;},[active]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  const refreshAfterWrite=(chat:string)=>{
    window.dispatchEvent(new Event('luma-chat-list-refresh'));
    window.dispatchEvent(new CustomEvent('luma-chat-messages-refresh',{detail:chat}));
  };
  const [activeRooms, setActiveRooms] = useState<Record<string, ActiveRoom>>({});

  const history=useRef<HTMLElement>(null),followLatest=useRef(true),firstHistory=useRef(true);
  const file = useRef<HTMLInputElement>(null);
  const composer=useRef<HTMLTextAreaElement>(null);
  useEffect(()=>{const field=composer.current;if(field){field.style.height='auto';field.style.height=Math.min(field.scrollHeight,144)+'px';}},[text,active]);
  const searchInput = useRef<HTMLInputElement>(null);
  const mobileMenu=useRef<HTMLDetailsElement>(null);
  const searchFrame = useRef<number|null>(null);
  const focusDiscussions = useCallback(() => {
    setMobile(false);
    setFilter('all');
    if(searchFrame.current!==null)cancelAnimationFrame(searchFrame.current);
    searchFrame.current=requestAnimationFrame(()=>{searchFrame.current=null;searchInput.current?.focus();searchInput.current?.select();});
  },[]);
  useEffect(()=>{
    const focus=()=>focusDiscussions();
    window.addEventListener('luma-search-discussions',focus);
    const dismiss=(event:PointerEvent)=>{if(mobileMenu.current?.open&&event.target instanceof Node&&!mobileMenu.current.contains(event.target))mobileMenu.current.open=false;};
    window.addEventListener('pointerdown',dismiss);
    let live=true;
    if(new URLSearchParams(window.location.search).get('recherche')==='1')queueMicrotask(()=>{if(live)focus();});
    return()=>{live=false;window.removeEventListener('luma-search-discussions',focus);window.removeEventListener('pointerdown',dismiss);if(searchFrame.current!==null)cancelAnimationFrame(searchFrame.current);};
  },[focusDiscussions]);

  const activeChat = useMemo(() => {
    return chats.find((c) => c.id === active);
  }, [chats, active]);

  const api = useCallback(async (action:string,data:Record<string,unknown>={},signal?:AbortSignal) => requestJson<{
    error?:string;chats:Chat[];user:{id:string;name:string};messages:Msg[];id:string;readCursor?:ReadCursor;unread?:number;
  }>('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...data}),signal}),[]);

  const confirmRead=useCallback((chat:string,unread:number)=>{
    listEpoch.current++;
    setChats(current=>current.map(item=>item.id===chat?{...item,unread}:item));
  },[]);
  useChatRead({active,mobile,blocked:view!=='chat'||detail||!!modal,snapshot:readSnapshot,viewport:history,api,onRead:confirmRead});
  useEffect(()=>{
    let live=true,pending=false;const controller=new AbortController();
    const refresh=async()=>{
      if(!live||pending||!isAppVisible())return;pending=true;const epoch=listEpoch.current;
      try{
        const result=await api('list',{},controller.signal);
        if(live&&epoch===listEpoch.current&&Array.isArray(result.chats)){
          const rows=result.chats;setChats(current=>JSON.stringify(current)===JSON.stringify(rows)?current:rows);
          setActive(current=>!current||rows.some(chat=>chat.id===current)?current:'');
        }
      }catch(error){if(live&&error instanceof ClientRequestError&&error.status===401){setChats([]);setActive('');setMe('');setError('Votre session a expiré. Reconnectez-vous.');}}
      finally{pending=false;if(live&&epoch!==listEpoch.current)queueMicrotask(()=>void refresh());}
    };
    const update=()=>{void refresh();};const timer=setInterval(update,4000);
    window.addEventListener('luma-chat-list-refresh',update);const unwatch=watchAppVisibility(update);
    return()=>{live=false;controller.abort();clearInterval(timer);window.removeEventListener('luma-chat-list-refresh',update);unwatch();};
  },[api]);

  async function startCall(mode: 'audio' | 'video') {
    if (busy || !activeChat) return;
    setBusy(true);
    setError('');
    try {
      const group = activeChat.kind === 'group';
      const r = await fetch(group ? '/api/rooms' : '/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', chat: activeChat.id, mode }),
      });
      const d = (await r.json()) as { id: string; error?: string };
      if (!r.ok) throw Error(d.error || 'Appel indisponible');
      router.push((group ? '/salle/' : '/appel/') + encodeURIComponent(d.id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api('list');
      const loadedChats = d.chats || [];
      setChats(loadedChats);
      if (d.user) {
        setMe(d.user.id);
      }
      const requested=new URLSearchParams(window.location.search).get('chat');
      if(requested&&loadedChats.some(chat=>chat.id===requested)){setActive(requested);setMobile(true);}
      else setActive(current=>loadedChats.some(chat=>chat.id===current)?current:'');
      setError('');
    } catch (e) {
      setChats([]);
      setActive('');
      setError((e as Error).message || 'Impossible de charger vos discussions.');
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) void load();
    });
    return () => {
      mounted = false;
    };
  }, [load]);

  useEffect(() => {
    const groups = chats.filter((chat) => chat.kind === 'group').slice(0, 12);
    if (!groups.length) {
      queueMicrotask(() => setActiveRooms({}));
      return;
    }
    let live = true;
    const refresh = async () => {
      const rows = await Promise.all(groups.map(async (chat) => {
        try {
          const response = await fetch('/api/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'active', chat: chat.id }), cache: 'no-store' });
          if (!response.ok) return [chat.id, null] as const;
          const data = await response.json() as { room: ActiveRoom | null };
          return [chat.id, data.room] as const;
        } catch { return [chat.id, null] as const; }
      }));
      if (live) setActiveRooms(Object.fromEntries(rows.filter((row): row is readonly [string, ActiveRoom] => !!row[1])));
    };
    void refresh();
    const timer = setInterval(refresh, 8000);
    return () => { live = false; clearInterval(timer); };
  }, [chats]);

  useEffect(() => {
    let live=true,pending=false,initial=true,queued=false;const controller=new AbortController();
    followLatest.current=true;firstHistory.current=true;
    queueMicrotask(()=>{if(live){setMsgs([]);setReadSnapshot('');setAtLatest(true);if(!active)setMessagesLoading(false);}});
    if(!active)return()=>{live=false;controller.abort();};
    const update=async()=>{
      if(!live||pending||!isAppVisible())return;pending=true;if(initial)setMessagesLoading(true);
      try{
        const result=await api('messages',{chat:active},controller.signal);
        if(live&&Array.isArray(result.messages)){
          setMsgs(result.messages);setReadSnapshot(result.readCursor?JSON.stringify({chat:active,cursor:result.readCursor}):'');setError('');initial=false;
        }
      }catch(error){if(live)setError(error instanceof Error?error.message:'Impossible de charger les messages.');}
      finally{pending=false;if(live){setMessagesLoading(false);if(queued){queued=false;void update();}}}
    };
    const resume=()=>{void update();};void update();const timer=setInterval(resume,3500);
    const unwatch=watchAppVisibility(resume);
    const written=(event:Event)=>{if((event as CustomEvent<string>).detail!==active)return;if(pending)queued=true;else void update();};
    window.addEventListener('luma-chat-messages-refresh',written);
    return()=>{live=false;controller.abort();clearInterval(timer);unwatch();window.removeEventListener('luma-chat-messages-refresh',written);};
  },[active,api]);

  const lastMessage=msgs[msgs.length-1]?.id||'';
  useEffect(()=>{
    if(!lastMessage||!followLatest.current||!history.current)return;
    history.current.scrollTo({top:history.current.scrollHeight,behavior:firstHistory.current||document.documentElement.dataset.motion==='reduced'?'auto':'smooth'});firstHistory.current=false;
  },[lastMessage,active,view]);

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 3500);
      return () => clearTimeout(t);
    }
  }, [notice]);

  async function send(programmed = false) {
    if (!text.trim() || busy || composeLock.current || !activeChat) return;
    const chat=active,submittedDraft=draft;
    const scheduled=programmed&&schedule?new Date(schedule).getTime():0;
    const payload={chat,body:text,scheduled,reply:reply?.id};
    const fingerprint=JSON.stringify(payload),previous=sendAttempts.current.get(chat);
    const retry=previous?.fingerprint===fingerprint;
    if (programmed && (!Number.isSafeInteger(scheduled)||!schedule||scheduled<=Date.now()&&!retry)) {
      setError('Choisissez une date future.');
      return;
    }
    composeLock.current=true;setBusy(true);
    const attempt=retry?previous:{fingerprint,id:crypto.randomUUID()};
    sendAttempts.current.set(chat,attempt);
    try {
      await api('send',{...payload,clientId:attempt.id});
      sendAttempts.current.delete(chat);
      if(!mounted.current)return;
      setWriteErrors(current=>({...current,[chat]:''}));
      setDrafts(current=>current[chat]===submittedDraft?{...current,[chat]:emptyDraft}:current);
      if(activeRef.current===chat){followLatest.current=true;setModal('');setError('');}
      refreshAfterWrite(chat);
    } catch (e) {
      if(mounted.current)setWriteErrors(current=>({...current,[chat]:(e as Error).message || 'Le message n’a pas été envoyé.'}));
    } finally {
      composeLock.current=false;if(mounted.current)setBusy(false);
    }
  }

  async function create(join = false) {
    setBusy(true);
    try {
      const d = await api(join ? 'join' : 'create', join ? { code } : { name, kind });
      await load();
      setActive(d.id);
      setMobile(true);
      setModal('');
      setName('');
      setCode('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(f: File) {
    if(!activeChat||busy||composeLock.current)return;
    if (f.size > 20 * 1024 * 1024) {
      setNotice('Taille maximale : 20 Mo.');
      return;
    }
    const chat=active;composeLock.current=true;setBusy(true);
    try {
      const form = new FormData();
      form.append('file', f);
      form.append('chat', chat);
      await requestJson('/api/files',{method:'POST',body:form},60000);
      if(!mounted.current)return;
      setWriteErrors(current=>({...current,[chat]:''}));
      if(activeRef.current===chat){followLatest.current=true;setError('');}
      refreshAfterWrite(chat);
    } catch (e) {
      if(mounted.current)setWriteErrors(current=>({...current,[chat]:(e as Error).message}));
    } finally {
      composeLock.current=false;if(mounted.current)setBusy(false);
      if (file.current) file.current.value = '';
    }
  }

  async function star(m: Msg) {
    const chat=active;
    try {
      await api('star', { message: m.id });
      if(mounted.current)refreshAfterWrite(chat);
    } catch (e) {
      if(mounted.current&&activeRef.current===chat)setError((e as Error).message);
    }
  }

  const copy = (s: string) =>
    navigator.clipboard
      .writeText(s)
      .then(() => setNotice('Copié dans le presse-papiers'))
      .catch(() => setNotice('Copie indisponible'));

  const initials = (s: string) =>
    s
      .split(' ')
      .slice(0, 2)
      .map((x) => x[0])
      .join('');

  const shownChats = chats.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    if (filter === 'groups') return matchesSearch && c.kind === 'group';
    if (filter === 'unread') return matchesSearch && (c.unread || 0) > 0;
    return matchesSearch;
  });
  const shownMessages = view === 'saved' ? msgs.filter((message) => Boolean(message.starred)) : msgs;

  function attachment(message: Msg) {
    if (!message.file) return null;
    const href = `/api/files?id=${encodeURIComponent(message.file)}`;
    const filename = message.filename || 'Pièce jointe';
    return (
      <a className="stitch-message-file" href={href} target="_blank" rel="noreferrer">
        <span className="material-symbols-outlined">attach_file</span>
        <span>{filename}</span>
        <span className="material-symbols-outlined">open_in_new</span>
      </a>
    );
  }

  return (
    <div className={`stitch-messenger-root flex flex-col w-full h-[calc(100vh-2.5rem)] select-none ${mobile ? 'mobile-chat' : ''}`}>
      {/* 2-Pane Messenger Interface */}
      <div className="grid grid-cols-12 gap-0 w-full h-full overflow-hidden bg-surface-container-lowest">
        
        {/* =========================================================================
            Left Discussion Pane (List of chats)
            ========================================================================= */}
        <aside className="col-span-12 md:col-span-5 lg:col-span-4 xl:col-span-3 flex flex-col h-full bg-surface-container-low/60 backdrop-blur-md relative z-10 border-r border-white/5">
          {/* Ambient Glow */}
          <div className="absolute -top-16 -left-16 w-56 h-56 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          <div className="stitch-mobile-topbar" aria-label="En-tête de la messagerie">
            <span className="stitch-live-mark" aria-hidden="true"><i /></span>
            <span className="stitch-mobile-topbar-copy"><small>LUMA <b>•</b> MESSAGERIE</small><strong>Messages &amp; Discussions</strong></span>
            <button type="button" aria-label="Rechercher" onClick={focusDiscussions}><span className="material-symbols-outlined">search</span></button>
            <button type="button" aria-label="Nouvelle discussion" onClick={() => setModal('new')}><span className="material-symbols-outlined">edit_square</span></button>
          </div>

          {/* Header: Title + Action */}
          <div className="p-space-lg pb-space-sm flex items-center justify-between">
            <div>
              <div className="flex items-center gap-space-xs">
                <span className="font-label-caps text-label-caps tracking-widest text-primary font-bold uppercase">Luma</span>
                <span className="w-1 h-1 rounded-full bg-outline-variant" />
                <span className="font-label-caps text-label-caps tracking-wider text-on-surface-variant uppercase">Messagerie</span>
              </div>
              <h1 className="font-headline-lg text-headline-lg text-on-surface mt-space-xs tracking-tight">Discussions</h1>
            </div>
            <button
              aria-label="Nouvelle conversation"
              className="w-9 h-9 rounded-xl bg-surface-container-high hover:bg-secondary-container hover:text-on-secondary-container text-on-surface flex items-center justify-center transition-all duration-200 group shadow-sm cursor-pointer"
              type="button"
              onClick={() => setModal('new')}
            >
              <span className="material-symbols-outlined text-[20px] group-hover:rotate-90 transition-transform duration-200">add</span>
            </button>
          </div>

          {/* Quick Search Bar with shortcut */}
          <div className="px-space-lg py-space-xs">
            <div className="relative flex items-center rounded-xl bg-surface-container-lowest hover:bg-surface-container transition-colors px-space-md py-space-xs border border-white/5">
              <span className="material-symbols-outlined text-outline text-[18px]">search</span>
              <input
                ref={searchInput}
                className="w-full bg-transparent text-body-sm font-body-sm text-on-surface placeholder:text-outline focus:outline-none pl-space-sm pr-space-md py-1"
                placeholder="Rechercher une discussion..."
                aria-label="Rechercher une discussion"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd className="font-label-caps text-label-caps px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant shadow-inner">
                Ctrl/⌘ K
              </kbd>
            </div>
          </div>

          {!loading && chats.length > 0 && (
            <section className="stitch-recent-chats" aria-label="Contacts et groupes récents">
              <header><span>CONTACTS &amp; GROUPES</span><small>{chats.length} discussion{chats.length > 1 ? 's' : ''}</small></header>
              <div>
                {chats.slice(0, 6).map((chat) => (
                  <button
                    type="button"
                    key={chat.id}
                    onClick={() => {
                      setActive(chat.id);
                      setDetail(false);
                      setMobile(true);
                    }}
                  >
                    <i>{chat.kind === 'group' ? <span className="material-symbols-outlined">groups</span> : initials(chat.name)}{activeRooms[chat.id]&&<b className="stitch-live-dot"/>}</i>
                    <span>{chat.name}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Filter Tabs */}
          <div className="px-space-lg pt-space-sm pb-space-xs flex items-center gap-space-xs">
            <button
              className={`px-space-md py-1 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => { setFilter('all'); setView('chat'); }}
            >
              Toutes
            </button>
            <button
              className={`px-space-md py-1 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                filter === 'unread'
                  ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => { setFilter('unread'); setView('chat'); }}
            >
              <span>Non lus</span>
            </button>
            <button
              className={`px-space-md py-1 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                filter === 'groups'
                  ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => { setFilter('groups'); setView('chat'); }}
            >
              Groupes
            </button>
            <button
              className={`px-space-md py-1 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                view === 'saved'
                  ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => setView(view === 'saved' ? 'chat' : 'saved')}
            >
              Favoris
            </button>
          </div>

          {/* Section Title & Counter */}
          <div className="px-space-lg pt-space-md pb-space-xs flex items-center justify-between text-outline">
            <span className="font-label-caps text-label-caps tracking-wider uppercase font-bold">Vos discussions</span>
            <span className="font-label-caps text-label-caps">{shownChats.length} conversations</span>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-space-sm space-y-1 py-space-xs">
            {loading&&<p className="p-space-md text-body-sm text-outline">Chargement de vos discussions…</p>}
            {!loading&&error&&<p className="p-space-md text-body-sm text-error" role="alert">{error}</p>}
            {!loading&&!error&&!shownChats.length&&<p className="p-space-md text-body-sm text-outline">{search?'Aucune discussion ne correspond à votre recherche.':filter==='unread'?'Aucune discussion non lue.':filter==='groups'?'Aucun groupe dans vos discussions.':'Aucune discussion. Utilisez le bouton + pour en créer une ou rejoindre un groupe.'}</p>}
            {shownChats.map((c, i) => {
              const isSelected = c.id === active;
              const isGroup = c.kind === 'group';

              // Visual styling per item
              let avatarBg = 'bg-secondary-container text-on-secondary-container';
              if (i === 1) {
                avatarBg = 'bg-surface-container-highest text-on-surface';
              } else if (i === 2) {
                avatarBg = 'bg-tertiary-container text-on-tertiary-container';
              } else if (i >= 3) {
                avatarBg = 'bg-surface-container text-on-surface-variant';
              }

              return (
                <div
                  key={c.id}
                  role="button"
                  tabIndex={0}
                  aria-label={'Ouvrir la discussion avec '+c.name}
                  onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();event.currentTarget.click();}}}
                  className={`relative group cursor-pointer p-space-sm rounded-xl transition-all duration-150 flex items-center gap-space-md ${
                    isSelected
                      ? 'bg-surface-container-high/90 text-on-surface shadow-sm'
                      : 'hover:bg-surface-container/70 text-on-surface-variant hover:text-on-surface'
                  }`}
                  onClick={() => {
                    setActive(c.id);
                    setDetail(false);
                    setMobile(true);
                  }}
                >
                  {/* Left Active indicator bar */}
                  {isSelected && <div className="absolute left-0 top-2 bottom-2 w-1 bg-primary rounded-r-full" />}

                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center font-title-sm text-title-sm shadow-inner ${avatarBg}`}>
                      {isGroup ? (
                        <span className="material-symbols-outlined text-[20px]">graphic_eq</span>
                      ) : (
                        initials(c.name)
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-space-xs mb-0.5">
                      <span className="font-title-sm text-title-sm text-on-surface truncate font-semibold">{c.name}</span>
                      <span
                        className={`font-label-caps text-label-caps whitespace-nowrap ${
                          isSelected ? 'text-primary-fixed-dim font-bold' : 'text-outline'
                        }`}
                      >
                        {c.time || ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-space-xs">
                      <p className={`font-body-sm text-body-sm truncate ${isSelected ? 'text-on-surface-variant' : 'text-outline'}`}>
                        {c.preview || 'Commencez la conversation'}
                      </p>
                      {c.unread ? (
                        <span className="font-label-caps text-label-caps px-1.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold flex-shrink-0" aria-label={c.unread+' message'+(c.unread!==1?'s':'')+' non lu'+(c.unread!==1?'s':'')}>
                          {c.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {Object.entries(activeRooms).slice(0,1).map(([chatId,room])=>{
            const chat=chats.find(item=>item.id===chatId);
            return <button type="button" className="stitch-live-room" key={room.id} onClick={()=>router.push('/salle/'+encodeURIComponent(room.id))}><span className="material-symbols-outlined">graphic_eq</span><span><strong>{chat?.name||'Salon vocal'}</strong><small>{room.participants} participant{room.participants!==1?'s':''} en direct</small></span><b>Rejoindre</b></button>;
          })}

        </aside>

        {/* =========================================================================
            Right Main Stage (Active Conversation Pane)
            ========================================================================= */}
        <main className="col-span-12 md:col-span-7 lg:col-span-8 xl:col-span-9 flex flex-col h-full bg-surface relative overflow-hidden">
          {!activeChat?<section className="messenger-empty-choice"><span className="material-symbols-outlined" aria-hidden="true">forum</span><h2>Sélectionnez une discussion</h2><p>Retrouvez vos messages en choisissant un contact ou un groupe.</p><button type="button" onClick={focusDiscussions}>Choisir une discussion</button><button type="button" onClick={()=>setModal('new')}>Nouvelle discussion</button></section>:<>
          {/* Top Subtle Gradient Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-48 bg-secondary-container/15 rounded-full blur-[100px] pointer-events-none" />

          {/* Chat Header */}
          <header className="h-16 px-space-lg flex items-center justify-between bg-surface-container-lowest/70 backdrop-blur-xl z-20 shadow-sm flex-shrink-0 border-b border-white/5">
            <div className="flex items-center gap-space-md">
              <button className="stitch-mobile-back" type="button" aria-label="Revenir aux discussions" onClick={()=>setMobile(false)}><span className="material-symbols-outlined">arrow_back</span></button>
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-title-sm text-title-sm shadow-md">
                  {initials(activeChat?.name || 'Luma')}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-space-xs">
                  <h2 className="font-title-sm text-title-sm text-on-surface font-bold">{activeChat?.name || 'Sélectionnez une discussion'}</h2>
                  <span
                    className="material-symbols-outlined text-[16px] text-tertiary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    title="Espace Luma privé"
                  >
                    lock
                  </span>
                </div>
                <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-outline">
                  <span>{activeChat?.kind==='group'?'Conversation de groupe':'Discussion privée'}</span>
                </div>
              </div>
            </div>

            {/* Header Interactive Actions */}
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                title="Appel vocal"
                aria-label="Appel vocal"
                type="button"
                disabled={!activeChat||busy}
                onClick={() => startCall('audio')}
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
              </button>
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                title="Appel vidéo"
                aria-label="Appel vidéo"
                type="button"
                disabled={!activeChat||busy}
                onClick={() => startCall('video')}
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span>
              </button>
              <button
                className={`w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer ${view === 'saved' ? 'text-primary ring-1 ring-primary' : ''}`}
                title="Messages favoris"
                aria-label="Messages favoris"
                type="button"
                aria-pressed={view === 'saved'}
                onClick={() => setView(view === 'saved' ? 'chat' : 'saved')}
              >
                <span className="material-symbols-outlined text-[18px]">push_pin</span>
              </button>
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                title="Rechercher une discussion"
                aria-label="Rechercher une discussion"
                type="button"
                onClick={focusDiscussions}
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
              </button>
              <div className="w-px h-5 bg-surface-container-high mx-space-xs" />
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center transition-all cursor-pointer"
                title="Options et profil"
                aria-label="Options et profil"
                type="button"
                disabled={!activeChat}
                onClick={() => setDetail(!detail)}
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>
              <details ref={mobileMenu} className="messenger-mobile-menu" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.currentTarget.open=false;event.currentTarget.querySelector('summary')?.focus();}}}>
                <summary aria-label="Options de la discussion"><span className="material-symbols-outlined" aria-hidden="true">more_vert</span></summary>
                <div>
                  <button type="button" className="messenger-menu-action" onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');focusDiscussions();}}>Rechercher une discussion</button>
                  <button type="button" className="messenger-menu-action" aria-pressed={view==='saved'} onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');setView(view==='saved'?'chat':'saved');}}>Messages favoris</button>
                  <button type="button" className="messenger-menu-action" disabled={!activeChat} onClick={event=>{event.currentTarget.closest('details')?.removeAttribute('open');setDetail(true);}}>Informations de la discussion</button>
                </div>
              </details>
            </div>
          </header>

          {/* Message History Canvas */}
          <section ref={history} onScroll={event=>{const pane=event.currentTarget;const latest=pane.scrollHeight-pane.scrollTop-pane.clientHeight<=64;followLatest.current=latest;setAtLatest(latest);}} className="flex-1 overflow-y-auto p-space-lg space-y-space-lg flex flex-col">
            <div className="mt-auto shrink-0" aria-hidden="true"/>
            {messagesLoading&&<p className="mx-auto text-body-sm text-outline">Actualisation…</p>}
            {/* Security Encryption Notice */}
            <div className="mx-auto max-w-md p-space-sm rounded-xl bg-surface-container-lowest/60 text-center text-outline font-label-caps text-label-caps flex items-center justify-center gap-space-xs border border-white/5">
              <span className="material-symbols-outlined text-[14px] text-primary">lock</span>
              <span>Cette discussion est réservée à ses participants dans votre espace Luma.</span>
            </div>

            {/* Message Stream */}
            {view === 'saved' && !shownMessages.length && !messagesLoading && (
              <div className="stitch-saved-empty">
                <span className="material-symbols-outlined">bookmark</span>
                <strong>Aucun message favori</strong>
                <small>Utilisez l’étoile sous un message pour le retrouver ici.</small>
              </div>
            )}
            {shownMessages.map((m,index) => {
              const isMine = m.author === me;
              const day=new Date(m.activity_at??m.created).toLocaleDateString('fr-FR',{dateStyle:'long'});
              const previous=shownMessages[index-1];
              const dayDivider=(!previous||new Date(previous.activity_at??previous.created).toLocaleDateString('fr-FR',{dateStyle:'long'})!==day)&&<div className="messenger-day-divider"><time dateTime={new Date(m.activity_at??m.created).toISOString()}>{day}</time></div>;
              const formattedTime = new Date(m.activity_at??m.created).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              if (isMine) {
                // Sent Message (Right)
                return (
                  <Fragment key={m.id}>{dayDivider}
                  <div key={m.id} className="flex flex-col items-end gap-1 ml-auto max-w-xl group">
                    <div className="flex items-center gap-space-sm pr-1">
                      <span className="font-label-caps text-label-caps text-outline">Vous</span>
                      <span className="font-label-caps text-label-caps text-outline">{formattedTime}</span>
                    </div>

                    <div className="relative group/bubble bg-secondary-container text-on-secondary-container px-space-md py-space-sm rounded-2xl rounded-tr-sm shadow-lg shadow-secondary-container/20">
                      {!!m.scheduled_pending&&<p className="text-label-caps font-label-caps mb-2">Programmé pour {new Date(m.scheduled).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}</p>}
                      <div className="flex items-center gap-space-sm">
                        <p className="messenger-message-body font-body-md text-body-md">
                          {m.body}
                        </p>
                        <button
                          className="p-1 rounded hover:bg-surface-container-highest/40 text-on-secondary-container/70 hover:text-white transition-colors cursor-pointer"
                          onClick={() => copy(m.body)}
                          title="Copier le message"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        </button>
                      </div>
                      {attachment(m)}

                      <div className="flex items-center justify-end gap-1 mt-1 text-primary-fixed-dim">
                        <span className="font-label-caps text-label-caps">{formattedTime}</span>
                        <span
                          className="material-symbols-outlined text-[15px] text-tertiary"
                          aria-label={m.scheduled_pending?'Message programmé':'Envoyé'} title={m.scheduled_pending?'Message programmé':'Envoyé'}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {m.scheduled_pending?'schedule':'check'}
                        </span>
                      </div>

                    </div>

                    {/* Micro Quick actions below bubble */}
                    <div className="flex items-center gap-space-md pr-1 opacity-0 group-hover:opacity-100 transition-opacity text-outline font-label-caps text-label-caps">
                      <button
                        className="hover:text-on-surface flex items-center gap-0.5 transition-colors cursor-pointer"
                        onClick={() => setReply(m)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[13px]">reply</span> Répondre
                      </button>
                      <button
                        className="hover:text-on-surface flex items-center gap-0.5 transition-colors cursor-pointer"
                        onClick={() => star(m)}
                        type="button"
                      >
                        <span className="material-symbols-outlined text-[13px]">star</span> {m.starred ? 'Retirer' : 'Favori'}
                      </button>
                      <Link
                        href={`/signaler?kind=message&target=${encodeURIComponent(m.id)}`}
                        className="hover:text-error flex items-center gap-0.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[13px]">flag</span> Signaler
                      </Link>
                    </div>
                  </div>
                  </Fragment>
                );
              }

              // Received Message (Left)
              return (
                <Fragment key={m.id}>{dayDivider}
                <div key={m.id} className="flex items-start gap-space-sm max-w-xl group">
                  <div className="w-8 h-8 rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center font-label-md text-label-md flex-shrink-0 mt-1 shadow-sm">
                    {initials(m.name || 'F')}
                  </div>
                  <div className="flex flex-col items-start gap-1">
                    <div className="flex items-center gap-space-sm pl-1">
                      <span className="font-label-md text-label-md text-on-surface font-semibold">{m.name}</span>
                      <span className="font-label-caps text-label-caps text-outline">{formattedTime}</span>
                    </div>

                    <div className="relative group/bubble bg-surface-container-high text-on-surface px-space-md py-space-sm rounded-2xl rounded-tl-sm shadow-md transition-all hover:bg-surface-variant">
                      <p className="messenger-message-body font-body-md text-body-md">{m.body}</p>
                      {attachment(m)}
                    </div>
                    <div className="flex items-center gap-space-md pl-1 opacity-0 group-hover:opacity-100 transition-opacity text-outline font-label-caps text-label-caps">
                      <button className="hover:text-on-surface flex items-center gap-0.5 transition-colors cursor-pointer" onClick={() => setReply(m)} type="button">
                        <span className="material-symbols-outlined text-[13px]">reply</span> Répondre
                      </button>
                      <button className="hover:text-on-surface flex items-center gap-0.5 transition-colors cursor-pointer" onClick={() => star(m)} type="button">
                        <span className="material-symbols-outlined text-[13px]">star</span> {m.starred ? 'Retirer' : 'Favori'}
                      </button>
                      <Link href={`/signaler?kind=message&target=${encodeURIComponent(m.id)}`} className="hover:text-error flex items-center gap-0.5 transition-colors">
                        <span className="material-symbols-outlined text-[13px]">flag</span> Signaler
                      </Link>
                    </div>
                  </div>
                </div>
                </Fragment>
              );
            })}

            <div aria-hidden="true" />
          </section>

          {!atLatest&&<button type="button" className="messenger-jump-latest" aria-label="Aller aux derniers messages" onClick={()=>{followLatest.current=true;history.current?.scrollTo({top:history.current.scrollHeight,behavior:document.documentElement.dataset.motion==='reduced'?'auto':'smooth'});}}><ArrowDown size={18}/><span>{(activeChat?.unread||0)>0?`${activeChat!.unread} non lu${activeChat!.unread!==1?'s':''}`:'Derniers messages'}</span></button>}
          {/* Message Composer Footer */}
          <footer className="p-space-lg pt-space-xs pb-space-lg flex-shrink-0 z-20">
            {(writeErrors[active]||error)&&<p className="text-body-sm text-error px-space-sm py-space-xs" role="alert">{writeErrors[active]||error}</p>}
            <div className="relative bg-surface-container-low/90 backdrop-blur-xl rounded-2xl shadow-xl p-space-sm flex flex-col gap-space-xs border border-white/5">
              {reply && (
                <div className="px-space-md py-1 text-body-sm text-primary flex items-center justify-between bg-surface-container rounded-lg">
                  <span>
                    Répondre à <strong>{reply.name}</strong> : {reply.body.slice(0, 60)}
                  </span>
                  <button onClick={() => setReply(null)} className="text-outline hover:text-white cursor-pointer" type="button">
                    ✕
                  </button>
                </div>
              )}

              {/* Typing Area */}
              <div className="flex items-center gap-space-sm px-space-xs">
                {/* Emoji Button */}
                <button
                  className="w-9 h-9 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                  title="Émojis & autocollants"
                  type="button"
                  onClick={() => setText((t) => t + ' 😊')}
                >
                  <span className="material-symbols-outlined text-[20px]">sentiment_satisfied</span>
                </button>

                {/* Attach File Button */}
                <button
                  className="w-9 h-9 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                  title="Joindre un fichier (jusqu’à 20 Mo)"
                  type="button"
                  disabled={!activeChat||busy}
                  onClick={() => file.current?.click()}
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </button>

                {/* Text Input */}
                <textarea
                  ref={composer}
                  className="messenger-composer-text flex-1 bg-transparent text-body-md font-body-md text-on-surface placeholder:text-outline focus:outline-none py-2 px-space-xs"
                  placeholder={activeChat?`Écrivez votre message à ${activeChat.name}...`:'Sélectionnez une discussion'}
                  rows={1}
                  maxLength={10000}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />

                {/* Schedule Message */}
                <button
                  className="w-9 h-9 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                  title="Planifier l'envoi"
                  type="button"
                  onClick={() => {
                    setSchedule('');
                    setModal('schedule');
                  }}
                >
                  <span className="material-symbols-outlined text-[20px]">schedule</span>
                </button>

                {/* Send Button */}
                <button
                  className="w-10 h-10 rounded-xl bg-primary-container text-on-primary-container hover:opacity-90 flex items-center justify-center transition-all duration-200 shadow-md shadow-primary-container/30 active:scale-95 group disabled:opacity-40 cursor-pointer"
                  title="Envoyer le message"
                  type="button"
                  disabled={!activeChat||!text.trim() || busy}
                  onClick={() => send()}
                >
                  <span className="material-symbols-outlined text-[20px] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform">
                    send
                  </span>
                </button>

                <input ref={file} type="file" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
              </div>

              {/* Bottom Micro-hints */}
              <div className="flex items-center justify-between px-space-sm pt-1 font-label-caps text-label-caps text-outline">
                <div className="flex items-center gap-space-md">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-surface-container-high text-on-surface-variant">Entrée</kbd> pour envoyer
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-surface-container-high text-on-surface-variant">Maj + Entrée</kbd> saut de ligne
                  </span>
                </div>
                <span>Fichiers jusqu’à 20 Mo</span>
              </div>
            </div>
          </footer>
          </>}
        </main>
      </div>

      {/* Details drawer */}
      <Dialog open={detail} onOpenChange={setDetail}>
        <DialogContent className="messenger-details" showCloseButton={false} onCloseAutoFocus={event=>{const summary=mobileMenu.current?.querySelector('summary');if(summary?.getClientRects().length){event.preventDefault();summary.focus();}}}>
          <div className="flex items-center justify-between mb-space-lg">
            <DialogTitle className="font-headline-md text-headline-md font-bold">Détails</DialogTitle>
            <DialogClose asChild><button type="button" aria-label="Fermer les détails" className="messenger-details-close">
              ✕
            </button></DialogClose>
          </div>
          <div className="flex flex-col items-center gap-space-sm mb-space-lg">
            <div className="w-20 h-20 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline-lg">
              {initials(activeChat?.name || 'F')}
            </div>
            <h4 className="font-title-sm text-title-sm font-bold text-on-surface">{activeChat?.name}</h4>
            <DialogDescription className="text-tertiary">Discussion réservée aux membres</DialogDescription>
          </div>
          <div className="space-y-space-md">
            <div className="p-space-sm rounded-xl bg-surface-container-lowest border border-white/5">
              <span className="font-label-caps text-label-caps text-outline block mb-1">Invitation</span>
              <code className="text-body-sm text-primary font-mono select-all block break-all">
                {activeChat?.invite || 'Aucun code disponible'}
              </code>
            </div>
            <button
              className="w-full py-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface font-label-md transition-colors cursor-pointer"
              disabled={!activeChat?.invite}
              onClick={() => activeChat?.invite&&copy(activeChat.invite)}
            >
              Copier le code d&apos;invitation
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modals */}
      <Dialog open={!!modal} onOpenChange={(o) => (!o ? setModal('') : null)}>
        <DialogContent className="bg-surface-container-low text-on-surface border border-white/10 shadow-2xl rounded-2xl">
          <DialogTitle className="font-headline-md text-headline-md font-bold">
            {modal === 'new' ? 'Nouvelle discussion' : 'Programmer un message'}
          </DialogTitle>
          <DialogDescription className="text-body-sm text-outline">
            {modal === 'new' ? 'Créez un salon ou une discussion privée.' : 'Le message sera délivré à l’heure précise.'}
          </DialogDescription>

          {modal === 'new' && (
            <div className="space-y-space-md pt-space-sm">
              <input
                className="w-full bg-surface-container-lowest text-on-surface p-space-sm rounded-xl border border-white/10 focus:outline-none"
                placeholder="Nom de la discussion"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Tabs value={kind} onValueChange={(v) => setKind(v as 'group' | 'direct')}>
                <TabsList className="bg-surface-container-lowest">
                  <TabsTrigger value="direct">Discussion privée</TabsTrigger>
                  <TabsTrigger value="group">Groupe</TabsTrigger>
                </TabsList>
              </Tabs>
              <button
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
                disabled={!name.trim() || busy}
                onClick={() => create()}
              >
                Créer la discussion
              </button>
              <div className="relative my-2 text-center">
                <span className="text-outline font-label-caps text-label-caps uppercase">ou par code</span>
              </div>
              <input
                className="w-full bg-surface-container-lowest text-on-surface p-space-sm rounded-xl border border-white/10 focus:outline-none"
                placeholder="Collez le code d’invitation"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                className="w-full py-2.5 rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-bold transition-colors cursor-pointer disabled:opacity-40"
                disabled={!code.trim() || busy}
                onClick={() => create(true)}
              >
                Rejoindre
              </button>
            </div>
          )}

          {modal === 'schedule' && (
            <div className="space-y-space-md pt-space-sm">
              {(writeErrors[active]||error)&&<p className="text-body-sm text-error" role="alert">{writeErrors[active]||error}</p>}
              <input
                type="datetime-local"
                className="w-full bg-surface-container-lowest text-on-surface p-space-sm rounded-xl border border-white/10 focus:outline-none"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
              <p className="text-body-sm text-outline italic">Message : « {text} »</p>
              <button
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
                disabled={!schedule || busy}
                onClick={() => send(true)}
              >
                Confirmer l’envoi programmé
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Toast Notification */}
      {notice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-surface-container-high text-on-surface px-space-md py-space-sm rounded-xl shadow-2xl border border-white/10 text-body-sm font-semibold z-50 animate-bounce">
          {notice}
        </div>
      )}
    </div>
  );
}
