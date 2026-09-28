import type {MetadataRoute} from 'next';

export default function manifest():MetadataRoute.Manifest{return {
 name:'Luma — Votre cercle',short_name:'Luma',description:'Messages, appels, communautés et publications dans votre cercle.',start_url:'/fil',display:'standalone',background_color:'#0c1122',theme_color:'#11172b',orientation:'portrait-primary',
 icons:[{src:'/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icon-maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],
};}
