import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/native-call-session';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/native-call-session.ts'],outfile:dir+'/session.mjs',bundle:true,platform:'node',format:'esm'});
const {createNativeCallSession}=await import(pathToFileURL(process.cwd()+'/'+dir+'/session.mjs'));
const messages=[];globalThis.window=new EventTarget();window.ReactNativeWebView={postMessage(value){messages.push(JSON.parse(value));}};
const session=createNativeCallSession('test');
try{
 await session.start();assert.equal(messages.length,0,'old APKs without the capability keep working');
 window.__lumaCallService=true;
 const answer=(message,ok=true)=>window.dispatchEvent(new CustomEvent('luma-native-call-service',{detail:{requestId:message.requestId,token:message.token,ok,error:ok?'':'Service refusé'}}));
 let ready=false;const pending=session.start().then(()=>{ready=true;});const first=messages.at(-1);
 answer({...first,token:'another-call'});await Promise.resolve();assert.equal(ready,false,'another call cannot acknowledge this session');
 answer(first);await pending;assert.equal(session.owns(first.token),true);
 const camera=session.start(true),update=messages.at(-1);assert.equal(update.token,first.token);assert.equal(update.camera,true);answer(update);await camera;
 session.stop();assert.equal(messages.at(-1).action,'stop');assert.equal(session.owns(first.token),false);
 const cancelled=session.start();const stale=messages.at(-1);session.stop();await assert.rejects(cancelled,error=>error.name==='AbortError');answer(stale);assert.equal(session.owns(stale.token),false);
 const retry=session.start(),fresh=messages.at(-1);assert.notEqual(fresh.token,stale.token);answer(fresh);await retry;
 const rejected=session.start(true);answer(messages.at(-1),false);await assert.rejects(rejected,/Service refusé/);session.stop();
 console.log('PASS legacy APK compatibility, native startup acknowledgement, camera updates, ownership, cancellation, stale replies, and native refusal');
}finally{session.stop();delete globalThis.window;}
