/* Native account closure fixture: all authenticated requests fail after close. */
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http'),{mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path'),assert=require('node:assert/strict'),{build}=require('esbuild');
const dir=path.resolve('.sites-runtime/data-controls-ui');mkdirSync(dir,{recursive:true});
let server,win,closed=false,closeRequests=0,afterClosureRequests=0;const sections=[];
app.whenReady().then(async()=>{try{
 writeFileSync(path.join(dir,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Controls from '../../app/mes-donnees/controls';createRoot(document.getElementById('root')).render(<Controls/>);`);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd()},define:{'process.env.NODE_ENV':'"development"'}});
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');
  if(url.pathname==='/api/privacy'){
   res.setHeader('Content-Type','application/json');
   if(closed){afterClosureRequests++;res.statusCode=401;res.end(JSON.stringify({error:'Connectez-vous pour gérer vos données.'}));return;}
   if(req.method==='POST'){let text='';for await(const chunk of req)text+=chunk;const p=JSON.parse(text);if(p.action==='close'){assert.equal(p.confirmation,'SUPPRIMER');closeRequests++;await new Promise(r=>setTimeout(r,100));closed=true;res.end(JSON.stringify({closed:true,pendingFiles:true}));return;}res.end(JSON.stringify({spaces:[]}));return;}
   const section=url.searchParams.get('section');if(section){sections.push(section);res.end(JSON.stringify({items:section==='postMedia'?[{id:'media-reference',post:'post',filename:'photo.jpg'}]:[],next:null}));return;}
   res.end(JSON.stringify({profile:{name:'Test',closed:0},identity:{id:'test',name:'Test',email:'test@example.test'},pendingFiles:0}));return;
  }
  if(url.pathname==='/app.js'){res.end(readFileSync(path.join(dir,'app.js')));return;}
  res.setHeader('Content-Type','text/html');res.end('<html><head><style>body{font:16px Arial;background:#f3f7fd;color:#10233d;margin:20px}section{background:white;border:1px solid #cdd9eb;border-radius:14px;padding:20px;margin:15px 0}button,input{padding:12px}</style></head><body><main id="root"></main><script src="/app.js"></script></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 win=new BrowserWindow({width:390,height:844});await win.loadURL('http://127.0.0.1:'+server.address().port+'/mes-donnees');
 await win.page.getByText('Adresse de connexion :',{exact:false}).waitFor({state:'visible'});assert.ok(!(await win.page.locator('body').innerText()).includes('ChatGPT'),'native account copy');
 const downloading=win.page.waitForEvent('download');await win.page.getByRole('button',{name:'Télécharger mon export',exact:true}).click();const download=await downloading;const archive=JSON.parse(readFileSync(await download.path(),'utf8'));assert.equal(archive.postMedia[0].id,'media-reference');assert.ok(sections.includes('postMedia'),'post media references are exported');
 await win.page.getByLabel('Pour confirmer, saisissez SUPPRIMER').fill('SUPPRIMER');
 await win.page.getByRole('button',{name:'Fermer mon compte et effacer mes contenus',exact:true}).click();
 await win.page.getByRole('heading',{name:'Compte fermé',exact:true}).waitFor({state:'visible'});assert.equal(closeRequests,1);assert.equal(afterClosureRequests,0,'no authenticated reload/cleanup after session revocation');assert.equal(await win.page.getByRole('alert').count(),0,'successful closure is not an error');
 assert.equal(await win.page.getByRole('button').count(),1,'closed account exposes only return action');const form=win.page.locator('form');assert.equal(await form.getAttribute('method'),'post');assert.equal(await form.getAttribute('action'),'/api/auth/logout?returnTo=%2F');
 mkdirSync('outputs',{recursive:true});writeFileSync('outputs/data-account-closed-fixture.png',await win.page.screenshot());
 console.log('PASS native account copy, export with media references, closure after session revocation, no unauthenticated follow-up requests, and POST logout return.');
}catch(error){console.error(error);process.exitCode=1;}finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}});
setTimeout(()=>app.exit(1),60000);
