'use client';
import {usePathname} from 'next/navigation';
import Link,{useLinkStatus} from 'next/link';
import {House,MessageCircle,Users,Hash,Settings,Sparkles} from 'lucide-react';

function Pending(){const {pending}=useLinkStatus();return <i className="nav-pending" aria-hidden="true" data-pending={pending||undefined}/>;}

export default function SocialNav(){
 const path=usePathname();
 const items=[[MessageCircle,'/messages','Messages'],[House,'/fil','Fil'],[Users,'/amis','Amis'],[Hash,'/communities','Communautés'],[Settings,'/parametres','Paramètres']] as const;
 const active=(href:string)=>path===href||(href==='/parametres'&&['/apparence','/mes-donnees'].some(p=>path.startsWith(p)));
 return <nav className="social-nav" aria-label="Navigation principale"><Link className="social-logo" href="/messages" aria-label="Accueil Luma" prefetch><Sparkles size={24}/><span>Luma</span></Link>{items.map(([Icon,href,label])=><Link key={href} href={href} aria-label={label} title={label} aria-current={active(href)?'page':undefined} prefetch><Icon size={20}/><span>{label}</span><Pending/></Link>)}</nav>;
}
