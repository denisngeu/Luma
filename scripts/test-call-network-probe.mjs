// Lifecycle and relay-only policy tests. Actual TURN transport is checked in the deployed UI.
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
mkdirSync('.sites-runtime/network-probe',{recursive:true});
await build({entryPoints:['lib/call-network-probe.ts'],outfile:'.sites-runtime/network-probe/probe.mjs',bundle:true,platform:'node',format:'esm'});
const {probeCallNetwork}=await import(pathToFileURL(process.cwd()+'/.sites-runtime/network-probe/probe.mjs'));
let peers=[],channels=[],mode='success',permissionCalls=0;
Object.defineProperty(globalThis,'navigator',{value:{mediaDevices:{getUserMedia(){permissionCalls++;throw Error('This test must not capture media');}}},configurable:true});
class Channel{
 constructor(){this.closed=false;channels.push(this);}
 send(value){queueMicrotask(()=>this.other?.onmessage?.({data:value}));}
 close(){this.closed=true;}
}
class Peer{
 constructor(config){assert.equal(config.iceTransportPolicy,'relay');this.index=peers.length;this.config=config;peers.push(this);this.closed=false;this.added=[];}
 createDataChannel(){this.channel=new Channel();return this.channel;}
 async createOffer(){return {type:'offer',sdp:'test offer'};}
 async createAnswer(){return {type:'answer',sdp:'test answer'};}
 async setLocalDescription(description){this.localDescription=description;if(mode==='auth-denied')this.onicecandidateerror?.({errorCode:403});else if(mode==='quota')this.onicecandidateerror?.({errorCode:486});else if(mode!=='no-candidates')this.onicecandidate?.({candidate:{type:'relay',candidate:'relay fixture'}});}
 async setRemoteDescription(description){
  this.remoteDescription=description;
  if(this.index===0&&description.type==='answer'&&mode==='success'){
   const other=new Channel();other.other=this.channel;this.channel.other=other;
   peers[1].ondatachannel?.({channel:other});queueMicrotask(()=>this.channel.onopen?.());
  }
 }
 async addIceCandidate(candidate){assert.ok(this.remoteDescription,'candidate queued until remote description exists');this.added.push(candidate);}
 close(){this.closed=true;}
}
globalThis.RTCPeerConnection=Peer;
const servers=[{urls:'turn:relay.example.test:3478',username:'fixture',credential:'fixture'}];
const reset=next=>{mode=next;peers=[];channels=[];};
const clean=()=>{assert.ok(peers.every(peer=>peer.closed),'all peer connections are closed');assert.ok(channels.every(channel=>channel.closed),'all data channels are closed');assert.ok(peers.every(peer=>peer.onicecandidate===null&&peer.onicecandidateerror===null&&peer.ondatachannel===null),'event handlers cleared');};
assert.equal((await probeCallNetwork([],new AbortController().signal)).ok,false);assert.equal(peers.length,0);
reset('success');const report=await probeCallNetwork(servers,new AbortController().signal,1000);assert.equal(report.ok,true);assert.equal(report.relayCandidates,2);assert.equal(peers[1].added.length,1);assert.equal(permissionCalls,0);clean();
reset('with-candidates');const failed=await probeCallNetwork(servers,new AbortController().signal,10);assert.equal(failed.ok,false);assert.match(failed.message,/transfert/);clean();
reset('no-candidates');const unreachable=await probeCallNetwork(servers,new AbortController().signal,10);assert.equal(unreachable.ok,false);assert.match(unreachable.message,/injoignable/);clean();
reset('auth-denied');const denied=await probeCallNetwork(servers,new AbortController().signal,10);assert.match(denied.message,/refuse/);assert.deepEqual(denied.errors,[403]);clean();
reset('quota');const quota=await probeCallNetwork(servers,new AbortController().signal,10);assert.match(quota.message,/limite de connexions/);clean();
reset('with-candidates');const controller=new AbortController(),pending=probeCallNetwork(servers,controller.signal,1000);controller.abort();await assert.rejects(pending,{name:'AbortError'});clean();
reset('success');const cancelled=new AbortController();cancelled.abort();await assert.rejects(probeCallNetwork(servers,cancelled.signal),{name:'AbortError'});assert.equal(peers.length,0);
console.log('PASS relay-only construction, marker round-trip, candidate queuing, timeout distinctions, abort cleanup and zero media permissions.');
