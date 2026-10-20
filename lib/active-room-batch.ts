import {ApiError,str} from './chat-server';
import type {PostgresDatabase} from './postgres';

export async function activeRoomBatch(database:PostgresDatabase,uid:string,input:unknown,now=Date.now()){
 if(!Array.isArray(input)||!input.length||input.length>50)throw new ApiError('Choisissez entre 1 et 50 salons.');
 const ids=[...new Set(input.map(value=>str(value,100)))];
 const result=await database.driver.query(`
  SELECT c.id AS chat,r.id,r.mode,r.kind,u.name AS creator_name,
   (SELECT count(*)::int FROM media_participants mp WHERE mp.room=r.id AND mp.last_seen>$3) AS participants
  FROM chats c
  LEFT JOIN LATERAL (SELECT mr.* FROM media_rooms mr WHERE mr.chat=c.id AND mr.state='open' AND mr.expires>$4 ORDER BY mr.created DESC,mr.id DESC LIMIT 1) r ON true
  LEFT JOIN users u ON u.id=r.creator
  WHERE c.id=ANY($1::text[]) AND c.locked=0
   AND NOT EXISTS(SELECT 1 FROM spaces ls WHERE ls.id=c.space AND ls.locked=1)
   AND ((c.space IS NULL AND EXISTS(SELECT 1 FROM members m WHERE m.chat=c.id AND m."user"=$2))
    OR (c.space IS NOT NULL AND EXISTS(SELECT 1 FROM space_members sm WHERE sm.space=c.space AND sm."user"=$2)))`,[ids,uid,now-30000,now]);
 if(result.rows.length!==ids.length)throw new ApiError('Discussion introuvable',404);
 return Object.fromEntries(result.rows.map(({chat,...room})=>[String(chat),room.id?room:null]));
}
