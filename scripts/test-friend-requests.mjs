// Real PostgreSQL queries and friend handlers; only authentication is isolated.
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {readFileSync,mkdirSync,readdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const dir='.sites-runtime/friend-requests';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/adapter.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/adapter.mjs'));
const pg=new PGlite();
for(const name of readdirSync('postgres').filter(name=>/^\d+.*\.sql$/.test(name)).sort())await pg.exec(readFileSync('postgres/'+name,'utf8'));
const driver={query:(sql,args)=>pg.query(sql,args),async connect(){return driver;}};
globalThis.__friendRequestTest={db:new PostgresDatabase(driver),user:null};
await build({entryPoints:['app/api/friends/route.ts'],outfile:dir+'/friends.mjs',bundle:true,platform:'node',format:'esm',plugins:[{
 name:'isolated-identity',setup(builder){
  builder.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},args=>({path:args.path,namespace:'test'}));
  builder.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__friendRequestTest.db;export const getBucket=()=>null;':"export const nativeAuthEnabled=()=>false;export async function getChatGPTUser(){return globalThis.__friendRequestTest.user;}",loader:'js'}));
 },
}]});
const {POST}=await import(pathToFileURL(process.cwd()+'/'+dir+'/friends.mjs'));
async function api(who,action,data={},status=200){
 globalThis.__friendRequestTest.user={userId:who,email:who+'@friends.test',fullName:who};
 const response=await POST(new Request('http://localhost/api/friends',{method:'POST',headers:{'Content-Type':'application/json',Origin:'http://localhost'},body:JSON.stringify({action,...data})}));
 const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;
}
try{
 await api('owner','list');
 const contacts=[];
 for(let i=0;i<21;i++)contacts.push(await api('contact-'+i,'list'));
 for(let i=0;i<20;i++)assert.equal((await api('owner','request',{code:contacts[i].profile.code})).sent,true);
 assert.equal((await api('owner','request',{code:contacts[0].profile.code})).sent,false,'duplicate request at quota is idempotent');
 const incoming=await api('contact-0','list'),id=incoming.items[0].id;
 await api('contact-0','accept',{id});
 assert.match((await api('owner','request',{code:contacts[0].profile.code})).message,/déjà amis/);
 await api('owner','request',{code:contacts[20].profile.code},429);
 // Removing a long-standing friendship must preserve its original request date.
 const old=Date.now()-3*86400000;await pg.query('UPDATE friendships SET created=$1 WHERE id=$2',[old,id]);
 await api('owner','remove',{id});
 assert.equal(Number((await pg.query('SELECT created FROM friendships WHERE id=$1',[id])).rows[0].created),old);
 assert.equal((await api('owner','request',{code:contacts[20].profile.code})).sent,true,'old removals do not consume request quota');
 await api('owner','request',{code:contacts[0].profile.code},429);
 console.log('PASS friend quota idempotency, accepted friendship handling, original request date preservation and daily limit for new requests.');
}finally{await pg.close();delete globalThis.__friendRequestTest;}
