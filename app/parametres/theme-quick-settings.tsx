'use client';
import {useEffect,useState} from 'react';
import {Sun,Moon,Monitor,Palette} from 'lucide-react';
import {defaults,readTheme,saveTheme,type Theme} from '../theme-provider';

export default function ThemeQuickSettings(){
 const [theme,setTheme]=useState<Theme>(defaults);
 useEffect(()=>{let live=true;queueMicrotask(()=>{if(live)setTheme(readTheme());});return()=>{live=false;};},[]);
 function choose(mode:Theme['mode']){const next={...theme,mode};setTheme(next);saveTheme(next);}
 return <section className="settings-section theme-quick"><div className="settings-heading"><Palette/><div><h2>Apparence</h2><p>Le thème clair est utilisé par défaut. Votre choix reste enregistré sur cet appareil.</p></div></div><div className="theme-quick-options" role="group" aria-label="Thème de l’interface">{([{mode:'light',label:'Clair',Icon:Sun},{mode:'dark',label:'Sombre',Icon:Moon},{mode:'system',label:'Système',Icon:Monitor}] as const).map(({mode,label,Icon})=><button type="button" key={mode} aria-pressed={theme.mode===mode} onClick={()=>choose(mode)}><Icon size={19}/><span>{label}</span></button>)}</div></section>;
}
