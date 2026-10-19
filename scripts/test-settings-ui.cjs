/* Isolated settings UI with delayed profile data and controlled session errors. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const dir=path.resolve('.sites-runtime/settings-ui');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,revocations=0;
let sessions=[{created:1700000000000,expires:2000000000000},{created:1700100000000,expires:2000100000000}];
app.whenReady().then(async()=>{
 try{
  const {themeBootstrap}=await import('../app/theme-bootstrap.ts');
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React from 'react';import {createRoot} from 'react-dom/client';
   import Nav from '../../app/parametres/settings-nav';import Preferences from '../../app/parametres/user-preferences';
   import Sessions from '../../app/parametres/account-sessions';
   import ThemeProvider from '../../app/theme-provider';import Appearance from '../../app/apparence/page';
   if(new URLSearchParams(location.search).has('offline')){const nativeFetch=window.fetch;window.__sessionOffline=true;window.fetch=(url,options)=>window.__sessionOffline&&url==='/api/auth/sessions'?Promise.reject(new TypeError('Failed to fetch')):nativeFetch(url,options);}
   createRoot(document.getElementById('root')).render(<React.StrictMode><ThemeProvider/>{location.pathname==='/apparence'?<Appearance/>:<><Nav admin={false}/><div className="luma-page"><div className="settings-content"><Preferences/><div id="sessions"><Sessions/></div></div></div></>}</React.StrictMode>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd()},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  server=createServer(async(req,res)=>{
   if(req.url==='/api/profile'){await wait(500);res.setHeader('Content-Type','application/json');res.end(JSON.stringify({profile:{name:'Test',bio:'',avatar:false,notifications:'all',call_camera:0,call_noise_suppression:1,call_echo_cancellation:1,reduce_motion:0}}));return;}
   if(req.url==='/api/auth/sessions'){
    res.setHeader('Content-Type','application/json');
    if(req.method==='DELETE'){
     revocations++;await wait(300);
     if(revocations===1){res.statusCode=503;res.end(JSON.stringify({error:'Erreur temporaire de déconnexion.'}));return;}
     sessions=sessions.slice(0,1);res.end(JSON.stringify({revoked:1}));return;
    }
    res.end(JSON.stringify({sessions}));return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   res.setHeader('Content-Type','text/html');res.end('<html data-motion="reduced"><head><style>*{box-sizing:border-box}body{margin:0;font-family:Arial}aside{position:fixed;left:0;top:20px;width:210px}aside a{display:block;padding:15px}aside svg{width:16px}a[aria-current=page]{background:#ddd}.luma-page{position:fixed;left:220px;right:0;top:20px;height:650px;overflow:auto}.settings-content{display:flex;flex-direction:column;gap:20px}.settings-content>.settings-section,.settings-content>#sessions{min-height:650px;padding:15px;border:1px solid #ddd;scroll-margin-top:10px}.settings-content>#profil{order:1}.settings-content>#appels{order:2}.settings-content>#notifications{order:3}.settings-content>.settings-section:not([id]){order:4}.settings-content>#sessions{order:5}.settings-profile{display:grid;gap:10px}label{display:block}svg{width:18px}input,textarea,select{padding:10px}button{padding:10px}</style></head><body><script>localStorage.setItem("luma-reduce-motion","1");'+themeBootstrap+'</script><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  win=new BrowserWindow({width:1100,height:760});await win.loadURL('http://127.0.0.1:'+server.address().port+'/parametres#appels');
  await until(()=>run(win,"!!document.getElementById('appels')"),'delayed profile loaded');
  await until(()=>run(win,"const target=document.getElementById('appels').getBoundingClientRect();target.top>=20&&target.top<100"),'initial hash scroll after delayed content');
  await run(win,"document.querySelector('a[href=\"#profil\"]').click()");
  await until(()=>run(win,"document.querySelector('a[aria-current=page]')?.getAttribute('href')==='#profil'"),'profile navigation');
  await run(win,"document.querySelector('a[href=\"#appels\"]').click()");
  await until(()=>run(win,"document.querySelector('a[aria-current=page]')?.getAttribute('href')==='#appels'"),'call navigation');
  await run(win,"document.querySelector('.luma-page').scrollTop=0");
  await until(()=>run(win,"document.querySelector('a[aria-current=page]')?.getAttribute('href')==='#profil'"),'active section follows manual scrolling');
  for(const id of ['notifications','appels','profil']){
   await run(win,`document.querySelector('a[href="#${id}"]').click()`);
   await until(()=>run(win,`document.querySelector('a[aria-current=page]')?.getAttribute('href')==='#${id}'&&document.getElementById('${id}').getBoundingClientRect().top<100`),'settings tab '+id);
  }
  // The same settings page can use the document scroller on desktop and an
  // inner scroller on mobile. Track both without moving the activation marker.
  await run(win,"Object.assign(document.querySelector('.luma-page').style,{position:'relative',left:'220px',right:'auto',width:'calc(100% - 220px)',height:'auto',overflow:'visible'});document.querySelector('a[href=\"#appels\"]').click()");
  await until(()=>run(win,"scrollY>600&&document.querySelector('a[aria-current=page]')?.getAttribute('href')==='#appels'"),'document scroll navigation');
  await run(win,'window.scrollTo(0,0)');
  await until(()=>run(win,"document.querySelector('a[aria-current=page]')?.getAttribute('href')==='#profil'"),'active section follows document scroll');
  await run(win,"document.querySelector('.luma-page').removeAttribute('style');window.scrollTo(0,0)");
  await run(win,"document.querySelector('a[href=\"#sessions\"]').click()");
  await until(()=>run(win,"document.querySelector('.account-sessions').textContent.includes('2 sessions actives')"),'sessions loaded');
  await run(win,"document.querySelector('.account-sessions summary').click()");
  assert.equal(await run(win,"document.querySelectorAll('.session-details li').length"),2,'real session details');
  await run(win,"document.querySelector('.account-sessions button').click()");
  assert.equal(await run(win,"document.querySelector('.account-sessions button').disabled"),true,'disable duplicate revocation');
  await until(()=>run(win,"document.querySelector('.account-sessions [role=alert]')?.textContent.includes('Erreur temporaire')"),'revocation error shown');
  assert.equal(await run(win,"document.querySelector('.account-sessions').textContent.includes('2 sessions actives')"),true,'keep session count after failure');
  await run(win,"document.querySelector('.account-sessions button').click()");
  await until(()=>run(win,"document.querySelector('.account-sessions').textContent.includes('1 session active')&&document.querySelector('.account-sessions button').disabled"),'confirmed session refresh');
  assert.equal(revocations,2,'one request per action');
  writeFileSync(path.join(dir,'settings.png'),(await win.webContents.capturePage()).toPNG());
  await run(win,"document.querySelector('a[href=\"/apparence\"]').click()");
  await win.page.waitForURL('**/apparence',{waitUntil:'load'});
  await until(()=>run(win,"!!document.querySelector('input[type=color]:not(:disabled)')"),'appearance navigation');
  await run(win,"localStorage.setItem('luma-theme',JSON.stringify({mode:'dark',accent:'#6366f1'}))");
  const origin=await run(win,'location.origin');await win.loadURL(origin+'/apparence');
  await until(()=>run(win,"!!document.querySelector('input[type=color]:not(:disabled)')"),'appearance ready');
  assert.equal(await run(win,"document.documentElement.style.getPropertyValue('--luma-accent')"),'#6366f1','preserve custom accent after hydration');
  await run(win,"[...document.querySelectorAll('.theme-modes button')].find(b=>b.textContent==='Clair').click()");
  await until(()=>run(win,"document.documentElement.dataset.luma==='light'"),'light theme applied');
  await win.loadURL(origin+'/apparence');
  await until(()=>run(win,"!!document.querySelector('input[type=color]:not(:disabled)')"),'appearance reload');
  assert.equal(await run(win,"document.documentElement.style.getPropertyValue('--luma-accent')"),'#6366f1','preserve accent after reload');
  assert.equal(await run(win,"document.documentElement.dataset.luma"),'light','preserve light mode after reload');
  await win.page.emulateMedia({colorScheme:'dark'});
  await run(win,"[...document.querySelectorAll('.theme-modes button')].find(b=>b.textContent==='Système').click()");
  await until(()=>run(win,"document.documentElement.dataset.luma==='dark'"),'system dark theme');
  await win.page.emulateMedia({colorScheme:'light'});
  await until(()=>run(win,"document.documentElement.dataset.luma==='light'"),'system light theme');
  await win.loadURL(origin+'/parametres?offline=1');
  await until(()=>run(win,"!!document.querySelector('.account-sessions [role=alert]')"),'session connection failure shown');
  assert.equal(await run(win,"document.querySelector('.account-sessions button').disabled"),true,'revoke disabled until sessions are known');
  await run(win,"window.__sessionOffline=false;[...document.querySelectorAll('.account-sessions button')].find(b=>b.textContent==='Réessayer la vérification').click()");
  await until(()=>run(win,"document.querySelector('.account-sessions').textContent.includes('1 session active')&&!document.querySelector('.account-sessions [role=alert]')"),'session verification retry');
  console.log('PASS delayed settings deep link, navigation after async profile, scroll tracking, real session dates, revocation error, confirmed refresh, saved/system theme consistency and session verification retry.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));writeFileSync(path.join(dir,'debug.json'),JSON.stringify(await run(win,"({active:document.querySelector('a[aria-current=page]')?.getAttribute('href'),scroll:document.querySelector('.luma-page').scrollTop,sections:[...document.querySelectorAll('.settings-content>[id]')].map(e=>({id:e.id,top:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height}))})"),null,2));}catch{}process.exitCode=1;}
 finally{win?.destroy();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),60000);
