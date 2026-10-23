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
 writeFileSync(path.join(dir,'navigation.ts'),`export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);export const useRouter=()=>({push(url){window.__destination=url;}});`);
 writeFileSync(path.join(dir,'link.tsx'),`import React from 'react';export const useLinkStatus=()=>({pending:false});export default function Link({children,prefetch,replace,scroll,...props}){return <a {...props}>{children}</a>}`);
 writeFileSync(path.join(dir,'image.tsx'),`import React from 'react';export default function Image({priority,fill,...props}){return <img {...props}/>}`);
 writeFileSync(path.join(dir,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Shell from '../../app/app-shell';import Theme from '../../app/theme-provider';import Feed from '../../app/fil/feed';import Friends from '../../app/amis/page';import Settings from '../../app/parametres/page';import Messenger from '../../app/messenger';import Community from '../../app/communities/workspace';import Appearance from '../../app/apparence/page';(async()=>{const view=location.pathname==='/apparence'?<Appearance/>:location.pathname==='/parametres'?await Settings():location.pathname==='/amis'?<Friends/>:location.pathname==='/messages'?<Messenger/>:location.pathname==='/communities'?<Community/>:<Feed/>;createRoot(document.getElementById('root')).render(<><Theme/><Shell>{view}</Shell></>);})();`);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts'),'next/link':path.join(dir,'link.tsx'),'next/image':path.join(dir,'image.tsx')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'},plugins:[{name:'local-auth',setup(b){b.onResolve({filter:/(chatgpt-auth$|^@\/lib\/admin$)/},a=>({path:a.path,namespace:'local-auth'}));b.onLoad({filter:/.*/,namespace:'local-auth'},a=>({loader:'js',contents:a.path.includes('admin')?'export const isAdministrator=async()=>false;':`export const requireChatGPTUser=async()=>({userId:'me',email:'compte@example.test'});export const chatGPTSignOutPath=()=>'/api/auth/logout';`}));}}]});
 const css=compiledStyles()+(process.env.LUMA_UI_SOURCE_PREVIEW==='1'?readFileSync('app/mobile-reference.css','utf8'):'');
 const profile={id:'me',name:'Compte de test',bio:'Retrouvons-nous sur Luma.',avatar:false,notifications:'mentions',call_camera:0,call_noise_suppression:1,call_echo_cancellation:1,reduce_motion:1};
 const chats=[{id:'direct-test',name:'Contact de test',kind:'direct',owner:'me',preview:'On se retrouve ce soir ?',unread:2},{id:'group-test',name:'Groupe de test',kind:'group',owner:'me',preview:'À bientôt dans le salon',unread:0}];
 const channels=[{id:'general-test',name:'général',mode:'text',owner:'me'},{id:'annonces-test',name:'annonces',mode:'announcement',owner:'me'},{id:'live-test',name:'Salon vocal en direct',mode:'voice',owner:'me'},{id:'voice-test',name:'Salon vocal disponible',mode:'voice',owner:'me'}];
 const space={id:'space-test',name:'Communauté de test',description:'Un espace pour se retrouver.',invite:'fixture-only',role:'owner'};
 const communityFeed={messages:[{id:'message-test',body:'Bienvenue dans le salon. Retrouvez les autres membres dans le vocal !',name:'Contact de test',author:'peer-0',created:Date.now(),scheduled:0,replies:0,starred:0,pinned:0,edited:0}],reactions:[],polls:[],votes:[],pinned:[],more:false};
 const privateMessages=[...communityFeed.messages,{...communityFeed.messages[0],id:'my-message-test',author:'me',name:profile.name,body:'Voici ma réponse à notre discussion.'}];
 const friends={profile:{code:'fixture-only',discoverable:1},user:profile,items:Array.from({length:3},(_,i)=>({id:'friend-'+i,sender:'me',recipient:'peer-'+i,state:'accepted',name:['Contact de test','Autre contact','Mon ami'][i],peer:'peer-'+i}))};
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname.startsWith('/api/')){
   let body='';for await(const c of req)body+=c;let p={};try{p=JSON.parse(body||'{}')}catch{}let out={ok:true};
   if(url.pathname==='/api/profile')out=req.method==='GET'?{profile}:out;
   else if(url.pathname==='/api/friends'){if(p.action==='rotate')friends.profile.code='fixture-rotation-'+(++rotations);out=friends;}
   else if(url.pathname==='/api/auth/sessions')out={sessions:[{created:Date.now()-60000,expires:Date.now()+86400000}]};
   else if(url.pathname==='/api/social')out=p.action==='profile'?{profile}:{items:[{id:'fixture-post',author:'peer-0',name:'Contact de test',body:'Une nouvelle pour notre cercle. On se retrouve ce soir dans le salon vocal ?',created:Date.now(),edited:0,avatar:false,likes:2,liked:0,comments:0,media:[]}],next:null};
   else if(url.pathname==='/api/chat')out=p.action==='list'?{user:profile,chats}:p.action==='messages'?{messages:privateMessages,readCursor:{sequence:0,through:0}}:{ok:true,unread:0};
   else if(url.pathname==='/api/rooms')out=p.action==='active_many'?{rooms:Object.fromEntries(p.chats.map(chat=>[chat,chat==='live-test'?{id:'live-room-test',participants:2,mode:'audio'}:null]))}:{room:p.chat==='live-test'?{id:'live-room-test',participants:2,mode:'audio'}:null};
   else if(url.pathname==='/api/community')out=p.action==='spaces'?{spaces:[space],user:profile}:p.action==='space'?{space,channels,members:[{user:'me',name:profile.name,role:(req.headers.referer||'').includes('member=1')?'member':'owner'}],bots:[],role:(req.headers.referer||'').includes('member=1')?'member':'owner'}:communityFeed;
   else if(url.pathname==='/api/calls')out={items:[],calls:[]};
   res.setHeader('Content-Type','application/json');res.end(JSON.stringify(out));return;
  }
  if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  if(url.pathname==='/luma-logo.png'){res.setHeader('Content-Type','image/png');res.end(readFileSync('public/luma-logo.png'));return;}
  const mode=url.searchParams.get('theme')==='light'?'light':'dark';
  res.setHeader('Content-Type','text/html');res.end('<html data-luma="'+mode+'" data-motion="reduced"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><script>if(!localStorage.getItem("luma-theme"))localStorage.setItem("luma-theme",JSON.stringify({mode:"'+mode+'",accent:"#7068ff"}));</script><div id="root"></div><script src="/app.js"></script></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const measurements=[];
 for(const width of [320,390,1280,1920])for(const route of (process.env.LUMA_UI_ROUTES||'fil,amis,parametres,messages,communities').split(','))for(const mode of ['dark','light']){
  win=new BrowserWindow({width,height:844});await win.loadURL('http://127.0.0.1:'+server.address().port+'/'+route+'?theme='+mode);
  const ready=route==='parametres'?'.settings-profile':route==='amis'?'.contact-share-preview img':route==='messages'?'[aria-label^="Ouvrir la discussion"]':route==='communities'?'.channel-list .channel':'.social-post';
  await until(()=>win.page.locator(ready).count(),route+' loaded');await win.page.evaluate(()=>document.fonts.ready);
  const metrics=await win.page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,pageOverflow:document.querySelector('.luma-page').scrollWidth>document.querySelector('.luma-page').clientWidth,icons:[...document.querySelectorAll('.settings-heading>svg,.settings-links>a>svg:first-child')].map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {width:r.width,content:r.width-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),box:s.boxSizing}}),text:[...document.querySelectorAll('.settings-heading p,.post-body,.contact-share-details p,.stitch-messenger-root aside .text-body-sm,.hub-message-main>p')].map(n=>parseFloat(getComputedStyle(n).fontSize))}));
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
  if(process.env.LUMA_UI_CAPTURE==='after'&&route==='messages'){
   await win.page.getByRole('button',{name:'Groupes',exact:true}).click();assert.equal(await win.page.getByRole('button',{name:'Ouvrir la discussion avec Contact de test',exact:true}).count(),0,'group filter excludes direct chats');
   await win.page.getByRole('button',{name:'Toutes',exact:true}).click();await win.page.getByRole('button',{name:'Ouvrir la discussion avec Contact de test',exact:true}).click();
   await until(()=>win.page.getByText(communityFeed.messages[0].body,{exact:true}).isVisible(),'chat opens');
   assert.equal(await win.page.getByLabel('Message à Contact de test').isVisible(),true,'composer available');
   if(width<=760){const bounds=await win.page.getByLabel('Message à Contact de test').evaluate(node=>{const r=node.getBoundingClientRect();return {width:r.width,bottom:r.bottom,nav:document.querySelector('.luma-shell>.social-nav').getBoundingClientRect().top};});assert.ok(bounds.width>=90,'room to type on a small phone');assert.ok(bounds.bottom<=bounds.nav,'composer clears mobile navigation');}
   writeFileSync('outputs/ui-after-conversation-'+width+'-'+mode+'.png',await win.page.screenshot());
   if(width<=760){await win.page.getByLabel('Options de la discussion',{exact:true}).click();await win.page.getByRole('button',{name:'Planifier un message',exact:true}).click();assert.equal(await win.page.locator('input[type=datetime-local]').isVisible(),true,'schedule stays accessible from mobile menu');await win.page.keyboard.press('Escape');await win.page.getByRole('button',{name:'Revenir aux discussions',exact:true}).click();assert.equal(await win.page.getByRole('button',{name:'Ouvrir la discussion avec Contact de test',exact:true}).isVisible(),true);}
  }
  if(process.env.LUMA_UI_CAPTURE==='after'&&route==='communities'){
   await win.page.getByRole('button',{name:'Ajouter une communauté',exact:true}).click();assert.equal(await win.page.getByRole('menuitem',{name:'Créer une communauté',exact:true}).isVisible(),true);
   const picker=await win.page.getByRole('menu').evaluate(menu=>{const r=menu.getBoundingClientRect(),s=getComputedStyle(menu);return {background:s.backgroundColor,left:r.left,right:r.right,viewport:innerWidth,items:[...menu.querySelectorAll('[role=menuitem]')].map(item=>{const b=item.getBoundingClientRect(),hit=document.elementFromPoint(b.left+8,b.top+b.height/2);return {height:b.height,uncovered:item.contains(hit)};})};});
   assert.notEqual(picker.background,'rgba(0, 0, 0, 0)','community menu has an opaque background');assert.ok(picker.left>=0&&picker.right<=picker.viewport,'community menu fits viewport');assert.ok(picker.items.every(item=>item.height>=44&&item.uncovered),'community actions are touch-sized and above navigation');
   writeFileSync('outputs/ui-after-community-menu-'+width+'-'+mode+'.png',await win.page.screenshot());
   await win.page.getByRole('menuitem',{name:'Rejoindre une communauté',exact:true}).click();assert.equal(await win.page.getByRole('dialog').getByLabel('Code d’invitation',{exact:true}).isVisible(),true);await win.page.keyboard.press('Escape');
   await until(()=>win.page.locator('.voice-channel.is-live').count(),'live voice room shown');
   await win.page.locator('.voice-channel.is-live').click();assert.equal(await win.page.evaluate(()=>window.__destination),'/salle/live-room-test');
   await win.page.locator('.channel:not(.voice-channel)').first().click();await until(()=>win.page.getByText(communityFeed.messages[0].body,{exact:true}).isVisible(),'text channel opens');
   for(const name of ['Réagir au message','Options du message']){await win.page.getByRole('button',{name,exact:true}).click();const menu=await win.page.getByRole('menu').evaluate(el=>({background:getComputedStyle(el).backgroundColor,z:Number(getComputedStyle(el).zIndex)}));assert.notEqual(menu.background,'rgba(0, 0, 0, 0)',name+' has a solid theme background');assert.ok(menu.z>=1000,name+' clears navigation');await win.page.keyboard.press('Escape');}
   assert.equal(await win.page.evaluate(()=>document.querySelector('.luma-page').scrollWidth>document.querySelector('.luma-page').clientWidth),false,'opened channel fits viewport');
   if(width<=760)assert.ok(await win.page.getByRole('textbox',{name:'Message dans le salon',exact:true}).evaluate(node=>parseFloat(getComputedStyle(node).fontSize))>=13,'readable channel composer');
   writeFileSync('outputs/ui-after-channel-'+width+'-'+mode+'.png',await win.page.screenshot());
   if(width<=760){await win.page.getByRole('button',{name:'Retour aux salons',exact:true}).click();assert.equal(await win.page.locator('.channel-list').isVisible(),true);}
  }
  win.destroy();win=null;
 }
 if(process.env.LUMA_UI_CAPTURE==='after'&&(process.env.LUMA_UI_ROUTES||'communities').includes('communities')){
  win=new BrowserWindow({width:390,height:844});await win.loadURL('http://127.0.0.1:'+server.address().port+'/communities?member=1');
  await until(()=>win.page.getByRole('button',{name:'Membres',exact:true}).count(),'member toolbar');
  assert.equal(await win.page.getByRole('button',{name:'Créer un salon',exact:true}).count(),0,'members do not get moderation-only creation controls');
  await win.page.getByRole('button',{name:'Membres',exact:true}).click();await until(()=>win.page.locator('.hub-detail .hub-member').first().isVisible(),'member roster opens');win.destroy();win=null;
 }
 if(process.env.LUMA_UI_PREFERENCES==='1'){
  const base='http://127.0.0.1:'+server.address().port;
  for(const width of [320,1280])for(const mode of ['light','dark']){
   win=new BrowserWindow({width,height:844});await win.loadURL(base+'/apparence?theme='+mode);
   for(const size of [20,14]){
    await win.page.goto(base+'/apparence?theme='+mode);await win.page.locator('.appearance').hover();await win.page.mouse.wheel(0,900);await until(()=>win.page.locator('.appearance').evaluate(el=>el.scrollTop>0),'appearance scrolls with a wheel gesture');
    const select=win.page.getByLabel('Taille des messages',{exact:true});await select.selectOption(String(size));
    await win.page.reload();await until(async()=>await select.inputValue()===String(size),'message size survives reload');
    assert.equal(await win.page.locator('.preview-bubble').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),size,'preview matches saved size');
    for(const route of ['fil','messages','communities']){
     await win.page.goto(base+'/'+route+'?theme='+mode);
     if(route==='messages'){await win.page.getByRole('button',{name:'Ouvrir la discussion avec Contact de test',exact:true}).click();}
     if(route==='communities'){await win.page.locator('.channel:not(.voice-channel)').first().click();}
     const body=win.page.locator(route==='fil'?'.social-post>.post-body':route==='messages'?'.messenger-message-body':'.hub-message-main>p').first();await body.waitFor({state:'visible'});
     assert.equal(await body.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),size,route+' respects saved message size');
     if(route==='fil'){await win.page.getByRole('button',{name:'0 commentaires',exact:true}).click();const comment=win.page.locator('.social-comment>div>p').first();await comment.waitFor({state:'visible'});assert.equal(await comment.evaluate(el=>parseFloat(getComputedStyle(el).fontSize)),size,'comments respect saved message size');}
     assert.equal(await win.page.evaluate(()=>document.querySelector('.luma-page').scrollWidth>document.querySelector('.luma-page').clientWidth),false,route+' fits at '+size+'px');
     if(size===20)writeFileSync('outputs/ui-message-size-'+route+'-'+width+'-'+mode+'.png',await win.page.screenshot());
    }
   }
   await win.page.goto(base+'/apparence?theme='+mode);await win.page.locator('.appearance').hover();await win.page.mouse.wheel(0,10000);await until(()=>win.page.locator('.appearance').evaluate(el=>el.scrollTop>0),'appearance reaches bottom');
   const reset=await win.page.getByRole('button',{name:'Rétablir le thème Luma',exact:true}).evaluate(el=>({bottom:el.getBoundingClientRect().bottom,limit:Math.min(innerHeight,document.querySelector('.appearance').getBoundingClientRect().bottom)}));assert.ok(reset.bottom<=reset.limit,'last appearance control is reachable');
   writeFileSync('outputs/ui-appearance-scroll-'+width+'-'+mode+'.png',await win.page.screenshot());
   win.destroy();win=null;
  }
  console.log('PASS saved message sizes 14/20 across feed, private chats and communities, mobile/desktop and both themes.');
 }
 if(process.env.LUMA_UI_LAYOUT_PREFERENCES==='1'){
  const base='http://127.0.0.1:'+server.address().port,preferenceChecks=[];
  for(const width of [320,1280])for(const mode of ['light','dark']){
   win=new BrowserWindow({width,height:844});await win.loadURL(base+'/apparence?theme='+mode);const phases={};
   for(const [phase,density,contrast] of [['normal','comfortable','normal'],['compact-high','compact','high'],['restored','comfortable','normal']]){
    await win.page.goto(base+'/apparence?theme='+mode);await win.page.getByLabel('Espacement',{exact:true}).selectOption(density);await win.page.getByLabel('Contraste',{exact:true}).selectOption(contrast);await win.page.reload();
    await until(async()=>await win.page.getByLabel('Espacement',{exact:true}).inputValue()===density&&await win.page.getByLabel('Contraste',{exact:true}).inputValue()===contrast,'layout preferences survive reload');
    const views={};
    for(const route of ['fil','messages','communities']){
     await win.page.goto(base+'/'+route+'?theme='+mode);let touchHeight;
     if(route==='messages'){const chat=win.page.getByRole('button',{name:'Ouvrir la discussion avec Contact de test',exact:true});touchHeight=await chat.evaluate(el=>el.getBoundingClientRect().height);await chat.click();}
     if(route==='communities'){const channel=win.page.locator('.channel:not(.voice-channel)').first();touchHeight=await channel.evaluate(el=>el.getBoundingClientRect().height);await channel.click();}
     const body=win.page.locator(route==='fil'?'.social-post>.post-body':route==='messages'?'.messenger-message-body':'.hub-message-main>p').first();await body.waitFor({state:'visible'});await win.page.evaluate(()=>document.fonts.ready);
     const view=await body.evaluate((el,route)=>{
      const meta=route==='fil'?el.closest('.social-post').querySelector('header small'):route==='messages'?el.closest('.group').querySelector('.text-outline'):el.closest('.hub-message').querySelector('time');
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d');const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};const blend=(fg,bg)=>fg.slice(0,3).map((v,i)=>v*fg[3]/255+bg[i]*(1-fg[3]/255));
      const luminance=rgb=>{const c=rgb.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
      const ratio=target=>{const layers=[];for(let node=target;node;node=node.parentElement){const c=rgba(getComputedStyle(node).backgroundColor);if(c[3])layers.push(c);if(c[3]===255)break;}let background=[255,255,255];for(const layer of layers.reverse())background=blend(layer,background);const text=luminance(blend(rgba(getComputedStyle(target).color),background)),bg=luminance(background);return (Math.max(text,bg)+.05)/(Math.min(text,bg)+.05);};
      const spacing=route==='fil'?getComputedStyle(el).marginTop:route==='messages'?getComputedStyle(el.parentElement).paddingTop:getComputedStyle(el.closest('.hub-message')).paddingTop;
      return {spacing:parseFloat(spacing),font:parseFloat(getComputedStyle(el).fontSize),contrast:ratio(meta),bodyContrasts:(route==='messages'?[...document.querySelectorAll('.messenger-message-body')]:[el]).map(ratio),iconContrasts:route==='messages'?[...document.querySelectorAll('.messenger-message-bubble button')].map(ratio):[],sentTimeContrasts:route==='messages'?[...document.querySelectorAll('.messenger-message-bubble .text-primary-fixed-dim .font-label-caps')].map(ratio):[],deliveryContrasts:route==='messages'?[...document.querySelectorAll('.messenger-message-bubble .text-tertiary')].map(ratio):[],color:getComputedStyle(meta).color,overflow:document.querySelector('.luma-page').scrollWidth>document.querySelector('.luma-page').clientWidth};
     },route);
     views[route]={...view,touchHeight};if(phase==='compact-high')writeFileSync('outputs/ui-preferences-'+route+'-'+width+'-'+mode+'.png',await win.page.screenshot());
    }
    phases[phase]=views;
   }
   preferenceChecks.push({width,mode,phases});win.destroy();win=null;
  }
  writeFileSync('outputs/ui-layout-preferences-metrics.json',JSON.stringify(preferenceChecks,null,2));
  for(const check of preferenceChecks)for(const route of ['fil','messages','communities']){const normal=check.phases.normal[route],compact=check.phases['compact-high'][route],restored=check.phases.restored[route];assert.ok(compact.contrast>normal.contrast,route+' high contrast visibly strengthens secondary text at '+check.width+' '+check.mode);assert.ok(compact.contrast>=4.5,route+' high contrast text remains legible');assert.ok(compact.spacing<normal.spacing,route+' compact mode reduces actual message spacing');assert.equal(compact.font,normal.font,'density preserves chosen message size');assert.equal(compact.overflow,false,'compact content fits');if(compact.touchHeight!==undefined){assert.ok(compact.touchHeight>=44,'compact targets remain touch-sized');assert.ok(compact.touchHeight<=normal.touchHeight,'compact targets do not grow');}for(const phase of [normal,compact,restored]){assert.ok(phase.bodyContrasts.every(ratio=>ratio>=4.5),'message text stays readable in '+route+' '+check.width+' '+check.mode);assert.ok(phase.iconContrasts.every(ratio=>ratio>=4.5),'copy action stays visible');if(route==='messages'){assert.equal(phase.bodyContrasts.length,2,'sent and received message colors are checked');assert.equal(phase.sentTimeContrasts.length,1,'sent message timestamp is checked');assert.ok(phase.sentTimeContrasts.every(ratio=>ratio>=4.5),'sent timestamp remains readable');assert.equal(phase.deliveryContrasts.length,1,'sent status is checked');assert.ok(phase.deliveryContrasts.every(ratio=>ratio>=3),'sent status remains visible');}}assert.equal(restored.spacing,normal.spacing,'comfortable spacing is restored');assert.ok(Math.abs(restored.contrast-normal.contrast)<.01,'normal contrast is restored');}
  console.log('PASS persisted density/contrast preferences across feed, private chats and communities, both widths and themes, with touch targets and restoration.');
 }
 if(process.env.LUMA_UI_BACKGROUNDS==='1'){
  const base='http://127.0.0.1:'+server.address().port,checks=[];
  for(const width of [320,1280])for(const mode of ['light','dark']){
   win=new BrowserWindow({width,height:844});await win.loadURL(base+'/apparence?theme='+mode);const phases=[];
   for(const background of ['plain','aurora','dusk','plain']){
    await win.page.goto(base+'/apparence?theme='+mode);await win.page.getByLabel('Fond des conversations',{exact:true}).selectOption(background);await win.page.reload();
    await until(async()=>await win.page.getByLabel('Fond des conversations',{exact:true}).inputValue()===background,'conversation background survives reload');
    const preview=await win.page.locator('.preview-canvas').evaluate(el=>({image:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).backgroundColor,size:getComputedStyle(el).backgroundSize})),views={};
    for(const route of ['messages','communities']){
     await win.page.goto(base+'/'+route+'?theme='+mode);
     if(route==='messages')await win.page.getByRole('button',{name:'Ouvrir la discussion avec Contact de test',exact:true}).click();else await win.page.locator('.channel:not(.voice-channel)').first().click();
     const pane=win.page.locator(route==='messages'?'.messenger-message-list':'.hub-messages');await pane.waitFor({state:'visible'});
     views[route]=await pane.evaluate(el=>({image:getComputedStyle(el).backgroundImage,color:getComputedStyle(el).backgroundColor,size:getComputedStyle(el).backgroundSize,overflow:el.scrollWidth>el.clientWidth}));
     if(background==='aurora')writeFileSync('outputs/ui-background-'+route+'-'+width+'-'+mode+'.png',await win.page.screenshot());
    }
    phases.push({background,preview,views});
   }
   checks.push({width,mode,phases});win.destroy();win=null;
  }
  writeFileSync('outputs/ui-background-'+(process.env.LUMA_UI_CAPTURE||'current')+'-metrics.json',JSON.stringify(checks,null,2));
  for(const check of checks){const images=check.phases.slice(0,3).map(p=>p.preview.image);assert.equal(images[0],'none','plain background has no decoration');assert.equal(new Set(images).size,3,'three distinct background choices');for(const phase of check.phases)for(const [route,view] of Object.entries(phase.views)){assert.equal(view.image,phase.preview.image,route+' background matches the chosen preview at '+check.width+' '+check.mode+' '+phase.background);assert.equal(view.color,phase.preview.color,'background retains theme canvas color');assert.equal(view.size,'auto','gradient is not tiled');assert.equal(view.overflow,false,'background does not overflow');}assert.deepEqual(check.phases[3].views,check.phases[0].views,'plain background is restored');}
  console.log('PASS saved backgrounds match preview in private and community conversations, both themes and widths, with restoration.');
 }
 writeFileSync('outputs/ui-'+(process.env.LUMA_UI_CAPTURE||'current')+'-metrics.json',JSON.stringify(measurements,null,2));console.log('PASS '+measurements.length+' responsive/theme views and relevant page interactions.');
 }catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}});
setTimeout(()=>app.exit(1),180000);
