import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
export function db(){const value=(env as unknown as {DB:D1Database}).DB;if(!value)throw new Error('Stockage indisponible');return value;}
export function bucket(){return (env as unknown as {BUCKET:R2Bucket}).BUCKET;}
export class ApiError extends Error{constructor(message:string,public status=400){super(message);}}
export async function user(){const u=await getChatGPTUser();if(!u)throw new ApiError('Connectez-vous pour utiliser la messagerie.',401);const name=u.fullName||u.email.split('@')[0];await db().prepare('INSERT INTO users (id,name) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name').bind(u.userId,name).run();return {id:u.userId,name};}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)throw new ApiError('Origine refusée',403);}
export async function member(uid:string,chat:string){const row=await db().prepare('SELECT c.* FROM chats c JOIN members m ON m.chat=c.id WHERE c.id=? AND m.user=?').bind(chat,uid).first();if(!row)throw new ApiError('Discussion introuvable',404);return row;}
export function fail(e:unknown){if(e instanceof ApiError)return Response.json({error:e.message},{status:e.status});console.error('Luma API error',e);return Response.json({error:'Le service est temporairement indisponible. Votre saisie est conservée.'},{status:503});}
export function str(v:unknown,max=10000){if(typeof v!=='string'||!v.trim()||v.length>max)throw new ApiError('Vérifiez les informations saisies.');return v.trim();}
