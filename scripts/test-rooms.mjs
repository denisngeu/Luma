import assert from 'node:assert/strict';
const base='http://127.0.0.1:8788',headers=who=>({'oai-authenticated-user-id':'room-'+who,'oai-authenticated-user-email':who+'@rooms.test','Content-Type':'application/json'});
async function call(who,route,action,data={},status=200){const r=await fetch(base+'/api/'+route,{method:'POST',headers:headers(who),body:JSON.stringify({action,...data})});const d=await r.json();assert.equal(r.status,status,JSON.stringify(d));return d;}
const made=await call('owner','community','create_space',{name:'Serveur vocal'}),space=await call('owner','community','space',{space:made.id}),voice=space.channels.find(c=>c.mode==='voice');assert.ok(voice);
await call('member','community','join_space',{code:space.space.invite});
const room=await call('owner','rooms','create',{chat:voice.id,mode:'video'});assert.equal((await call('owner','rooms','join',{id:room.id})).room.kind,'voice');await call('member','rooms','join',{id:room.id});
let state=await call('owner','rooms','poll',{id:room.id});assert.equal(state.participants.length,2);await call('member','rooms','signal',{id:room.id,recipient:'room-owner',type:'offer',payload:'{"type":"offer","sdp":"test"}'});state=await call('owner','rooms','poll',{id:room.id});assert.equal(state.signals.length,1);assert.equal((await call('owner','rooms','poll',{id:room.id})).signals.length,0);
await call('outsider','rooms','info',{id:room.id},404);await call('owner','rooms','end',{id:room.id});await call('member','rooms','info',{id:room.id},404);
console.log('PASS: voice room creation, membership authorization, group presence, private signaling delivery and room termination.');
