// Verify the shipped font bytes and actual rendering without external requests.
const {app,BrowserWindow}=require('./test-call-browser.cjs');
const {createServer}=require('node:http');
const {readFileSync}=require('node:fs');
const {createHash}=require('node:crypto');
const assert=require('node:assert/strict');
const manifest=require('../public/fonts/manifest.json');
const symbols=require('./font-symbols.cjs');
const expected=symbols(readFileSync('public/fonts/material-symbols.codepoints','utf8'));
for(const name of expected)assert.ok(manifest.iconNames.includes(name),'Regenerate local fonts for icon '+name);
for(const asset of manifest.assets){const bytes=readFileSync('public/fonts/'+asset.file);assert.equal(bytes.subarray(0,4).toString(),'wOF2');assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256);assert.equal(bytes.length,asset.bytes);}
assert.ok(manifest.assets.find(asset=>asset.family==='material-symbols-outlined').bytes<300000,'ship only the icons used by Luma');
const layout=readFileSync('app/layout.tsx','utf8');assert.ok(!/https:\/\/fonts\.(googleapis|gstatic)\.com/.test(layout),'layout must not depend on Google Fonts');
let server,win;const requests=[];
app.whenReady().then(async()=>{
 try{
  server=createServer((req,res)=>{
   requests.push(req.url);
   if(req.url==='/fonts.css'){res.setHeader('Content-Type','text/css');res.end(readFileSync('app/fonts.css'));return;}
   const asset=manifest.assets.find(asset=>'/fonts/'+asset.file===req.url);
   if(asset){res.setHeader('Content-Type','font/woff2');res.end(readFileSync('public/fonts/'+asset.file));return;}
   res.setHeader('Content-Type','text/html');res.end('<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/fonts.css"><style>body{font-family:"Plus Jakarta Sans"}.material-symbols-outlined{font-family:"Material Symbols Outlined";font-size:24px;display:inline-block;line-height:1}button{font:inherit;min-height:44px}</style><button>Réglages · Écran · Communautés</button>'+manifest.iconNames.map(icon=>'<span class="material-symbols-outlined">'+icon+'</span>').join(''));
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));win=new BrowserWindow({width:390,height:844});await win.ready;
  await win.page.route('https://**',route=>route.abort());
  await win.loadURL('http://127.0.0.1:'+server.address().port);
  const result=await win.page.evaluate(async()=>{
   const faces=await document.fonts.load('24px "Material Symbols Outlined"','search');await document.fonts.load('800 16px "Plus Jakarta Sans"','Réglages Écran Communautés');await document.fonts.ready;
   return {loaded:faces.length>0&&faces.every(face=>face.status==='loaded'),words:[...document.querySelectorAll('.material-symbols-outlined')].filter(icon=>Math.abs(icon.getBoundingClientRect().width-24)>1).map(icon=>icon.textContent),family:getComputedStyle(document.querySelector('button')).fontFamily};
  });
  assert.equal(result.loaded,true);assert.deepEqual(result.words,[],'every named symbol must render as an icon, not a word');assert.ok(result.family.includes('Plus Jakarta Sans'));
  assert.ok(requests.some(url=>url.endsWith('.woff2')),'fonts were loaded from the local server');
  console.log('PASS local WOFF2 integrity, icon inventory, all '+manifest.iconNames.length+' ligatures, French text, and no external font dependency.');
 }catch(error){console.error(error);process.exitCode=1;}
 finally{win?.destroy();server?.closeAllConnections();server?.close();await app.exit(process.exitCode||0);}
});
