/* Real settings component against an isolated API; never uses production accounts. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {build}=require('esbuild');
const dir=path.resolve('.sites-runtime/preferences-ui');mkdirSync(dir,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
const run=(win,code)=>win.webContents.executeJavaScript(code,true);
let server,win,getFailure=true,prefsFailure=true,profileFailure=true,prefsCalls=0,profileCalls=0;
let profile={name:'Mon compte',bio:'Ma présentation',avatar:false,notifications:'mentions',call_camera:0,call_noise_suppression:1,call_echo_cancellation:1,reduce_motion:0};
app.whenReady().then(async()=>{
 try{
  writeFileSync(path.join(dir,'entry.tsx'),`
   import React from 'react';import {createRoot} from 'react-dom/client';import Preferences from '../../app/parametres/user-preferences';
   window.__created=[];window.__revoked=[];const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   URL.createObjectURL=blob=>{const url=create(blob);window.__created.push(url);return url;};URL.revokeObjectURL=url=>{window.__revoked.push(url);revoke(url);};
   const nativeFetch=window.fetch,scenario=new URLSearchParams(location.search).get('case')||'';
   window.fetch=(url,options={})=>nativeFetch(url,{...options,headers:{...options.headers,'x-test-case':scenario}});
   const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<React.StrictMode><Preferences/></React.StrictMode>);
  `);
  await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd()},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
  server=createServer(async(req,res)=>{
   if(req.url==='/api/profile'){
    res.setHeader('Content-Type','application/json');
    if(req.method==='GET'){
     await wait(60);
     if(req.headers['x-test-case']==='expired'){res.statusCode=401;res.end('{"error":"Session expirée."}');return;}
     if(req.headers['x-test-case']==='invalid'){res.end('{"profile":null}');return;}
     if(getFailure){res.statusCode=503;res.end('{"error":"Profil temporairement indisponible."}');return;}
     res.end(JSON.stringify({profile}));return;
    }
    const parts=[];for await(const part of req)parts.push(part);const body=Buffer.concat(parts);
    if(req.headers['content-type']?.startsWith('application/json')){
     prefsCalls++;await wait(180);
     if(prefsFailure){res.statusCode=503;res.end('{"error":"Préférences non enregistrées."}');return;}
     const p=JSON.parse(body);profile={...profile,notifications:p.notifications,call_camera:p.callCamera?1:0,call_noise_suppression:p.noiseSuppression?1:0,call_echo_cancellation:p.echoCancellation?1:0,reduce_motion:p.reduceMotion?1:0};
     res.end('{"ok":true}');return;
    }
    profileCalls++;await wait(180);
    if(profileFailure){res.statusCode=503;res.end('{"error":"Photo non enregistrée."}');return;}
    const form=await new Request('http://local/profile',{method:'POST',headers:{'content-type':req.headers['content-type']},body}).formData();
    assert.ok(form.get('avatar') instanceof File,'avatar uploaded as real multipart file');
    profile={...profile,name:form.get('name'),bio:form.get('bio'),avatar:true};res.end('{"ok":true,"avatar":true}');return;
   }
   if(req.url==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
   res.setHeader('Content-Type','text/html');res.end('<html><head><style>body{font-family:Arial}svg{width:20px}input,textarea,button{padding:8px}.settings-profile{display:grid;gap:8px}.settings-avatar img{width:80px}label{display:block}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  win=new BrowserWindow({width:1100,height:800});await win.loadURL(origin);
  await until(()=>run(win,"!!document.querySelector('[role=alert]')"),'profile load failure');
  assert.equal(await run(win,"[...document.querySelectorAll('button')].some(b=>b.textContent==='Réessayer le chargement')"),true);
  getFailure=false;await win.page.getByRole('button',{name:'Réessayer le chargement',exact:true}).click();
  await until(()=>run(win,"!!document.querySelector('#profil')"),'profile retry');
  const camera=win.page.getByRole('switch',{name:'Démarrer la caméra pendant les appels vidéo',exact:true});
  await camera.click();assert.equal(await camera.isDisabled(),true);
  await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('Préférences non enregistrées')"),'preference failure');
  assert.equal(await camera.getAttribute('aria-checked'),'false','failed switch rolls back');
  assert.equal(await run(win,"JSON.parse(localStorage.getItem('luma-call-preferences')).camera"),false,'failed save preserves confirmed local preferences');
  prefsFailure=false;await camera.click();
  await until(()=>run(win,"document.querySelector('[role=status]')?.textContent==='Préférences enregistrées.'"),'preference retry');
  assert.equal(profile.call_camera,1);assert.equal(await run(win,"JSON.parse(localStorage.getItem('luma-call-preferences')).camera"),true);
  await run(win,"document.querySelector('[aria-label=\"Activer la réduction du bruit\"]').click();document.querySelector('[aria-label=\"Activer la réduction du bruit\"]').click()");
  await until(()=>run(win,"!document.querySelector('[aria-label=\"Activer la réduction du bruit\"]').disabled"),'duplicate toggle finished');
  assert.equal(prefsCalls,3,'one preference request per synchronous action');
  await run(win,"window.__storageSet=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new DOMException('Blocked','SecurityError');}");
  await camera.click();
  await until(()=>run(win,"document.querySelector('[role=status]')?.textContent.includes('stockage local')"),'account save survives blocked device storage');
  assert.equal(profile.call_camera,0,'server preference saved despite blocked storage');
  assert.equal(await run(win,"!!document.querySelector('[role=alert]')"),false,'storage failure does not report server save failure');
  await run(win,'Storage.prototype.setItem=window.__storageSet');
  await win.page.locator('.settings-profile input:not([type=file])').fill('Nouveau pseudo');await win.page.locator('.settings-profile textarea').fill('Présentation à conserver');
  await win.page.locator('.settings-avatar input').setInputFiles({name:'invalid.txt',mimeType:'text/plain',buffer:Buffer.from('not an image')});
  assert.equal(await run(win,"window.__created.length"),0,'invalid avatar creates no preview');
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ1sAAAAASUVORK5CYII=','base64');
  await win.page.locator('.settings-avatar input').setInputFiles({name:'photo.png',mimeType:'image/png',buffer:png});
  await run(win,"document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));document.querySelector('form').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))");
  await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('Photo non enregistrée')"),'profile save failure');
  assert.equal(profileCalls,1,'profile save is synchronous locked');
  assert.equal(await win.page.locator('.settings-profile input:not([type=file])').inputValue(),'Nouveau pseudo');
  assert.equal(await run(win,"!!document.querySelector('.settings-avatar img[src^=blob]')"),true,'avatar draft retained after failure');
  profileFailure=false;await win.page.getByRole('button',{name:'Enregistrer le profil',exact:true}).click();
  await until(()=>run(win,"document.querySelector('[role=status]')?.textContent==='Profil enregistré.'"),'profile retry');
  assert.equal(profile.name,'Nouveau pseudo');assert.equal(profile.bio,'Présentation à conserver');
  assert.equal(await run(win,"window.__created.every(url=>window.__revoked.includes(url))"),true,'successful upload releases preview');
  assert.match(await win.page.locator('.settings-avatar img').getAttribute('src'),/avatar=1&v=[1-9]/,'fresh photo bypasses previous cached avatar');
  await win.page.locator('.settings-avatar input').setInputFiles({name:'draft.png',mimeType:'image/png',buffer:png});
  await run(win,'window.__unmount()');
  assert.equal(await run(win,"window.__created.every(url=>window.__revoked.includes(url))"),true,'navigation releases unsaved preview');
  await win.loadURL(origin+'/?case=invalid');await until(()=>run(win,"document.querySelector('[role=alert]')?.textContent.includes('incomplet')"),'invalid payload handled');
  await win.loadURL(origin+'/?case=expired');await until(()=>run(win,"!!document.querySelector('a[href*=connexion]')"),'expired session offers login');
  assert.equal(await run(win,"!!document.querySelector('#profil')"),false,'expired session hides editors');
  console.log('PASS profile retry, malformed payload, expired session, failed switch rollback, confirmed preferences, duplicate guards, multipart photo retry, draft preservation, fresh avatar and object URL cleanup.');
 }catch(error){console.error(error);if(win)try{writeFileSync(path.join(dir,'debug.txt'),await run(win,'document.body.innerText'));}catch{}process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
setTimeout(()=>app.exit(1),90000);
