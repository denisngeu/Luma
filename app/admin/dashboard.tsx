'use client';
import {useEffect,useRef,useState,FormEvent} from 'react';
import {Users,Shield,MessagesSquare,AudioLines,Flag,History,Settings,ArrowUpRight,RefreshCw,Search,ChevronRight,CheckCircle2,LayoutDashboard,X,Sparkles,Trash2,Copy,Check} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
type Row=Record<string,any>;
const tabs=[['overview','Vue d’ensemble',LayoutDashboard],['simulation','Mode Simulation',Sparkles],['users','Utilisateurs',Users],['spaces','Communautés',Shield],['chats','Conversations',MessagesSquare],['calls','Appels',AudioLines],['reports','Signalements',Flag],['audit','Journal d’actions',History],['settings','Configuration',Settings]] as const;
const labels:Record<string,string>={suspend:'Suspendre le compte',restore_user:'Réactiver le compte',role:'Modifier le rôle',revoke_sessions:'Déconnecter les appareils',lock_space:'Modifier l’accès à la communauté',lock_chat:'Modifier l’accès à la conversation',rotate_space:'Renouveler l’invitation',rotate_chat:'Renouveler l’invitation',end_call:'Terminer l’appel',moderate:'Modifier la visibilité',resolve_report:'Traiter le signalement',settings:'Enregistrer la configuration'};
const status:Record<string,string>={open:'À traiter',resolved:'Résolu',dismissed:'Classé sans suite',preparing:'Préparation',ringing:'Sonne',active:'En cours',ended:'Terminé',user:'Membre',admin:'Administrateur',message:'Message',post:'Publication',space:'Communauté',direct:'Privée',group:'Groupe',channel:'Salon'};
const date=(v:unknown)=>v?new Date(Number(v)).toLocaleString('fr-FR',{dateStyle:'medium',timeStyle:'short'}):'—';
const num=(v:unknown)=>Number(v||0).toLocaleString('fr-FR');
 export default function Dashboard({email}:{email:string}){
  const [tab,setTab]=useState('overview'),[data,setData]=useState<Row|null>(null),[page,setPage]=useState(0),[q,setQ]=useState(''),[search,setSearch]=useState(''),[loading,setLoading]=useState(true),[actionLoading,setActionLoading]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[refresh,setRefresh]=useState(0),[pending,setPending]=useState<Row|null>(null),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[modalError,setModalError]=useState('');
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const c=new AbortController();setLoading(true);setError('');setData(null);fetch(`/api/admin?section=${tab}&page=${page}&q=${encodeURIComponent(search)}`,{signal:c.signal,cache:'no-store'}).then(async r=>{const d=await r.json() as Row;if(!r.ok)throw Error(d.error||'Chargement impossible.');setData(d);}).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!c.signal.aborted)setLoading(false);});return()=>c.abort();},[tab,page,search,refresh]);
  useEffect(()=>{if(pending)dialog.current?.showModal();else dialog.current?.close();},[pending]);
  const navigate=(id:string)=>{if(id===tab)return;setData(null);setLoading(true);setTab(id);setPage(0);setSearch('');setQ('');setNotice('');};
  const ask=(action:string,target:string,name:string,extra:Row={})=>{setReason('');setModalError('');setPending({action,target,name,...extra});};
  async function submit(e:FormEvent){e.preventDefault();if(!pending)return;setSaving(true);setModalError('');try{const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...pending,reason})});const d=await r.json() as Row;if(!r.ok)throw Error(d.error||'Action impossible.');setPending(null);setNotice('Modification enregistrée dans le journal.');setRefresh(v=>v+1);}catch(e){setModalError(e instanceof Error?e.message:'Action impossible.');}finally{setSaving(false);}}
  async function handleSimulationAction(action:'simulation_generate'|'simulation_clear'){setActionLoading(true);setError('');try{const r=await fetch('/api/admin',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action})});const res=await r.json() as Row;if(!r.ok)throw Error(res.error||'Erreur de simulation.');setNotice(action==='simulation_generate'?'Données de simulation créées avec succès ! Vous pouvez maintenant tester toutes les fonctionnalités.':'Données de simulation nettoyées avec succès.');setRefresh(v=>v+1);}catch(err:any){setError(err.message||'Action impossible.');}finally{setActionLoading(false);}}
  const button=(label:string,fn:()=>void,danger=false,disabled=false)=><button className={danger?'danger':''} disabled={disabled} onClick={fn}>{label}</button>;
  return <div className="admin-shell"><aside className="admin-sidebar"><a className="admin-brand" href="/fil"><span>L</span> luma <small>ADMIN</small></a><p className="admin-nav-label">PILOTAGE DU SERVICE</p><nav aria-label="Administration">{tabs.map(([id,label,Icon])=><button key={id} aria-current={tab===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={19}/>{label}</button>)}</nav><div className="admin-sidebar-bottom"><Shield size={19}/><strong>Accès administrateur</strong><small>{email}</small><a href="/fil">Retour à l’application <ArrowUpRight size={16}/></a></div></aside>
  <main className="admin-main"><header className="admin-top">Espace de gestion / {tabs.find(t=>t[0]===tab)?.[1]}<span>Accès restreint</span></header><div className="admin-content"><div className="admin-title"><div><p className="admin-eyebrow">LUMA CONTROL CENTER</p><h1>{tabs.find(t=>t[0]===tab)?.[1]}</h1><p>Votre service, vos communautés, vos décisions.</p></div><button onClick={()=>setRefresh(v=>v+1)} disabled={loading}><RefreshCw size={16} className={loading?'spin':''}/>Actualiser</button></div>
  {notice&&<div className="admin-notice" role="status"><CheckCircle2 size={18}/>{notice}</div>}{error&&<div className="admin-error" role="alert">{error}<button onClick={()=>setRefresh(v=>v+1)}>Réessayer</button></div>}
  {!['overview','settings','simulation'].includes(tab)&&<form className="admin-search" onSubmit={e=>{e.preventDefault();setSearch(q);setPage(0);}}><Search size={18}/><input aria-label="Rechercher" placeholder={tab==='users'?'Rechercher un nom ou une adresse e-mail…':'Rechercher dans cette section…'} value={q} onChange={e=>setQ(e.target.value)}/><button>Rechercher</button></form>}
  {loading?<div className="admin-loading" role="status"><RefreshCw className="spin"/>Chargement des données…</div>:data&&<>
  {tab==='overview'&&<><div className="admin-stats">{[['Comptes actifs',data.stats.users,Users,`${num(data.stats.signups_today)} inscription(s) sur 24 h`],['Messages',data.stats.messages,MessagesSquare,`${num(data.stats.messages_today)} sur les dernières 24 h`],['Appels en cours',data.stats.calls,AudioLines,'Préparation, sonnerie et communication'],['Signalements ouverts',data.stats.reports,Flag,'En attente de votre intervention']].map(([label,n,Icon,sub])=>{const I=Icon as typeof Users;return <article key={String(label)}><div><span>{String(label)}</span><I size={20}/></div><strong>{num(n)}</strong><small>{String(sub)}</small></article>;})}</div><div className="admin-overview-grid"><section className="admin-panel"><h2>Activité des conversations</h2><p>Messages envoyés · 14 derniers jours (UTC)</p><div className="admin-chart" role="img" aria-label="Messages par jour">{Array.from({length:14},(_,i)=>{const day=Math.floor(Number(data.checkedAt)/86400000)*86400000-(13-i)*86400000,n=Number(data.activity.find((r:Row)=>Number(r.day)===day)?.count||0),max=Math.max(1,...data.activity.map((r:Row)=>Number(r.count)));return <div key={day} title={`${new Date(day).toLocaleDateString('fr-FR',{timeZone:'UTC'})} : ${n} messages`}><span>{n||''}</span><i style={{height:`${Math.max(2,n/max*140)}px`}}/><small>{new Date(day).getUTCDate()}</small></div>;})}</div></section><section className="admin-panel"><h2>État du service</h2><div className="admin-health"><span/>PostgreSQL répond<strong>{data.latency} ms</strong></div><dl className="admin-metrics"><div><dt>Comptes avec une session valide</dt><dd>{num(data.stats.sessions)}</dd></div><div><dt>Communautés</dt><dd>{num(data.stats.spaces)}</dd></div><div><dt>Comptes suspendus</dt><dd>{num(data.stats.suspended)}</dd></div></dl><small className="admin-muted">Vérifié le {date(data.checkedAt)}. Une session valide n’indique pas une présence en ligne.</small></section></div><section className="admin-panel admin-shortcuts"><div><h2>À votre main</h2><p>Les actions importantes, au même endroit.</p></div>{[['simulation','Mode Simulation'],['reports','Traiter les signalements'],['users','Gérer les comptes'],['settings','Configurer le service']].map(([id,label])=><button key={id} onClick={()=>navigate(id)}>{label}<ChevronRight size={16}/></button>)}</section></>}
  {tab==='simulation'&&<SimulationPanel data={data} onAction={handleSimulationAction} loading={actionLoading} onNavigate={navigate}/>}
  {tab==='settings'&&<SettingsPanel settings={data.settings} onSave={v=>ask('settings','service','Configuration globale',v)}/>}
 {Array.isArray(data.items)&&<><section className="admin-panel admin-list"><div className="panel-heading"><h2>{tabs.find(t=>t[0]===tab)?.[1]}</h2><span className="admin-muted">{data.items.length} élément(s)</span></div>{!data.items.length?<div className="admin-empty"><CheckCircle2 size={32}/><h3>{search?'Aucun résultat':'Rien à afficher pour le moment'}</h3><p>{search?'Essayez une autre recherche.':'Les données apparaîtront ici au fil de l’utilisation de Luma.'}</p></div>:<div className="admin-table-wrap"><table><thead><tr>{(tab==='users'?['Compte','Rôle et statut','Sessions','Inscription','Actions']:tab==='spaces'?['Communauté','Propriétaire','Membres / salons','Statut','Actions']:tab==='chats'?['Conversation','Type','Messages','Statut','Actions']:tab==='calls'?['Participants','Mode','Statut','Début','Actions']:tab==='reports'?['Signalement','Contenu signalé','Statut','Date','Actions']:['Administrateur','Action','Motif et cible','Date']).map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{data.items.map((r:Row)=><tr key={r.id}>
 {tab==='users'&&<><td><div className="admin-person"><span className="admin-avatar">{r.name?.slice(0,1)}</span><div><strong>{r.name}</strong><small>{r.email||'Adresse indisponible'}{r.id===data.me?' · Vous':''}</small></div></div></td><td><span className={`admin-badge ${r.role==='admin'?'purple':''}`}>{status[r.role]}</span><small>{r.closed?'Fermé':r.suspended?'Suspendu':'Actif'}</small></td><td>{num(r.sessions)}</td><td>{date(r.created)}</td><td><div className="admin-actions">{!r.closed&&<>{button(r.suspended?'Réactiver':'Suspendre',()=>ask(r.suspended?'restore_user':'suspend',r.id,r.name),!r.suspended,r.id===data.me)}{button(r.role==='admin'?'Retirer admin':'Nommer admin',()=>ask('role',r.id,r.name,{value:r.role==='admin'?'user':'admin'}),false,r.id===data.me)}{button('Déconnecter',()=>ask('revoke_sessions',r.id,r.name),false,!Number(r.sessions))}</>}</div></td></>}
 {tab==='spaces'&&<><td><strong>{r.name}</strong><small>{r.description||'Sans description'}</small></td><td>{r.owner}</td><td>{num(r.members)} / {num(r.channels)}</td><td><span className="admin-badge">{r.locked?'Verrouillée':'Ouverte'}</span></td><td><div className="admin-actions">{button(r.locked?'Déverrouiller':'Verrouiller',()=>ask('lock_space',r.id,r.name,{value:!r.locked}),!r.locked)}{button('Renouveler invitation',()=>ask('rotate_space',r.id,r.name))}</div></td></>}
 {tab==='chats'&&<><td><strong>{r.name}</strong><small>{r.space||'Conversation indépendante'}</small></td><td>{status[r.kind]||r.kind}</td><td>{num(r.messages)}</td><td><span className="admin-badge">{r.locked?'Verrouillée':'Ouverte'}</span></td><td><div className="admin-actions">{button(r.locked?'Déverrouiller':'Verrouiller',()=>ask('lock_chat',r.id,r.name,{value:!r.locked}),!r.locked)}{!r.id.startsWith('friend-')&&button('Renouveler invitation',()=>ask('rotate_chat',r.id,r.name))}</div></td></>}
 {tab==='calls'&&<><td><strong>{r.caller}</strong><small>avec {r.callee}</small></td><td>{r.mode==='video'?'Vidéo':'Audio'}</td><td><span className="admin-badge">{status[r.state]||r.state}</span></td><td>{date(r.created)}</td><td>{button('Terminer',()=>ask('end_call',r.id,`${r.caller} / ${r.callee}`),true,r.state==='ended')}</td></>}
 {tab==='reports'&&<><td><strong>{status[r.kind]} · {r.reporter_name}</strong><p>{r.reason}</p><small>Réf. {r.id.slice(0,8)}</small></td><td><p className="reported-content">{r.content||'Contenu indisponible ou fichier joint'}</p><small>{r.hidden?'Masqué par la modération':''}</small><code>{r.target}</code></td><td><span className={`admin-badge ${r.state==='open'?'orange':''}`}>{status[r.state]}</span>{r.resolution&&<small>{r.resolution}</small>}</td><td>{date(r.created)}</td><td><div className="admin-actions">{['message','post'].includes(r.kind)&&r.content!==null&&button(r.hidden?'Rétablir':'Masquer le contenu',()=>ask('moderate',r.target,status[r.kind],{kind:r.kind,value:!r.hidden}),!r.hidden)}{r.state==='open'?<>{button('Résoudre',()=>ask('resolve_report',r.id,'Signalement',{value:'resolved'}))}{button('Classer sans suite',()=>ask('resolve_report',r.id,'Signalement',{value:'dismissed'}))}</>:button('Rouvrir',()=>ask('resolve_report',r.id,'Signalement',{value:'open'}))}</div></td></>}
 {tab==='audit'&&<><td><strong>{r.actor_name}</strong></td><td>{labels[r.action]||r.action}</td><td><p>{r.reason}</p><code>{r.target||'Service'}</code><details><summary>Détails du changement</summary><pre>{JSON.stringify({avant:r.before_state,après:r.after_state},null,2)}</pre></details></td><td>{date(r.created)}</td></>}
 </tr>)}</tbody></table></div>}</section><div className="admin-pagination"><button disabled={!page} onClick={()=>setPage(v=>v-1)}>Précédent</button><span>Page {page+1}</span><button disabled={!data.more} onClick={()=>setPage(v=>v+1)}>Suivant</button></div></>}
 </>}
 <footer className="admin-footer"><Shield size={14}/>Actions contrôlées côté serveur · Historique conservé dans PostgreSQL</footer></div></main>
 <dialog ref={dialog} className="admin-dialog" onCancel={e=>{if(saving)e.preventDefault();else setPending(null);}}><form onSubmit={submit}><div className="panel-heading"><Shield size={24}/><button type="button" aria-label="Fermer" disabled={saving} onClick={()=>setPending(null)}><X size={20}/></button></div><h2>{labels[pending?.action||'']}</h2><p>Cible : <strong>{pending?.name}</strong></p><p className="admin-muted">{pending?.action==='suspend'?'Les sessions et les appels seront arrêtés. Le compte pourra être réactivé.':pending?.action==='role'?`Nouveau rôle : ${status[pending.value]}. Les sessions seront révoquées.`:pending?.action?.startsWith('lock_')?pending.value?'L’accès des membres sera bloqué jusqu’au déverrouillage.':'Les membres retrouveront leur accès.':pending?.action?.startsWith('rotate_')?'L’ancien lien ne fonctionnera plus. Les membres actuels restent inscrits.':pending?.action==='moderate'?pending.value?'Le contenu et sa pièce jointe seront masqués pour les membres.':'Le contenu sera rétabli pour les membres autorisés.':pending?.action==='settings'?'Les réglages s’appliquent immédiatement. Désactiver les appels interrompt aussi ceux en cours.':'Cette action sera enregistrée dans le journal.'}</p><label htmlFor="admin-reason">Motif de l’intervention</label><textarea id="admin-reason" autoFocus minLength={5} maxLength={500} required value={reason} onChange={e=>setReason(e.target.value)} placeholder="Expliquez le motif de cette action…"/>{modalError&&<p role="alert" className="admin-error">{modalError}</p>}<div className="admin-dialog-actions"><button type="button" disabled={saving} onClick={()=>setPending(null)}>Annuler</button><button className="primary" disabled={saving||reason.trim().length<5}>{saving?'Enregistrement…':'Confirmer l’action'}</button></div></form></dialog></div>;
}
function SettingsPanel({settings,onSave}:{settings:Row;onSave:(v:Row)=>void}){const [registrations,setRegistrations]=useState(Boolean(settings.registrations_open)),[calls,setCalls]=useState(Boolean(settings.calls_open));return <section className="admin-panel admin-settings"><h2>Disponibilité des fonctionnalités</h2><p>Contrôlez les accès sans redéployer l’application.</p><label><span><strong>Autoriser les inscriptions</strong><small>Les utilisateurs existants peuvent toujours se connecter.</small></span><Switch checked={registrations} onCheckedChange={setRegistrations} aria-label="Autoriser les inscriptions"/></label><label><span><strong>Autoriser les appels audio et vidéo</strong><small>La désactivation met également fin aux appels en cours.</small></span><Switch checked={calls} onCheckedChange={setCalls} aria-label="Autoriser les appels audio et vidéo"/></label><button className="primary" disabled={registrations===Boolean(settings.registrations_open)&&calls===Boolean(settings.calls_open)} onClick={()=>onSave({registrations_open:registrations,calls_open:calls})}>Enregistrer les réglages</button></section>;}

function SimulationPanel({data,onAction,loading,onNavigate}:{data:Row;onAction:(action:'simulation_generate'|'simulation_clear')=>void;loading:boolean;onNavigate:(id:string)=>void}){
 const [copiedKey,setCopiedKey]=useState<string|null>(null);
 const copy=(text:string,key:string)=>{navigator.clipboard.writeText(text);setCopiedKey(key);setTimeout(()=>setCopiedKey(null),2000);};
 const isActive=Boolean(data.active);
 return <div>
  <div className="admin-sim-hero">
   <div>
    <h2><Sparkles size={22} color="#c1b7ff"/>Mode Simulation Luma<span className={`admin-badge ${isActive?'purple':''}`}>{isActive?'Simulation active':'Prêt à générer'}</span></h2>
    <p>Générez en un clic un environnement de test complet avec des comptes utilisateurs réalistes, des discussions privées, des communautés, des sondages interactifs, des publications sur le fil, des salons vocaux, des appels en cours et des signalements de modération.</p>
   </div>
   <div className="admin-sim-hero-actions">
    <button className="primary" disabled={loading} onClick={()=>onAction('simulation_generate')}><Sparkles size={16}/>{loading?'Génération…':isActive?'Regénérer la simulation':'Générer les données de test'}</button>
    {isActive&&<button className="danger" disabled={loading} onClick={()=>onAction('simulation_clear')}><Trash2 size={16}/>Nettoyer la simulation</button>}
   </div>
  </div>

  {isActive&&<div className="admin-stats" style={{marginBottom:24}}>
   <article><div><span>Utilisateurs simulés</span><Users size={20}/></div><strong>{data.simulatedUsers||5}</strong><small>5 comptes prêts avec mot de passe</small></article>
   <article><div><span>Communautés & Salons</span><Shield size={20}/></div><strong>{data.simulatedSpaces||2}</strong><small>Design, Tech, salons vocaux & sondages</small></article>
   <article><div><span>Fil social & Posts</span><MessagesSquare size={20}/></div><strong>{data.simulatedPosts||3}</strong><small>Publications avec réactions et commentaires</small></article>
   <article><div><span>File de modération</span><Flag size={20}/></div><strong>{data.simulatedReports||2}</strong><small>Signalements à traiter dans Admin</small></article>
  </div>}

  <section className="admin-panel" style={{marginBottom:24}}>
   <div className="panel-heading"><h2>Comptes de test disponibles</h2><span className="admin-muted">Mot de passe commun : <code>LumaTest2026!</code></span></div>
   <p className="admin-muted" style={{margin:'8px 0 16px'}}>Ouvrez une fenêtre de navigation privée pour vous connecter avec l’un de ces comptes et tester la messagerie en direct, les demandes d’amis et les appels avec votre compte administrateur.</p>
   <div className="admin-sim-grid">
    {(data.accounts||[]).map((acc:any)=><div key={acc.id} className="admin-sim-account">
     <div className="admin-sim-account-top"><span className="admin-avatar">{acc.name.slice(0,1)}</span><div><strong>{acc.name}</strong><small>{acc.email}</small></div></div>
     <p className="admin-sim-bio">{acc.bio}</p>
     <div className="admin-sim-creds">
      <div><span>E-mail :</span><code>{acc.email}</code><button type="button" className="admin-sim-copy" onClick={()=>copy(acc.email,acc.id+'-email')}>{copiedKey===acc.id+'-email'?<Check size={12} color="#81d5ae"/>:<Copy size={12}/>}</button></div>
      <div><span>Mot de passe :</span><code>{acc.password}</code><button type="button" className="admin-sim-copy" onClick={()=>copy(acc.password,acc.id+'-pass')}>{copiedKey===acc.id+'-pass'?<Check size={12} color="#81d5ae"/>:<Copy size={12}/>}</button></div>
     </div>
    </div>)}
   </div>
  </section>

  <section className="admin-sim-guide">
   <h3><ArrowUpRight size={18} color="#a49aff"/>Que tester maintenant avec les données générées ?</h3>
   <ul>
    <li>
     <strong>1. Messagerie privée et discussions</strong>
     <p>Une conversation privée directe existe avec Clara Vaneau et Alex, avec un sondage, un message épinglé et des réactions emoji.</p>
     <a href="/messages" target="_blank" rel="noreferrer">Ouvrir la messagerie <ArrowUpRight size={14}/></a>
    </li>
    <li>
     <strong>2. Demandes d’amis & Réseau</strong>
     <p>Sophie Martin vous a envoyé une demande d’amitié en attente. Rendez-vous dans vos contacts pour l’accepter ou la refuser.</p>
     <a href="/amis" target="_blank" rel="noreferrer">Gérer mes amis <ArrowUpRight size={14}/></a>
    </li>
    <li>
     <strong>3. Communautés & Salons vocaux</strong>
     <p>Deux communautés (&quot;Design &amp; Créativité&quot; et &quot;Tech &amp; Open-Source&quot;) ont été créées avec des salons de discussion, annonces et salon vocal.</p>
     <a href="/communities" target="_blank" rel="noreferrer">Explorer les communautés <ArrowUpRight size={14}/></a>
    </li>
    <li>
     <strong>4. Fil d’actualité social</strong>
     <p>Le fil privé affiche les publications de vos amis Clara, Alex et Sophie avec des commentaires et des mentions &quot;J’aime&quot;.</p>
     <a href="/fil" target="_blank" rel="noreferrer">Consulter le fil <ArrowUpRight size={14}/></a>
    </li>
    <li>
     <strong>5. Traitement des signalements (Modération)</strong>
     <p>Deux signalements ouverts ont été générés dans l’onglet Signalements ci-contre. Testez leur résolution ou le masquage de contenu.</p>
     <button type="button" onClick={()=>onNavigate('reports')}>Aller aux Signalements</button>
    </li>
    <li>
     <strong>6. Surveillance des flux d’appels</strong>
     <p>Un appel vidéo en cours est visible dans l’onglet Appels. Vous pouvez tester l’interruption d’urgence d’un appel à distance.</p>
     <button type="button" onClick={()=>onNavigate('calls')}>Aller aux Appels</button>
    </li>
   </ul>
  </section>
 </div>;
}
