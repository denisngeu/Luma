import {Pool} from 'pg';
import {pathToFileURL} from 'node:url';
export async function grantAdmin(pool,email){
 if(typeof email!=='string'||!email.trim()||email.includes('\\'))throw Error('Specify the exact account email');
 const result=await pool.query(`UPDATE users SET role='admin' WHERE closed=0 AND id=(SELECT "user" FROM auth_accounts WHERE email=$1) RETURNING id,role`,[email.trim().toLowerCase()]);
 if(result.rows.length!==1)throw Error('Active account not found; no permissions changed');
 return result.rows[0];
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(!process.env.DATABASE_URL)throw Error('DATABASE_URL is required');
 const pool=new Pool({connectionString:process.env.DATABASE_URL});
 try{const result=await grantAdmin(pool,process.argv[2]);console.log('Administrator role verified:',result.role);}finally{await pool.end();}
}
