import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
const dir='.sites-runtime/visible-polling';mkdirSync(dir,{recursive:true});
await build({entryPoints:['lib/visible-polling.ts'],outfile:dir+'/poll.mjs',bundle:true,platform:'node',format:'esm'});
const nativeTimeout=globalThis.setTimeout,nativeClear=globalThis.clearTimeout,nativeNow=Date.now;
let now=1700000000000,id=0;const timers=new Map();
globalThis.window=new EventTarget();globalThis.document=Object.assign(new EventTarget(),{hidden:false});
Date.now=()=>now;globalThis.setTimeout=(fn,ms)=>{timers.set(++id,{at:now+ms,fn});return id;};globalThis.clearTimeout=id=>timers.delete(id);
const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
async function advance(ms){now+=ms;for(const [key,timer] of [...timers])if(timer.at<=now){timers.delete(key);timer.fn();}await flush();}
const event=name=>window.dispatchEvent(new Event(name));
try{
 const {startVisiblePolling}=await import(pathToFileURL(process.cwd()+'/'+dir+'/poll.mjs'));
 const pending=[],data=[],errors=[];
 const stop=startVisiblePolling({read:signal=>new Promise((resolve,reject)=>pending.push({signal,resolve,reject})),onData:item=>data.push(item),onError:error=>errors.push(error.message)});
 assert.equal(pending.length,1);pending[0].resolve('one');await flush();
 for(let i=0;i<30;i++)event('focus');assert.equal(pending.length,1);assert.equal(timers.size,1,'one future timer');
 await advance(4000);assert.equal(pending.length,2);await advance(60000);assert.equal(pending.length,2,'no overlapping reads or queued bursts');pending[1].resolve('two');await flush();
 await advance(4000);pending[2].reject(Error('offline'));await flush();assert.deepEqual(errors,['offline']);
 for(let i=0;i<30;i++)event('online');await advance(4000);assert.equal(pending.length,3,'failure backoff applies to online notifications');
 event('luma-native-background');await advance(1000);event('luma-native-active');assert.equal(pending.length,3,'changing apps does not bypass backoff');await advance(3000);assert.equal(pending.length,4);pending[3].resolve('recovered');await flush();
 await advance(4000);assert.equal(pending.length,5);event('luma-native-background');assert.equal(pending[4].signal.aborted,true);pending[4].resolve('stale');await flush();assert.equal(data.includes('stale'),false);assert.equal(timers.size,0);
 event('luma-native-active');assert.equal(pending.length,6);pending[5].resolve('foreground');await flush();assert.deepEqual(data,['one','two','recovered','foreground']);
 await advance(4000);assert.equal(pending.length,7);stop();assert.equal(pending[6].signal.aborted,true);pending[6].resolve('after stop');await flush();event('focus');await advance(60000);assert.equal(pending.length,7);assert.equal(timers.size,0);assert.equal(data.includes('after stop'),false);
 console.log('PASS visible polling: one read/timer, no queued burst, backoff, native pause/resume, stale result suppression and cleanup.');
}finally{globalThis.setTimeout=nativeTimeout;globalThis.clearTimeout=nativeClear;Date.now=nativeNow;delete globalThis.window;delete globalThis.document;}
