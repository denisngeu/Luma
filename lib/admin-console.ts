import {getDatabase} from './runtime';
import {ApiError} from './chat-server';
import type {Connection} from './postgres';

export async function adminAction(actor:string,input:Record<string,unknown>){
 const action=String(input.action||''),target=String(input.target||''),reason=typeof input.reason==='string'?input.reason.trim():'';
 if(reason.length<5||reason.length>500)throw new ApiError('Indiquez un motif de 5 à 500 caractères.');
 if(target.length>150)throw new ApiError('Cible invalide.');
 const c=await getDatabase().driver.connect();
 try{
  await c.query('BEGIN');
  // Serializes role changes and checks authorization again within the transaction.
  await c.query('SELECT pg_advisory_xact_lock(721438901)');
  const me=(await c.query("SELECT id FROM users WHERE id=$1 AND role='admin' AND closed=0 AND suspended=0 FOR UPDATE",[actor])).rows[0];
  if(!me)throw new ApiError('Accès administrateur requis.',403);
  let before:Record<string,unknown>={},after:Record<string,unknown>={};
  const record=async(table:string,fields:string)=>{
   const row=(await c.query(`SELECT ${fields} FROM ${table} WHERE id=$1 FOR UPDATE`,[target])).rows[0];
   if(!row)throw new ApiError('Élément introuvable.',404);return row;
  };
  if(['suspend','restore_user','role','revoke_sessions'].includes(action)){
   before=await record('users','id,role,closed,suspended');
   if(before.closed)throw new ApiError('Ce compte est fermé.',409);
   if(action==='role'&&!['admin','user'].includes(String(input.value)))throw new ApiError('Rôle invalide.');
   if(target===actor&&['suspend','role'].includes(action))throw new ApiError('Vous ne pouvez pas retirer vos propres droits.',409);
   if(before.role==='admin'&&(action==='suspend'||action==='role'&&input.value==='user')){
    const admins=await c.query("SELECT id FROM users WHERE role='admin' AND closed=0 AND suspended=0");
    if(admins.rows.length<=1)throw new ApiError('Le dernier administrateur doit rester actif.',409);
   }
   if(action==='suspend'||action==='restore_user')await c.query('UPDATE users SET suspended=$1 WHERE id=$2',[action==='suspend'?1:0,target]);
   if(action==='role')await c.query('UPDATE users SET role=$1 WHERE id=$2',[input.value,target]);
   if(['suspend','revoke_sessions','role'].includes(action))await c.query('DELETE FROM auth_sessions WHERE "user"=$1',[target]);
   if(action==='suspend')await c.query("UPDATE calls SET state='ended',offer=NULL,answer=NULL,expires=$1 WHERE caller=$2 OR callee=$2",[Date.now()+60000,target]);
   after=await record('users','id,role,closed,suspended');
  }else if(['lock_space','lock_chat','rotate_space','rotate_chat'].includes(action)){
   const table=action.endsWith('space')?'spaces':'chats';
   before=await record(table,'id,name,locked');
   if(action.startsWith('lock_')){
    if(typeof input.value!=='boolean')throw new ApiError('État invalide.');
    await c.query(`UPDATE ${table} SET locked=$1 WHERE id=$2`,[Number(input.value),target]);
   }else await c.query(`UPDATE ${table} SET invite=$1 WHERE id=$2`,[crypto.randomUUID(),target]);
   after=await record(table,'id,name,locked');
  }else if(action==='end_call'){
   before=await record('calls','id,state,mode');
   await c.query("UPDATE calls SET state='ended',offer=NULL,answer=NULL,expires=$1 WHERE id=$2",[Date.now()+60000,target]);after={state:'ended'};
  }else if(action==='moderate'){
   if(!['message','post'].includes(String(input.kind))||typeof input.value!=='boolean')throw new ApiError('Contenu invalide.');
   const table=input.kind==='message'?'messages':'posts';
   before=await record(table,'id,hidden');
   await c.query(`UPDATE ${table} SET hidden=$1 WHERE id=$2`,[Number(input.value),target]);after={hidden:Number(input.value),kind:input.kind};
  }else if(action==='resolve_report'){
   if(!['resolved','dismissed','open'].includes(String(input.value)))throw new ApiError('Statut invalide.');
   before=await record('reports','id,state');
   await c.query('UPDATE reports SET state=$1,resolution=$2,resolved=$3 WHERE id=$4',[input.value,reason,input.value==='open'?null:Date.now(),target]);after={state:input.value};
  }else if(action==='settings'){
   if(typeof input.registrations_open!=='boolean'||typeof input.calls_open!=='boolean')throw new ApiError('Configuration invalide.');
   before=(await c.query('SELECT registrations_open,calls_open FROM service_settings WHERE id=1 FOR UPDATE')).rows[0];
   after={registrations_open:Number(input.registrations_open),calls_open:Number(input.calls_open)};
   await c.query('UPDATE service_settings SET registrations_open=$1,calls_open=$2 WHERE id=1',[after.registrations_open,after.calls_open]);
   if(!input.calls_open)await c.query("UPDATE calls SET state='ended',offer=NULL,answer=NULL,expires=$1 WHERE state IN ('preparing','ringing','active')",[Date.now()+60000]);
  }else throw new ApiError('Action inconnue.');
  await audit(c,actor,action,target,reason,before,after);
  await c.query('COMMIT');return {ok:true};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release?.();}
}
async function audit(c:Connection,actor:string,action:string,target:string,reason:string,before:unknown,after:unknown){
 await c.query('INSERT INTO admin_audit(id,actor,action,target,reason,before_state,after_state,created) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[crypto.randomUUID(),actor,action,target,reason,JSON.stringify(before),JSON.stringify(after),Date.now()]);
}
