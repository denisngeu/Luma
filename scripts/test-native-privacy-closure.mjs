import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {build} from 'esbuild';
import {mkdirSync,readdirSync,readFileSync} from 'node:fs';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {eraseClosedAccountFiles} from './erasure-worker.mjs';
const dir='.sites-runtime/native-privacy-closure';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/postgres.ts'],outfile:dir+'/db.mjs',bundle:true,packages:'external',platform:'node',format:'esm'});
const {PostgresDatabase}=await import(pathToFileURL(process.cwd()+'/'+dir+'/db.mjs'));
const pg=new PGlite();for(const file of readdirSync('postgres').filter(n=>/^\d+.*\.sql$/.test(n)).sort())await pg.exec(readFileSync('postgres/'+file,'utf8'));
const driver={query:(sql,args)=>pg.query(sql,args),async connect(){return driver;}};
globalThis.__privacyClosure={db:new PostgresDatabase(driver),who:'alice',async identity(){const row=await this.db.prepare('SELECT u.id,u.name FROM users u JOIN auth_accounts a ON a."user"=u.id JOIN auth_sessions s ON s."user"=u.id WHERE u.id=? AND u.closed=0 AND u.suspended=0').bind(this.who).first();return row?{userId:row.id,fullName:row.name,email:row.id+'@example.test'}:null;}};
await build({entryPoints:['app/api/privacy/route.ts'],outfile:dir+'/route.mjs',bundle:true,platform:'node',format:'esm',plugins:[{name:'local-native-account',setup(b){
 b.onResolve({filter:/(^@\/lib\/runtime$|^\.\/runtime$|chatgpt-auth$)/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('runtime')?'export const getDatabase=()=>globalThis.__privacyClosure.db;export const getBucket=()=>null;':'export const nativeAuthEnabled=()=>true;export const getChatGPTUser=()=>globalThis.__privacyClosure.identity();',loader:'js'}));
}}]});
const route=await import(pathToFileURL(process.cwd()+'/'+dir+'/route.mjs'));
const directory=await mkdtemp(path.join(os.tmpdir(),'luma-native-closure-'));
async function close(who,confirmation='SUPPRIMER',origin='http://localhost'){
 globalThis.__privacyClosure.who=who;
 const response=await route.POST(new Request('http://localhost/api/privacy',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({action:'close',confirmation})}));return {status:response.status,data:await response.json()};
}
try{
 await pg.exec(`INSERT INTO users(id,name,role) VALUES ('alice','Alice','user'),('bob','Bob','user'),('admin','Admin','admin');
 INSERT INTO auth_accounts("user",email,password_salt,password_hash,created) SELECT id,id||'@example.test','fixture','fixture',1 FROM users;
 INSERT INTO auth_sessions(token_hash,"user",created,expires) SELECT id,id,1,9999999999999 FROM users;
 INSERT INTO chats(id,name,kind,owner,invite,created) VALUES ('chat','Chat','group','alice','invite',1);
 INSERT INTO members(chat,"user") VALUES ('chat','alice'),('chat','bob');
 INSERT INTO messages(id,chat,author,body,created,file) VALUES ('mine','chat','alice','Mine',1,'attachment'),('other','chat','bob','Preserve',2,'other-file');
 INSERT INTO social_profiles("user",bio,avatar) VALUES ('alice','Bio','avatar');
 INSERT INTO posts(id,author,body,created) VALUES ('post','alice','My post',1),('other-post','bob','Preserve post',2);
 INSERT INTO post_media(post,key,kind,mime,filename,size,position) VALUES ('post','post-image','image','image/png','photo.png',10,0);`);
 for(const key of ['attachment','avatar','post-image','other-file'])await writeFile(path.join(directory,key),key);
 assert.equal((await close('alice','wrong')).status,400);assert.equal((await close('alice','SUPPRIMER','https://other.test')).status,403);assert.equal((await close('admin')).status,409);
 const result=await close('alice');assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.closed,true);
 assert.equal((await pg.query('SELECT closed FROM users WHERE id=$1',['alice'])).rows[0].closed,1);
 assert.equal((await pg.query('SELECT 1 FROM auth_sessions WHERE "user"=$1',['alice'])).rows.length,0);assert.equal((await pg.query('SELECT 1 FROM auth_accounts WHERE "user"=$1',['alice'])).rows.length,0);
 assert.equal((await close('alice')).status,401,'closed native account no longer authenticates');
 assert.deepEqual((await pg.query('SELECT key FROM erasure_files ORDER BY key')).rows.map(r=>r.key),['attachment','avatar','post-image']);
 assert.equal((await pg.query('SELECT owner FROM chats WHERE id=$1',['chat'])).rows[0].owner,'bob');
 assert.equal((await pg.query('SELECT count(*) AS n FROM messages WHERE author=$1',['bob'])).rows[0].n,1);
 assert.equal((await pg.query('SELECT count(*) AS n FROM posts WHERE author=$1',['bob'])).rows[0].n,1);
 assert.deepEqual(await eraseClosedAccountFiles(driver,directory),{removed:3,failed:0});assert.equal(await readFile(path.join(directory,'other-file'),'utf8'),'other-file');
 assert.equal((await pg.query('SELECT 1 FROM erasure_files')).rows.length,0);
 console.log('PASS native closure transaction, revocation, confirmation/CSRF/admin guards, attachment/avatar/post media erasure without a session, ownership handover and other users’ content preservation.');
}finally{delete globalThis.__privacyClosure;await pg.close();assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('luma-native-closure-'));await rm(directory,{recursive:true,force:true});}
