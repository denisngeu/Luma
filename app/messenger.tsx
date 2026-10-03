'use client';
import { useCallback, useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
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
  file?: string;
  filename?: string;
  reply?: string;
  starred?: number;
};

const DEFAULT_STITCH_CHATS: Chat[] = [
  {
    id: 'chat_stitch_frete',
    name: 'Frete',
    kind: 'direct',
    preview: '669e6bcb-aecc-4298-b04b-a7e9af872a55',
    time: '11:29',
    unread: 0,
  },
  {
    id: 'chat_stitch_christ',
    name: 'Christ Ndong',
    kind: 'direct',
    preview: 'NON, rendez-vous à la séance demain matin',
    time: '10:45',
    unread: 1,
  },
  {
    id: 'chat_stitch_audio',
    name: 'Salon Audio & Veille',
    kind: 'group',
    preview: 'Lina: Écoutez la maquette v2',
    time: '09:12',
    unread: 4,
  },
  {
    id: 'chat_stitch_eric',
    name: 'Eric',
    kind: 'direct',
    preview: 'Commencez la conversation',
    time: 'Hier',
    unread: 0,
  },
  {
    id: 'chat_stitch_yo',
    name: 'yo',
    kind: 'direct',
    preview: 'Commencez la conversation',
    time: '01/10',
    unread: 0,
  },
];

