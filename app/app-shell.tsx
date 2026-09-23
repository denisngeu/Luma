'use client';
import {usePathname} from 'next/navigation';
import type {ReactNode} from 'react';
import SocialNav from './social-nav';

const routes=['/fil','/messages','/amis','/communities','/parametres','/apparence','/mes-donnees','/appel'];
export default function AppShell({children}:{children:ReactNode}){
 const path=usePathname();
 if(!routes.some(route=>path===route||path.startsWith(route+'/')))return children;
 return <div className="luma-shell"><SocialNav/><div className="luma-page" key={path}>{children}</div></div>;
}
