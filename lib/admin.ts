import {getDatabase} from '@/lib/runtime';
export async function isAdministrator(userId:string){
 const account=await getDatabase().prepare("SELECT 1 FROM users WHERE id=? AND role='admin' AND closed=0").bind(userId).first();
 return !!account;
}