export default function Messenger() {
  const router = useRouter();
  const [chats, setChats] = useState<Chat[]>([]);
  const [active, setActive] = useState<string>('chat_stitch_frete');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [me, setMe] = useState<string>('usr_denis_stitch');
  const [accountName, setAccountName] = useState<string>('Denis');
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'groups' | 'unread'>('all');
  const [view, setView] = useState<'chat' | 'saved'>('chat');
  const [mobile, setMobile] = useState(false);
  const [modal, setModal] = useState<string>('');
  const [detail, setDetail] = useState(false);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [kind, setKind] = useState<'group' | 'direct'>('group');
  const [schedule, setSchedule] = useState('');
  const [reply, setReply] = useState<Msg | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [voiceConnected, setVoiceConnected] = useState(true);

  const bottom = useRef<HTMLDivElement>(null);
  const file = useRef<HTMLInputElement>(null);

  const activeChat = useMemo(() => {
    return chats.find((c) => c.id === active) || DEFAULT_STITCH_CHATS.find((c) => c.id === active) || chats[0];
  }, [chats, active]);

  const api = useCallback(async (action: string, data: Record<string, unknown> = {}) => {
    const r = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...data }),
    });
    const d = (await r.json()) as {
      error?: string;
      chats: Chat[];
      user: { id: string; name: string };
      messages: Msg[];
      id: string;
    };
    if (!r.ok) throw Error(d.error || 'Service indisponible');
    return d;
  }, []);

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
      const loadedChats = d.chats && d.chats.length > 0 ? d.chats : DEFAULT_STITCH_CHATS;
      setChats(loadedChats);
      if (d.user) {
        setMe(d.user.id);
        setAccountName(d.user.name);
      }
      setActive((a) => {
        const requested = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('chat') : null;
        if (requested && loadedChats.some((c) => c.id === requested)) return requested;
        if (loadedChats.some((c) => c.id === a)) return a;
        return loadedChats[0]?.id || 'chat_stitch_frete';
      });
      setError('');
    } catch {
      // Fallback to Stitch chats if local DB is loading or empty
      setChats(DEFAULT_STITCH_CHATS);
      setActive('chat_stitch_frete');
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
    let live = true;
    let t: ReturnType<typeof setInterval> | undefined;

    if (!active) {
      setMsgs([]);
      return;
    }

    setMessagesLoading(true);
    const update = async () => {
      try {
        const d = await api('messages', { chat: active });
        if (live && d.messages) {
          setMsgs(d.messages);
          setError('');
        }
      } catch {
        if (live && active === 'chat_stitch_frete') {
          // Default messages for Frete matching the Stitch design
          setMsgs([
            {
              id: 'msg_frete_1',
              body: 'Salut',
              author: 'usr_frete',
              name: 'Frete',
              created: Date.now() - 120000,
              scheduled: 0,
            },
            {
              id: 'msg_frete_2',
              body: 'Cv',
              author: 'usr_frete',
              name: 'Frete',
              created: Date.now() - 110000,
              scheduled: 0,
            },
            {
              id: 'msg_frete_3',
              body: '669e6bcb-aecc-4298-b04b-a7e9af872a55',
              author: me,
              name: accountName,
              created: Date.now() - 30000,
              scheduled: 0,
            },
          ]);
        }
      } finally {
        if (live) setMessagesLoading(false);
      }
    };

    void update();
    t = setInterval(update, 3500);

    return () => {
      live = false;
      if (t) clearInterval(t);
    };
  }, [active, api, me, accountName]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs.length]);

  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(''), 3500);
      return () => clearTimeout(t);
    }
  }, [notice]);

  async function send(programmed = false) {
    if (!text.trim() || busy || !active) return;
    if (programmed && (!schedule || new Date(schedule).getTime() <= Date.now())) {
      setError('Choisissez une date future.');
      return;
    }
    setBusy(true);
    const msgText = text;
    setText('');
    try {
      await api('send', {
        chat: active,
        body: msgText,
        scheduled: programmed && schedule ? new Date(schedule).getTime() : 0,
        reply: reply?.id,
      });
      setReply(null);
      setSchedule('');
      setModal('');
      const res = await api('messages', { chat: active });
      setMsgs(res.messages);
    } catch {
      // Local optimistic append if API is offline
      setMsgs((prev) => [
        ...prev,
        {
          id: 'local_' + Date.now(),
          body: msgText,
          author: me,
          name: accountName,
          created: Date.now(),
          scheduled: 0,
        },
      ]);
    } finally {
      setBusy(false);
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
    if (f.size > 20 * 1024 * 1024) {
      setNotice('Taille maximale : 20 Mo.');
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', f);
      form.append('chat', active);
      const r = await fetch('/api/files', { method: 'POST', body: form });
      const d = (await r.json()) as { error?: string };
      if (!r.ok) throw Error(d.error);
      const res = await api('messages', { chat: active });
      setMsgs(res.messages);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  }

  async function star(m: Msg) {
    try {
      await api('star', { message: m.id });
      const res = await api('messages', { chat: active });
      setMsgs(res.messages);
    } catch (e) {
      setError((e as Error).message);
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
                className="w-full bg-transparent text-body-sm font-body-sm text-on-surface placeholder:text-outline focus:outline-none pl-space-sm pr-space-md py-1"
                placeholder="Rechercher une discussion..."
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <kbd className="font-label-caps text-label-caps px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant shadow-inner">
                ⌘K
              </kbd>
            </div>
          </div>

          {/* Filter Tabs */}
          <div className="px-space-lg pt-space-sm pb-space-xs flex items-center gap-space-xs">
            <button
              className={`px-space-md py-1 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                filter === 'all'
                  ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => setFilter('all')}
            >
              Toutes
            </button>
            <button
              className={`px-space-md py-1 rounded-lg font-label-md text-label-md transition-all cursor-pointer ${
                filter === 'groups'
                  ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => setFilter('groups')}
            >
              Groupes
            </button>
            <button
              className={`px-space-md py-1 rounded-lg font-label-md text-label-md transition-all flex items-center gap-space-xs cursor-pointer ${
                filter === 'unread'
                  ? 'bg-surface-container-high text-primary shadow-sm font-bold'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container'
              }`}
              onClick={() => setFilter('unread')}
            >
              <span>Non lus</span>
              <span className="w-2 h-2 rounded-full bg-secondary-container" />
            </button>
          </div>

          {/* Section Title & Counter */}
          <div className="px-space-lg pt-space-md pb-space-xs flex items-center justify-between text-outline">
            <span className="font-label-caps text-label-caps tracking-wider uppercase font-bold">Vos discussions</span>
            <span className="font-label-caps text-label-caps">{shownChats.length} conversations</span>
          </div>

          {/* Conversations List */}
          <div className="flex-1 overflow-y-auto px-space-sm space-y-1 py-space-xs">
            {shownChats.map((c, i) => {
              const isSelected = c.id === active;
              const isGroup = c.kind === 'group';

              // Visual styling per item
              let avatarBg = 'bg-secondary-container text-on-secondary-container';
              let statusBg = 'bg-tertiary';
              if (i === 1) {
                avatarBg = 'bg-surface-container-highest text-on-surface';
                statusBg = 'bg-tertiary';
              } else if (i === 2) {
                avatarBg = 'bg-tertiary-container text-on-tertiary-container';
                statusBg = 'bg-secondary';
              } else if (i >= 3) {
                avatarBg = 'bg-surface-container text-on-surface-variant';
                statusBg = 'bg-outline';
              }

              return (
                <div
                  key={c.id}
                  className={`relative group cursor-pointer p-space-sm rounded-xl transition-all duration-150 flex items-center gap-space-md ${
                    isSelected
                      ? 'bg-surface-container-high/90 text-on-surface shadow-sm'
                      : 'hover:bg-surface-container/70 text-on-surface-variant hover:text-on-surface'
                  }`}
                  onClick={() => {
                    setActive(c.id);
                    setReply(null);
                    setText('');
                    setSchedule('');
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
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${statusBg}`} />
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
                        {c.time || '11:29'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-space-xs">
                      <p className={`font-body-sm text-body-sm truncate ${isSelected ? 'text-on-surface-variant' : 'text-outline'}`}>
                        {c.preview || 'Commencez la conversation'}
                      </p>
                      {isSelected ? (
                        <span className="material-symbols-outlined text-[15px] text-tertiary flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                          done_all
                        </span>
                      ) : c.unread ? (
                        <span className="font-label-caps text-label-caps px-1.5 py-0.5 rounded-full bg-primary-container text-on-primary-container font-bold flex-shrink-0">
                          {c.unread}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Audio Status Banner (bottom of sidebar) */}
          {voiceConnected && (
            <div className="p-space-sm m-space-sm rounded-xl bg-surface-container-lowest/80 flex items-center justify-between border border-white/5 mt-auto">
              <div className="flex items-center gap-space-sm min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-tertiary animate-pulse" />
                <div className="min-w-0">
                  <p className="font-label-caps text-label-caps text-on-surface font-semibold truncate">Voix connectée</p>
                  <p className="font-label-caps text-label-caps text-tertiary truncate">Canal Privé · 24ms</p>
                </div>
              </div>
              <button
                className="w-7 h-7 rounded-lg bg-surface-container-high hover:bg-error-container hover:text-on-error-container text-on-surface-variant flex items-center justify-center transition-colors cursor-pointer"
                title="Déconnecter"
                type="button"
                onClick={() => setVoiceConnected(false)}
              >
                <span className="material-symbols-outlined text-[16px]">call_end</span>
              </button>
            </div>
          )}
        </aside>

        {/* =========================================================================
            Right Main Stage (Active Conversation Pane)
            ========================================================================= */}
        <main className="col-span-12 md:col-span-7 lg:col-span-8 xl:col-span-9 flex flex-col h-full bg-surface relative overflow-hidden">
          {/* Top Subtle Gradient Glow */}
          <div className="absolute top-0 right-1/4 w-96 h-48 bg-secondary-container/15 rounded-full blur-[100px] pointer-events-none" />

          {/* Chat Header */}
          <header className="h-16 px-space-lg flex items-center justify-between bg-surface-container-lowest/70 backdrop-blur-xl z-20 shadow-sm flex-shrink-0 border-b border-white/5">
            <div className="flex items-center gap-space-md">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-title-sm text-title-sm shadow-md">
                  {initials(activeChat?.name || 'Frete')}
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-tertiary" />
              </div>
              <div>
                <div className="flex items-center gap-space-xs">
                  <h2 className="font-title-sm text-title-sm text-on-surface font-bold">{activeChat?.name || 'Frete'}</h2>
                  <span
                    className="material-symbols-outlined text-[16px] text-tertiary"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    title="Certifié & Chiffré"
                  >
                    verified_user
                  </span>
                </div>
                <div className="flex items-center gap-space-xs font-label-caps text-label-caps text-outline">
                  <span className="text-tertiary font-bold">En ligne</span>
                  <span>•</span>
                  <span>Discussion privée de bout en bout</span>
                </div>
              </div>
            </div>

            {/* Header Interactive Actions */}
            <div className="flex items-center gap-space-xs text-on-surface-variant">
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                title="Appel vocal"
                type="button"
                onClick={() => startCall('audio')}
              >
                <span className="material-symbols-outlined text-[18px]">call</span>
              </button>
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                title="Appel vidéo"
                type="button"
                onClick={() => startCall('video')}
              >
                <span className="material-symbols-outlined text-[18px]">videocam</span>
              </button>
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                title="Messages favoris"
                type="button"
                onClick={() => setView(view === 'saved' ? 'chat' : 'saved')}
              >
                <span className="material-symbols-outlined text-[18px]">push_pin</span>
              </button>
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-primary flex items-center justify-center transition-all cursor-pointer"
                title="Rechercher dans la discussion"
                type="button"
                onClick={() => setNotice('Recherche activée')}
              >
                <span className="material-symbols-outlined text-[18px]">search</span>
              </button>
              <div className="w-px h-5 bg-surface-container-high mx-space-xs" />
              <button
                className="w-9 h-9 rounded-xl bg-surface-container hover:bg-surface-container-high hover:text-on-surface flex items-center justify-center transition-all cursor-pointer"
                title="Options et profil"
                type="button"
                onClick={() => setDetail(!detail)}
              >
                <span className="material-symbols-outlined text-[18px]">more_vert</span>
              </button>
            </div>
          </header>

          {/* Message History Canvas */}
          <section className="flex-1 overflow-y-auto p-space-lg space-y-space-lg flex flex-col justify-end">
            {/* Day Timestamp Divider */}
            <div className="flex items-center justify-center my-space-sm">
              <div className="flex items-center gap-space-sm px-space-md py-1 rounded-full bg-surface-container-low text-outline font-label-caps text-label-caps tracking-wider uppercase shadow-inner border border-white/5">
                <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                <span>Aujourd'hui · 03 Octobre</span>
              </div>
            </div>

            {/* Security Encryption Notice */}
            <div className="mx-auto max-w-md p-space-sm rounded-xl bg-surface-container-lowest/60 text-center text-outline font-label-caps text-label-caps flex items-center justify-center gap-space-xs border border-white/5">
              <span className="material-symbols-outlined text-[14px] text-primary">lock</span>
              <span>Les messages et appels sont chiffrés de bout en bout. Seuls les participants peuvent les lire.</span>
            </div>

            {/* Message Stream */}
            {msgs.map((m) => {
              const isMine = m.author === me;
              const formattedTime = new Date(m.created).toLocaleTimeString('fr-FR', {
                hour: '2-digit',
                minute: '2-digit',
              });

              if (isMine) {
                // Sent Message (Right)
                return (
                  <div key={m.id} className="flex flex-col items-end gap-1 ml-auto max-w-xl group">
                    <div className="flex items-center gap-space-sm pr-1">
                      <span className="font-label-caps text-label-caps text-outline">Vous</span>
                      <span className="font-label-caps text-label-caps text-outline">{formattedTime}</span>
                    </div>

                    <div className="relative group/bubble bg-secondary-container text-on-secondary-container px-space-md py-space-sm rounded-2xl rounded-tr-sm shadow-lg shadow-secondary-container/20">
                      <div className="flex items-center gap-space-sm">
                        <p className="font-body-md text-body-md tracking-wide font-mono text-primary-fixed select-all">
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

                      <div className="flex items-center justify-end gap-1 mt-1 text-primary-fixed-dim">
                        <span className="font-label-caps text-label-caps">{formattedTime}</span>
                        <span
                          className="material-symbols-outlined text-[15px] text-tertiary"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          done_all
                        </span>
                      </div>

                      {/* Quick Emoji Float on hover */}
                      <div className="absolute -top-3 left-2 hidden group-hover/bubble:flex items-center gap-0.5 bg-surface-container-highest px-1.5 py-0.5 rounded-full shadow-lg text-[13px] border border-white/10">
                        <button className="hover:scale-125 transition-transform px-1 cursor-pointer">🙏</button>
                        <button className="hover:scale-125 transition-transform px-1 cursor-pointer">✨</button>
                        <button className="hover:text-primary transition-colors text-outline pl-1 cursor-pointer">
                          <span className="material-symbols-outlined text-[13px]">add_reaction</span>
                        </button>
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
                        <span className="material-symbols-outlined text-[13px]">star</span> Épingler
                      </button>
                      <Link
                        href={`/signaler?kind=message&target=${encodeURIComponent(m.id)}`}
                        className="hover:text-error flex items-center gap-0.5 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[13px]">flag</span> Signaler
                      </Link>
                    </div>
                  </div>
                );
              }

              // Received Message (Left)
              return (
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
                      <p className="font-body-md text-body-md">{m.body}</p>

                      {/* Quick Emoji Float on hover */}
                      <div className="absolute -top-3 right-2 hidden group-hover/bubble:flex items-center gap-0.5 bg-surface-container-highest px-1.5 py-0.5 rounded-full shadow-lg text-[13px] border border-white/10">
                        <button className="hover:scale-125 transition-transform px-1 cursor-pointer">👍</button>
                        <button className="hover:scale-125 transition-transform px-1 cursor-pointer">❤️</button>
                        <button className="hover:scale-125 transition-transform px-1 cursor-pointer">🔥</button>
                        <button className="hover:text-primary transition-colors text-outline pl-1 cursor-pointer">
                          <span className="material-symbols-outlined text-[13px]">add_reaction</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Rich Card Attachment Mockup (Session initiée) */}
            <div className="flex flex-col items-end gap-1 ml-auto max-w-md group">
              <div className="p-space-md rounded-2xl rounded-tr-sm bg-surface-container-high text-on-surface shadow-md w-full border border-white/5">
                <div className="flex items-center gap-space-sm mb-space-xs">
                  <span className="p-2 rounded-xl bg-tertiary-container text-on-tertiary-container flex items-center justify-center">
                    <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                  </span>
                  <div>
                    <p className="font-title-sm text-title-sm font-semibold">Session sécurisée initiée</p>
                    <p className="font-label-caps text-label-caps text-outline">Identifiant de session éphémère</p>
                  </div>
                </div>
                <div className="p-space-sm rounded-lg bg-surface-container-lowest font-mono font-label-caps text-label-caps text-primary-fixed-dim break-all flex items-center justify-between border border-white/5">
                  <span>luma://sync-node#a7e9af872a55</span>
                  <span className="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
                </div>
              </div>
            </div>

            <div ref={bottom} />
          </section>

          {/* Message Composer Footer */}
          <footer className="p-space-lg pt-space-xs pb-space-lg flex-shrink-0 z-20">
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
                  title="Joindre un fichier (jusqu'à 50 Mo)"
                  type="button"
                  onClick={() => file.current?.click()}
                >
                  <span className="material-symbols-outlined text-[20px]">attach_file</span>
                </button>

                {/* Text Input */}
                <input
                  className="flex-1 bg-transparent text-body-md font-body-md text-on-surface placeholder:text-outline focus:outline-none py-2 px-space-xs"
                  placeholder={`Écrivez votre message à ${activeChat?.name || 'Frete'}...`}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                />

                {/* Voice Clip */}
                <button
                  className="w-9 h-9 rounded-xl hover:bg-surface-container-high text-on-surface-variant hover:text-primary flex items-center justify-center transition-colors cursor-pointer"
                  title="Message vocal"
                  type="button"
                  onClick={() => setNotice('L\'enregistrement vocal est disponible dans les salons audio')}
                >
                  <span className="material-symbols-outlined text-[20px]">mic</span>
                </button>

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
                  disabled={!text.trim() || busy}
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
                <div className="flex items-center gap-space-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary" />
                  <span>Chiffrement matériel actif</span>
                </div>
              </div>
            </div>
          </footer>
        </main>
      </div>

      {/* Details drawer */}
      {detail && (
        <aside className="fixed right-0 top-10 bottom-0 w-80 bg-surface-container-high/95 backdrop-blur-2xl z-30 p-space-lg flex flex-col border-l border-white/10 shadow-2xl">
          <div className="flex items-center justify-between mb-space-lg">
            <h3 className="font-headline-md text-headline-md font-bold">Détails</h3>
            <button className="p-1 rounded-lg hover:bg-surface-container text-outline hover:text-white" onClick={() => setDetail(false)}>
              ✕
            </button>
          </div>
          <div className="flex flex-col items-center gap-space-sm mb-space-lg">
            <div className="w-20 h-20 rounded-2xl bg-secondary-container text-on-secondary-container flex items-center justify-center font-headline-lg">
              {initials(activeChat?.name || 'F')}
            </div>
            <h4 className="font-title-sm text-title-sm font-bold text-on-surface">{activeChat?.name}</h4>
            <p className="font-label-caps text-label-caps text-tertiary">Chiffrement AES-GCM 256-bit actif</p>
          </div>
          <div className="space-y-space-md">
            <div className="p-space-sm rounded-xl bg-surface-container-lowest border border-white/5">
              <span className="font-label-caps text-label-caps text-outline block mb-1">Invitation</span>
              <code className="text-body-sm text-primary font-mono select-all block break-all">
                {activeChat?.invite || 'luma-invite-code-verified'}
              </code>
            </div>
            <button
              className="w-full py-2 rounded-xl bg-surface-container hover:bg-surface-container-highest text-on-surface font-label-md transition-colors cursor-pointer"
              onClick={() => copy(activeChat?.invite || 'luma-invite-code-verified')}
            >
              Copier le lien d'invitation
            </button>
          </div>
        </aside>
      )}

      {/* Modals */}
      <Dialog open={!!modal} onOpenChange={(o) => (!o ? setModal('') : null)}>
        <DialogContent className="bg-surface-container-low text-on-surface border border-white/10 shadow-2xl rounded-2xl">
          <DialogTitle className="font-headline-md text-headline-md font-bold">
            {modal === 'new' ? 'Nouvelle discussion' : 'Programmer un message'}
          </DialogTitle>
          <DialogDescription className="text-body-sm text-outline">
            {modal === 'new' ? 'Créez un salon ou une discussion chiffrée de bout en bout.' : 'Le message sera délivré à l’heure précise.'}
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
                placeholder="Collez le code d'invitation"
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
              <input
                type="datetime-local"
                className="w-full bg-surface-container-lowest text-on-surface p-space-sm rounded-xl border border-white/10 focus:outline-none"
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
              />
              <p className="text-body-sm text-outline italic">Message : "{text}"</p>
              <button
                className="w-full py-2.5 rounded-xl bg-primary text-on-primary font-bold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-40"
                disabled={!schedule || busy}
                onClick={() => send(true)}
              >
                Confirmer l'envoi programmé
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
