// Global CSS must have the same owner and bundle on every application route.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {runInNewContext} from 'node:vm';

function sources(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?sources(dir+'/'+entry.name):/\.tsx?$/.test(entry.name)?[dir+'/'+entry.name]:[]);}
const imports=sources('app').flatMap(file=>[...readFileSync(file,'utf8').matchAll(/^import\s+['"]([^'"]+\.css)['"]/gm)].map(match=>({file,css:match[1]})));
assert.deepEqual(imports,[{file:'app/layout.tsx',css:'./app.css'}],'only the root layout imports global styles');
let shared;
for(const route of ['fil','messages','amis','parametres','communities','connexion','appel/[id]','salle/[id]']){
 const context={};runInNewContext(readFileSync(`.next/server/app/${route}/page_client-reference-manifest.js`,'utf8'),context);
 const styles=context.__RSC_MANIFEST[`/${route}/page`].entryCSSFiles;
 const paths=[...new Set(Object.values(styles).flat().map(file=>file.path))];
 assert.equal(paths.length,1,'one CSS cascade on '+route);
 if(shared)assert.deepEqual(paths,shared,'same styles on '+route);else shared=paths;
}
console.log('PASS one global stylesheet owner and identical compiled CSS across feed, messages, friends, settings, communities and login.');
