'use client';
import {usePathname} from 'next/navigation';
import Link from 'next/link';
import {House,MessageCircle,Users,Hash,Settings} from 'lucide-react';
export default function SocialNav(){const path=usePathname();return <nav className="social-nav" aria-label="Navigation principale"><Link className="social-logo" href="/fil">Luma<span>●</span></Link>{[[House,'/fil','Fil'],[MessageCircle,'/messages','Messages'],[Users,'/amis','Amis'],[Hash,'/communities','Communautés'],[Settings,'/parametres','Paramètres']].map(([Icon,href,label])=>{const I=Icon as typeof House;const active=path===href||(href==='/parametres'&&['/apparence','/mes-donnees'].includes(path));return <Link key={String(href)} href={String(href)} aria-current={active?'page':undefined}><I size={19}/><span>{String(label)}</span></Link>;})}</nav>;}
