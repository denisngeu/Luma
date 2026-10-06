'use client';
import {useEffect,useState} from 'react';
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
 useEffect(()=>{const hash=location.hash.slice(1);if(sections.some(section=>section.id===hash))queueMicrotask(()=>setActive(hash));const nodes=sections.map(section=>document.getElementById(section.id)).filter((node):node is HTMLElement=>!!node);const observer=new IntersectionObserver(entries=>{const visible=entries.filter(entry=>entry.isIntersecting).sort((a,b)=>b.intersectionRatio-a.intersectionRatio)[0];if(visible)setActive(visible.target.id);},{rootMargin:'-16% 0px -68% 0px',threshold:[0,.15,.4]});nodes.forEach(node=>observer.observe(node));return()=>observer.disconnect();},[]);
 function go(event:React.MouseEvent<HTMLAnchorElement>,id:string){event.preventDefault();setActive(id);document.getElementById(id)?.scrollIntoView({behavior:document.documentElement.dataset.motion==='reduced'?'auto':'smooth',block:'start'});history.replaceState(null,'','#'+id);}
 return <aside className="settings-context-nav" aria-label="Rubriques des paramètres">{sections.slice(0,3).map(({id,label,Icon})=><a key={id} href={'#'+id} aria-current={active===id?'page':undefined} onClick={event=>go(event,id)}><Icon/>{label}</a>)}<Link href="/apparence"><Palette/>Apparence &amp; Thème</Link>{sections.slice(3).map(({id,label,Icon})=><a key={id} href={'#'+id} aria-current={active===id?'page':undefined} onClick={event=>go(event,id)}><Icon/>{label}</a>)}{admin&&<Link href="/admin"><Shield/>Administration</Link>}</aside>;
}
