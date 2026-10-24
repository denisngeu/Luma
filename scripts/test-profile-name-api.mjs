import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/profile-name-api';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/db.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/db.mjs'));
const pg=new PGlite();for(const file of readdirSync('postgres').filter(n=>/^\d+.*\.sql$/.test(n)).sort())await pg.exec(readFileSync('postgres/'+file,'utf8'));
const driver={query:(sql,args)=>pg.query(sql,args),async connect(){return driver;}};
globalThis.__nameTest={db:new PostgresDatabase(driver),uploads:0};
const plugin={name:'fixture',setup(b){b.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({loader:'js',contents:a.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__nameTest.db;export const getBucket=()=>({put:async()=>{globalThis.__nameTest.uploads++},delete:async()=>{}});':`export const SESSION_COOKIE='luma_session';export const nativeAuthEnabled=()=>true;export const safeRelativeReturnPath=()=>'/messages';export const getChatGPTUser=async()=>({userId:'me',fullName:'Test',email:'me@example.test'});export async function hashSessionToken(value){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))).toString('hex');}` }));}};
const routes={};for(const name of ['profile','privacy','auth']){await build({entryPoints:['app/api/'+name+'/route.ts'],outfile:dir+'/'+name+'.mjs',bundle:true,platform:'node',format:'esm',plugins:[plugin]});routes[name]=await import(pathToFileURL(process.cwd()+'/'+dir+'/'+name+'.mjs'));}
let index=0;
async function post(route,name,status){
 let body,headers={Origin:'http://localhost'};
 if(route==='profile'){body=new FormData();body.set('name',typeof name==='string'?name:'');body.set('bio','Bio');if(status===400)body.set('avatar',new File(['fixture'],'photo.png',{type:'image/png'}));}
 else{headers['Content-Type']='application/json';body=JSON.stringify(route==='auth'?{action:'register',name,email:'profile-'+(++index)+'@example.test',password:'A valid password 12345'}:{action:'rename',name});}
 const response=await routes[route].POST(new Request('http://localhost/api/'+route,{method:'POST',headers,body}));const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
}
try{
 await pg.exec("INSERT INTO users(id,name) VALUES ('me','Avant');UPDATE service_settings SET registrations_open=1 WHERE id=1;");
 for(const invalid of ['', ' ', 'A', ' A ', 'n'.repeat(61),null,123])for(const route of ['profile','privacy','auth']){
  await pg.query("UPDATE users SET name='Avant' WHERE id='me'");const result=await post(route,invalid,400);assert.equal(result.error,'Le nom doit contenir entre 2 et 60 caractères.');assert.equal((await pg.query("SELECT name FROM users WHERE id='me'")).rows[0].name,'Avant','invalid name leaves profile unchanged');
 }
 assert.equal(globalThis.__nameTest.uploads,0,'invalid profile never uploads its photo');
 for(const [value,expected] of [[' Denis ','Denis'],['A    B','A B'],['Éric\t\nDenis','Éric Denis'],['ab','ab'],['n'.repeat(60),'n'.repeat(60)]])for(const route of ['profile','privacy','auth']){
  const result=await post(route,value,200);if(route==='auth')assert.equal(result.user.displayName,expected);else assert.equal((await pg.query("SELECT name FROM users WHERE id='me'")).rows[0].name,expected);
 }
 console.log('PASS identical 2–60 name validation and whitespace normalization across registration, profile photo updates and account-data renaming, with no writes/uploads on invalid input.');
}finally{delete globalThis.__nameTest;await pg.close();}
