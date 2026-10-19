/* Responsive layout checks using the actual shell, feed and stylesheet order. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/feed-layout');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win;
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'navigation.ts'),"export const usePathname=()=>'/fil';export const useSearchParams=()=>new URLSearchParams();");
  writeFileSync(path.join(dir,'image.tsx'),"import React from 'react';export default function Image({src,alt,width,height,className}){return <img src={src} alt={alt} width={width} height={height} className={className}/>;}");
  writeFileSync(path.join(dir,'entry.tsx'),"import React from 'react';import {createRoot} from 'react-dom/client';import Feed from '../../app/fil/feed';import Shell from '../../app/app-shell';import Theme from '../../app/theme-provider';createRoot(document.getElementById('root')).render(<React.StrictMode><Theme/><Shell><Feed/></Shell></React.StrictMode>);");
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts'),'next/image':path.join(dir,'image.tsx')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  // Run after the production build so Tailwind resets and all CSS overrides
  // are tested exactly as bundled, including the native [hidden] behavior.
  const styles=compiledStyles();
  server=createServer(async(req,res)=>{
   if(req.url.startsWith('/api/')){
    let raw='';for await(const part of req)raw+=part;const p=JSON.parse(raw||'{}');res.setHeader('Content-Type','application/json');
    const profile={id:'me',name:'Compte de test',bio:'',avatar:false};
    if(req.url==='/api/friends')res.end(JSON.stringify({profile:{code:'test'},user:profile,items:[]}));
    else if(p.action==='profile')res.end(JSON.stringify({profile}));
    else res.end(JSON.stringify({items:[{id:'layout-post',author:'me',name:'Compte de test',avatar:false,body:Array.from({length:50},(_,i)=>'Ligne de vérification '+(i+1)).join('\n'),created:1700000000000,edited:0,likes:0,liked:0,comments:0,media:[]}],next:null}));
    return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   if(req.url.startsWith('/_next/image')||req.url==='/luma-logo.png'){res.setHeader('Content-Type','image/png');res.end(readFileSync('public/luma-logo.png'));return;}
   res.setHeader('Content-Type','text/html');res.end('<html data-luma="dark" data-motion="reduced"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+styles+'</style></head><body><script>localStorage.setItem("luma-theme",JSON.stringify({mode:"dark",accent:"#7068ff"}));</script><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const checks=[];
  for(const width of [1280,1920,390,320]){
   win=new BrowserWindow({width,height:850});await win.loadURL('http://127.0.0.1:'+server.address().port+'/fil');
   await until(()=>run(win,"!!document.querySelector('.social-post')"),'feed layout '+width);
   const layout=await run(win,"({overflow:document.documentElement.scrollWidth>innerWidth,header:document.querySelector('.feed-masthead').getBoundingClientRect().height,tab:document.querySelector('.feed-tabs a').getBoundingClientRect().height,headBottom:document.querySelector('.feed-heading').getBoundingClientRect().bottom,tabsTop:document.querySelector('.feed-tabs').getBoundingClientRect().top})");
   assert.equal(layout.overflow,false,'horizontal overflow at '+width);
   if(width>760){assert.ok(layout.header<90,'compact desktop masthead at '+width);assert.ok(layout.tab<=40,'compact desktop tab at '+width);}
   else{
    assert.equal(await run(win,"getComputedStyle(document.querySelector('.feed-heading h1')).fontSize"),width<=360?'20px':'21px','approved mobile typography wins at '+width);
    assert.ok(layout.tabsTop>=layout.headBottom,'mobile tabs below heading at '+width);
    await run(win,"const page=document.querySelector('.luma-page');page.scrollTop=page.scrollHeight");
    const bottom=await run(win,"({scroll:document.querySelector('.luma-page').scrollTop,actions:document.querySelector('.post-actions').getBoundingClientRect().bottom,nav:document.querySelector('.luma-shell>.social-nav').getBoundingClientRect().top})");
    assert.ok(bottom.scroll>0,'mobile page scrolls at '+width);assert.ok(bottom.actions<=bottom.nav+1,'last actions clear bottom nav at '+width);
   }
   writeFileSync(path.join(dir,'feed-'+width+'.png'),(await win.webContents.capturePage()).toPNG());checks.push(width+'px');win.destroy();win=null;
  }
  console.log('PASS compact desktop masthead, mobile tab order, horizontal fit and bottom action scrolling: '+checks.join(', '));
 }catch(error){console.error(error);process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
