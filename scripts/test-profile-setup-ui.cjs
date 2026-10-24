const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http'),{mkdirSync,writeFileSync,readFileSync}=require('node:fs');
const path=require('node:path'),assert=require('node:assert/strict'),{build}=require('esbuild'),compiledStyles=require('./compiled-styles.cjs');
const dir=path.resolve('.sites-runtime/profile-setup-ui');mkdirSync(dir,{recursive:true});mkdirSync('outputs',{recursive:true});
let server,win;const states=new Map(),wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<100;i++){if(await fn())return;await wait(100);}throw Error('Timeout '+label);}
app.whenReady().then(async()=>{try{
 writeFileSync(path.join(dir,'navigation.ts'),`export const useRouter=()=>({replace(url){window.__destination=url;}});`);
 writeFileSync(path.join(dir,'link.tsx'),`import React from 'react';export default function Link({children,...props}){return <a {...props}>{children}</a>}`);
 writeFileSync(path.join(dir,'entry.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import Setup from '../../app/bienvenue/profile-setup';const root=createRoot(document.getElementById('root'));window.__unmount=()=>root.unmount();root.render(<React.StrictMode><Setup returnTo='/messages'/></React.StrictMode>);`);
 await build({entryPoints:[path.join(dir,'entry.tsx')],outfile:path.join(dir,'app.js'),bundle:true,platform:'browser',jsx:'automatic',alias:{'@':process.cwd(),'next/navigation':path.join(dir,'navigation.ts'),'next/link':path.join(dir,'link.tsx')},define:{'process.env.NODE_ENV':'"development"','process.env':'{}'}});
 const css=compiledStyles(),png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZpcAAAAASUVORK5CYII=','base64');
 server=createServer(async(req,res)=>{
  const url=new URL(req.url,'http://local');if(url.pathname==='/api/profile'){
   const scenario=new URL(req.headers.referer).searchParams.get('case');if(!states.has(scenario))states.set(scenario,{gets:0,posts:0,forms:[]});const state=states.get(scenario);res.setHeader('Content-Type','application/json');
   if(req.method==='POST'){
    state.posts++;const chunks=[];for await(const part of req)chunks.push(part);const form=await new Response(Buffer.concat(chunks),{headers:{'Content-Type':req.headers['content-type']}}).formData();state.forms.push({name:form.get('name'),bio:form.get('bio'),avatar:form.get('avatar')?.name});await wait(scenario==='unmount'?700:200);
    if(scenario==='edit'&&state.posts===1){res.statusCode=503;res.end(JSON.stringify({error:'Profil temporairement indisponible.'}));return;}
    res.end(JSON.stringify({ok:true,avatar:!!form.get('avatar')}));return;
   }
   state.gets++;await wait(600);if(scenario==='expired'){res.statusCode=401;res.end(JSON.stringify({error:'Session expirée.'}));return;}
   if(scenario==='retry'&&state.gets===1){res.statusCode=503;res.end(JSON.stringify({error:'Chargement impossible.'}));return;}
   res.end(JSON.stringify({profile:{name:'Profil existant',bio:'Présentation existante',avatar:false}}));return;
  }
  if(url.pathname==='/app.js'){res.setHeader('Content-Type','text/javascript');res.end(readFileSync(path.join(dir,'app.js')));return;}
  res.setHeader('Content-Type','text/html');res.end('<html data-luma="light"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>');
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 win=new BrowserWindow({width:390,height:844});await win.loadURL(base+'/bienvenue?case=edit');const name=win.page.getByRole('textbox',{name:'Pseudo',exact:true});await name.fill('Nouveau   pseudo');await win.page.getByRole('textbox',{name:/Quelques mots sur vous/}).fill('Présentation choisie');
 await win.page.getByRole('status').filter({hasText:'Chargement de votre profil'}).waitFor({state:'hidden'});assert.equal(await name.inputValue(),'Nouveau   pseudo','late load preserves chosen name');assert.equal(await name.getAttribute('maxlength'),'60');assert.equal(await name.getAttribute('minlength'),'2');assert.equal(states.get('edit').gets,1,'StrictMode does not duplicate initial load');
 const file=win.page.locator('input[type=file]');await file.setInputFiles({name:'photo.gif',mimeType:'image/gif',buffer:png});await win.page.getByRole('alert').filter({hasText:'Choisissez une image'}).waitFor({state:'visible'});assert.equal(await win.page.getByAltText('Aperçu de votre photo').count(),0);
 await file.setInputFiles({name:'portrait.png',mimeType:'image/png',buffer:png});await win.page.getByAltText('Aperçu de votre photo').waitFor({state:'visible'});
 await file.setInputFiles({name:'trop-grand.png',mimeType:'image/png',buffer:Buffer.alloc(5*1024*1024+1)});await win.page.getByRole('alert').filter({hasText:'5 Mo maximum'}).waitFor({state:'visible'});assert.equal(await win.page.getByAltText('Aperçu de votre photo').count(),1,'invalid replacement preserves last valid photo');
 await win.page.locator('form').evaluate(el=>{el.requestSubmit();el.requestSubmit();});await win.page.getByRole('alert').filter({hasText:'Profil temporairement indisponible.'}).waitFor({state:'visible'});assert.equal(states.get('edit').posts,1,'duplicate submit is single-flight');assert.equal(await name.inputValue(),'Nouveau   pseudo');assert.equal(await win.page.evaluate(()=>window.__destination),undefined,'failure does not navigate away');
 await win.page.getByRole('button',{name:'Entrer dans Luma',exact:true}).click();await until(async()=>await win.page.evaluate(()=>window.__destination)==='/messages','successful retry navigates');assert.deepEqual(states.get('edit').forms[1],{name:'Nouveau pseudo',bio:'Présentation choisie',avatar:'portrait.png'});writeFileSync('outputs/profile-setup-mobile-test.png',await win.page.screenshot());win.destroy();win=null;
 win=new BrowserWindow({width:390,height:844});await win.loadURL(base+'/bienvenue?case=retry');await win.page.getByRole('button',{name:'Réessayer le profil',exact:true}).waitFor({state:'visible'});assert.equal(await win.page.getByRole('button',{name:'Entrer dans Luma',exact:true}).isEnabled(),false);await win.page.getByRole('button',{name:'Réessayer le profil',exact:true}).click();await until(async()=>await win.page.getByRole('button',{name:'Entrer dans Luma',exact:true}).isEnabled(),'retry loads profile');assert.equal(states.get('retry').gets,2);win.destroy();win=null;
 win=new BrowserWindow({width:390,height:844});await win.loadURL(base+'/bienvenue?case=expired');await win.page.getByRole('link',{name:'Se reconnecter',exact:true}).waitFor({state:'visible'});assert.equal(await win.page.getByRole('button',{name:'Entrer dans Luma',exact:true}).isEnabled(),false);win.destroy();win=null;
 win=new BrowserWindow({width:1280,height:844});await win.loadURL(base+'/bienvenue?case=unmount');await until(async()=>await win.page.getByRole('button',{name:'Entrer dans Luma',exact:true}).isEnabled(),'desktop profile loaded');await win.page.getByRole('button',{name:'Entrer dans Luma',exact:true}).click();await until(()=>states.get('unmount').posts===1,'save started');await win.page.evaluate(()=>window.__unmount());await wait(900);assert.equal(await win.page.evaluate(()=>window.__destination),undefined,'late save cannot navigate after leaving setup');
 console.log('PASS onboarding draft preservation, normalized name, photo validation, single-flight save, failure retry, load retry, expired session and cancellation after leaving.');
}catch(error){console.error(error);process.exitCode=1;}finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}});
setTimeout(()=>app.exit(1),90000);
