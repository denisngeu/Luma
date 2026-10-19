'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {Palette,Shield,UserRound,Mic2,Bell,LockKeyhole} from 'lucide-react';

const sections=[
 {id:'profil',label:'Profil public',Icon:UserRound},
 {id:'appels',label:'Appels & Voix',Icon:Mic2},
 {id:'notifications',label:'Notifications',Icon:Bell},
 {id:'sessions',label:'Sécurité & Sessions',Icon:LockKeyhole},
] as const;

export default function SettingsNav({admin}:{admin:boolean}){
 const [active,setActive]=useState('profil');
 const pending=useRef<string|null>(null);
 useEffect(()=>{
  let live=true,frame:number|null=null;
  const observed=new Map<string,HTMLElement>();
  const update=()=>{
   if(!live||frame!==null)return;
   frame=requestAnimationFrame(()=>{
    frame=null;if(!live)return;
    const scroller=document.querySelector('.settings-content')?.closest('.luma-page');
    const bounds=scroller?.getBoundingClientRect(),top=Math.max(0,bounds?.top||0),bottom=Math.min(innerHeight,bounds?.bottom??innerHeight);
    const marker=top+Math.min(120,Math.max(0,bottom-top)*.2);
    const positions=[...observed.values()].map(node=>({id:node.id,top:node.getBoundingClientRect().top})).sort((a,b)=>a.top-b.top);
    const current=positions.filter(section=>section.top<=marker).at(-1)||positions[0];if(current)setActive(current.id);
   });
  };
  const register=()=>{
   if(!live)return;
   for(const section of sections){
    const node=document.getElementById(section.id);
    if(node)observed.set(section.id,node);else observed.delete(section.id);
   }
   const target=pending.current&&observed.get(pending.current);
   if(target){pending.current=null;target.scrollIntoView({behavior:'auto',block:'start'});setActive(target.id);}
   update();
  };
  const hashChanged=()=>{if(!live)return;const hash=location.hash.slice(1);pending.current=sections.some(section=>section.id===hash)?hash:null;register();};
  // Profile sections arrive asynchronously; register them when they appear and
  // fulfill a deep link or a click made before the profile finished loading.
  const mutations=new MutationObserver(register);
  mutations.observe(document.querySelector('.settings-content')||document.body,{childList:true,subtree:true});
  queueMicrotask(hashChanged);window.addEventListener('hashchange',hashChanged);window.addEventListener('scroll',update,true);window.addEventListener('resize',update);
  return()=>{live=false;if(frame!==null)cancelAnimationFrame(frame);mutations.disconnect();window.removeEventListener('hashchange',hashChanged);window.removeEventListener('scroll',update,true);window.removeEventListener('resize',update);};
 },[]);
 function go(event:React.MouseEvent<HTMLAnchorElement>,id:string){
  event.preventDefault();setActive(id);const target=document.getElementById(id);pending.current=target?null:id;
  target?.scrollIntoView({behavior:document.documentElement.dataset.motion==='reduced'?'auto':'smooth',block:'start'});history.replaceState(null,'','#'+id);
 }
 return <aside className="settings-context-nav" aria-label="Rubriques des paramètres">{sections.slice(0,3).map(({id,label,Icon})=><a key={id} href={'#'+id} aria-current={active===id?'page':undefined} onClick={event=>go(event,id)}><Icon/>{label}</a>)}<Link href="/apparence"><Palette/>Apparence &amp; Thème</Link>{sections.slice(3).map(({id,label,Icon})=><a key={id} href={'#'+id} aria-current={active===id?'page':undefined} onClick={event=>go(event,id)}><Icon/>{label}</a>)}{admin&&<Link href="/admin"><Shield/>Administration</Link>}</aside>;
}
