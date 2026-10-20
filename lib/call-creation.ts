import type {PostgresDatabase} from './postgres';
import {ApiError} from './chat-server';

export async function createPrivateCall(database:PostgresDatabase,caller:string,callee:string,mode:string,requestId?:unknown){
 if(requestId!==undefined&&(typeof requestId!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)))throw new ApiError('Identifiant de tentative invalide.');
 const id=typeof requestId==='string'?requestId.toLowerCase():crypto.randomUUID(),client=await database.driver.connect();
 try{
  await client.query('BEGIN');
  // Calls sharing either participant must check availability in sequence.
  // Stable lock order also covers simultaneous calls in opposite directions.
  await client.query('SELECT id FROM users WHERE id=ANY($1::text[]) ORDER BY id FOR UPDATE',[[caller,callee].sort()]);
  const now=Date.now();
  const previous=(await client.query('SELECT caller,callee,mode,state,expires FROM calls WHERE id=$1',[id])).rows[0];
  if(previous){
   if(previous.caller!==caller||previous.callee!==callee||previous.mode!==mode||previous.state!=='preparing'||Number(previous.expires)<=now)throw new ApiError('Cette tentative d’appel est terminée ou déjà démarrée. Relancez un appel.',409);
  }else{
   const occupied=await client.query("SELECT id FROM calls WHERE state IN ('preparing','ringing','active') AND expires>$1 AND (caller=ANY($2::text[]) OR callee=ANY($2::text[])) LIMIT 1",[now,[caller,callee]]);
   if(occupied.rows.length)throw new ApiError('Un des participants a déjà un appel en cours.',409);
   await client.query("INSERT INTO calls(id,caller,callee,mode,state,created,expires) VALUES ($1,$2,$3,$4,'preparing',$5,$6)",[id,caller,callee,mode,now,now+120000]);
  }
  await client.query('COMMIT');return {id};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release?.();}
}

export async function createMediaRoom(database:PostgresDatabase,chat:string,creator:string,kind:string,mode:string){
 const client=await database.driver.connect();
 try{
  await client.query('BEGIN');
  await client.query('SELECT id FROM chats WHERE id=$1 FOR UPDATE',[chat]);
  const now=Date.now(),existing=(await client.query("SELECT id FROM media_rooms WHERE chat=$1 AND kind=$2 AND state='open' AND expires>$3 ORDER BY created DESC LIMIT 1",[chat,kind,now])).rows[0];
  let id=existing?.id as string|undefined;
  if(!id){id=crypto.randomUUID();await client.query("INSERT INTO media_rooms(id,chat,creator,kind,mode,state,created,expires) VALUES ($1,$2,$3,$4,$5,'open',$6,$7)",[id,chat,creator,kind,mode,now,now+(kind==='voice'?43200000:14400000)]);}
  await client.query('COMMIT');return {id};
 }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release?.();}
}
