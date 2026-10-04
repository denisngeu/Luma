'use client';
import {useEffect,useState} from 'react';
import {Download,Share2,Copy} from 'lucide-react';
import QRCode from 'qrcode';

export default function ContactCard({name,link,onNotice,onError}:{name:string;link:string;onNotice:(message:string)=>void;onError:(message:string)=>void}){
 const [card,setCard]=useState<{url:string;blob:Blob}|null>(null);
 useEffect(()=>{
  let cancelled=false,url='';
  async function create(){
   const canvas=document.createElement('canvas');canvas.width=900;canvas.height=1040;
   const ctx=canvas.getContext('2d')!;
   const gradient=ctx.createLinearGradient(0,0,900,1040);gradient.addColorStop(0,'#111827');gradient.addColorStop(1,'#15162f');ctx.fillStyle=gradient;ctx.fillRect(0,0,900,1040);
   ctx.textAlign='left';ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(54,50,96,96,28);ctx.fillStyle='#171a36';ctx.fill();ctx.strokeStyle='#6366f1';ctx.lineWidth=5;ctx.stroke();ctx.fillStyle='#ffffff';ctx.font='bold 42px sans-serif';ctx.textAlign='center';ctx.fillText(name.trim().charAt(0).toUpperCase()||'L',102,114);
   ctx.textAlign='left';ctx.fillStyle='#ffffff';let size=50;do{ctx.font=`bold ${size}px sans-serif`;size-=2;}while(ctx.measureText(name).width>610&&size>24);let title=name;while(ctx.measureText(title).width>610)title=title.slice(0,-2);if(title!==name)title+='…';ctx.fillText(title,180,94);
   ctx.font='25px sans-serif';ctx.fillStyle='#94a3b8';ctx.fillText('Retrouvons-nous sur Luma',180,132);
   ctx.strokeStyle='#2b3550';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(54,180);ctx.lineTo(846,180);ctx.stroke();
   const qr=document.createElement('canvas');await QRCode.toCanvas(qr,link,{width:540,margin:4,errorCorrectionLevel:'M',color:{dark:'#0b0f17',light:'#ffffff'}});
   ctx.fillStyle='#ffffff';ctx.beginPath();ctx.roundRect(150,225,600,600,30);ctx.fill();ctx.drawImage(qr,180,255);
   ctx.textAlign='center';ctx.fillStyle='#ffffff';ctx.font='bold 30px sans-serif';ctx.fillText('Scannez pour m’ajouter',450,900);
   ctx.fillStyle='#94a3b8';ctx.font='23px sans-serif';ctx.fillText('Une invitation • Votre accord avant tout',450,946);
   ctx.fillStyle='#6366f1';ctx.beginPath();ctx.arc(450,790,42,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ffffff';ctx.font='bold 46px sans-serif';ctx.fillText('L',450,807);
   const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('Création de la carte impossible.')),'image/png'));
   if(cancelled)return;url=URL.createObjectURL(blob);setCard({url,blob});
  }
  create().catch(()=>{if(!cancelled)onError('Impossible de créer la carte. Réessayez en rechargeant la page.');});
  return()=>{cancelled=true;if(url)URL.revokeObjectURL(url);};
 },[name,link,onError]);
 async function share(){
  if(!card)return;
  try{
   const native=(window as Window&{ReactNativeWebView?:{postMessage:(message:string)=>void}}).ReactNativeWebView;
   if(native){const reader=new FileReader();reader.onload=()=>native.postMessage(JSON.stringify({type:'share-contact-card',image:reader.result}));reader.readAsDataURL(card.blob);return;}
   const file=new File([card.blob],'ma-carte-luma.png',{type:'image/png'});
   if(navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:`${name} — Luma`});return;}
   if(navigator.share){await navigator.share({title:`${name} — Luma`,text:'Ajoutez-moi sur Luma',url:link});return;}
   const a=document.createElement('a');a.href=card.url;a.download='ma-carte-luma.png';a.click();onNotice('Carte téléchargée. Vous pouvez la joindre à votre message.');
  }catch(e){if(!(e instanceof Error&&e.name==='AbortError'))onError('Le partage a échoué. Vous pouvez télécharger la carte ou copier le lien.');}
 }
 return <div className="contact-share"><div className="contact-share-preview">{card?<img src={card.url} width={300} height={373} alt={`Carte de contact de ${name}, avec QR code pour l’ajouter sur Luma`}/>:<p>Préparation de votre carte…</p>}</div><div className="contact-share-details"><span className="contact-eyebrow">VOTRE CARTE LUMA</span><h3>Un scan pour se retrouver.</h3><p>Envoyez cette carte en message, par e-mail ou dans une autre application. Votre contact pourra scanner le QR code pour vous demander en ami.</p><div className="contact-share-actions"><button disabled={!card} onClick={share}><Share2 size={18}/> Partager ma carte</button>{card&&<a className="contact-download" href={card.url} download="ma-carte-luma.png" onClick={e=>{if((window as Window&{ReactNativeWebView?:unknown}).ReactNativeWebView){e.preventDefault();void share();}}}><Download size={18}/> Télécharger l’image</a>}<button className="contact-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(link);onNotice('Lien d’invitation copié.');}catch{onError('Copie indisponible. Copiez le lien affiché ci-dessous.');}}}><Copy size={16}/> Copier le lien</button></div><input aria-label="Mon lien d’invitation" readOnly value={link} onFocus={e=>e.currentTarget.select()}/><small>Votre adresse e-mail n’apparaît pas sur la carte. Renouveler le QR code désactive les anciennes cartes.</small></div></div>;
}
