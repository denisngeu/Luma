/* Visual checks use the actual pages and production CSS; fixtures stay local. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/ui-reference');mkdirSync(dir,{recursive:true});mkdirSync('outputs',{recursive:true});
let server,win,rotations=0;const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await delay(100);}throw Error('Timeout '+label);}
app.whenReady().then(async()=>{try{
 writeFileSync(path.join(dir,'navigation.ts'),`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(url){location.assign(url);}});`);
 writeFileSync(path.join(dir,'link.tsx'),`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({children,prefetch,replace,scroll,...props}){return <a {...props}>{children}</a>}`);
 writeFileSync(path.join(dir,'image.tsx'),`import React from 'react';export default function Image({priority,fill,...props}){return <img {...props}/>}`);
 writeFileSync(path.join(dir,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Shell from '../../app/app-shell';import Theme from '../../app/theme-provider';import Feed from '../../app/fil/feed';import Friends from '../../app/amis/page';import Settings from '../../app/parametres/page';(async()=>{const view=location.pathname==='/parametres'?await Settings():location.pathname==='/amis'?<Friends/>:<Feed/>;createRoot(document.getElementById('root')).render(<><Theme/><Shell>{view}</Shell></>);})();`);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts'),'next/link':path.join(dir,'link.tsx'),'next/image':path.join(dir,'image.tsx')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'local-auth',setup(b){b.onResolve({filter:/(chatgpt-auth$|^@\/lib\/admin$)/},a=>({path:a.path,namespace:'local-auth'}));b.onLoad({filter:/.*/,namespace:'local-auth'},a=>({loader:'js',contents:a.path.includes('admin')?'export const isAdministrator=async()=>false;':`export const requireChatGPTUser=async()=>({userId:'me',email:'compte@example.test'});export const chatGPTSignOutPath=()=>'/api/auth/logout';`}));}}]});
 const css=compiledStyles();
 const profile={id:'me',name:'Compte de test',bio:'Retrouvons-nous sur Luma.',avatar:false,notifications:'mentions',call_camera:0,call_noise_suppression:1,call_echo_cancellation:1,reduce_motion:1};
 const friends={profile:{code:'fixture-only',discoverable:1},user:profile,items:Array.from({length:3},(_,i)=>({id:'friend-'+i,sender:'me',recipient:'peer-'+i,state:'accepted',name:['Contact de test','Autre contact','Mon ami'][i],peer:'peer-'+i}))};
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/')){
   let body='';for await(const c of req)body+=c;let p={};try{p=JSON.parse(body||'{}')}catch{}let out={ok:true};
   if(url.pathname==='/api/profile')out=req.method==='GET'?{profile}:out;
   else if(url.pathname==='/api/friends'){if(p.action==='rotate')friends.profile.code='fixture-rotation-'+(++rotations);out=friends;}
   else if(url.pathname==='/api/auth/sessions')out={sessions:[{created:Date.now()-60000,expires:Date.now()+86400000}]};
   else if(url.pathname==='/api/social')out=p.action==='profile'?{profile}:{items:[{id:'fixture-post',author:'peer-0',name:'Contact de test',body:'Une nouvelle pour notre cercle. On se retrouve ce soir dans le salon vocal ?',created:Date.now(),edited:0,avatar:false,likes:2,liked:0,comments:0,media:[]}],next:null};
   else if(url.pathname==='/api/calls')out={items:[],calls:[]};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(out));return;
  }
  if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  if(url.pathname==='/luma-logo.png'){res.setHeader('Content-Type','image/png');res.end(readFileSync('public/luma-logo.png'));return;}
  const mode=url.searchParams.get('theme')==='light'?'light':'dark';
  res.setHeader('Content-Type','text/html');res.end('<html data-luma="'+mode+'" data-motion="reduced"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><script>localStorage.setItem("luma-theme",JSON.stringify({mode:"'+mode+'",accent:"#7068ff"}));</script><div id="root"></div><script src="/app.js"></script></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const measurements=[];
 for(const width of [320,390,1280,1920])for(const route of ['fil','amis','parametres'])for(const mode of ['dark','light']){
  win=new BrowserWindow({width,height:844});await win.loadURL('http://127.0.0.1:'+server.address().port+'/'+route+'?theme='+mode);
  const ready=route==='parametres'?'.settings-profile':route==='amis'?'.contact-share-preview img':'.social-post';
  await until(()=>win.page.locator(ready).count(),route+' loaded');await win.page.evaluate(()=>document.fonts.ready);
  const metrics=await win.page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,pageOverflow:document.querySelector('.luma-page').scrollWidth>document.querySelector('.luma-page').clientWidth,icons:[...document.querySelectorAll('.settings-heading>svg,.settings-links>a>svg:first-child')].map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {width:r.width,content:r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),box:s.boxSizing}}),text:[...document.querySelectorAll('.settings-heading p,.post-body,.contact-share-details p')].map(n=>parseFloat(getComputedStyle(n).fontSize))}));
  measurements.push({route,width,mode,...metrics});if(process.env.LUMA_UI_CAPTURE==='after'){assert.ok(metrics.text.every(size=>size>=11),'readable body copy '+route);assert.ok(metrics.icons.every(icon=>icon.content>=14),'visible icon glyphs '+route);}assert.equal(metrics.overflow,false,route+' viewport overflow '+width);assert.equal(metrics.pageOverflow,false,route+' content overflow '+width);
  const label=process.env.LUMA_UI_CAPTURE||'current';writeFileSync('outputs/ui-'+label+'-'+route+'-'+width+'-'+mode+'.png',await win.page.screenshot());
  if(process.env.LUMA_UI_CAPTURE==='after'&&route==='amis'){
   const field=win.page.getByLabel('Mon lien d’invitation');const previous=await field.inputValue();
   await win.page.getByRole('button',{name:'Renouveler mon QR code',exact:true}).click();
   await until(async()=>await field.inputValue()!==previous,'QR renewed');
   await win.page.getByRole('tab',{name:'Mes amis',exact:true}).click();
   assert.equal(await win.page.getByRole('tab',{name:'Mes amis',exact:true}).getAttribute('aria-selected'),'true');
  }
  if(process.env.LUMA_UI_CAPTURE==='after'&&route==='parametres'&&width<=760){
   const details=win.page.locator('.settings-device-options');assert.equal(await details.getAttribute('open'),null,'advanced devices initially collapsed on mobile');
   await win.page.getByText('Microphone et sortie audio',{exact:true}).click();
   await until(()=>win.page.getByLabel('Périphérique d’entrée').isVisible(),'microphone options expanded');
   const control=win.page.getByRole('switch').first();const previous=await control.getAttribute('aria-checked');await control.click();
   await until(async()=>await control.getAttribute('aria-checked')!==previous,'real switch toggled');
  }
  win.destroy();win=null;
 }
 writeFileSync('outputs/ui-'+(process.env.LUMA_UI_CAPTURE||'current')+'-metrics.json',JSON.stringify(measurements,null,2));console.log('PASS '+measurements.length+' responsive/theme views, QR renewal, contact tabs and mobile device/switch controls.');
 }catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}});
setTimeout(()=>app.exit(1),180000);
