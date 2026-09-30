import {mkdir,readFile,writeFile,rename,unlink} from 'node:fs/promises';
import path from 'node:path';
export {getDatabase} from './postgres';

function filePath(key:string){
 if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key))throw Error('Invalid storage key');
 return path.join(/* turbopackIgnore: true */ process.env.LUMA_UPLOAD_DIRECTORY||'/app/.wrangler/state/uploads',key);
}
export function getBucket(){return {
 async put(key:string,body:ReadableStream,options?:unknown){
  void options;
  const destination=filePath(key);await mkdir(path.dirname(destination),{recursive:true});
  const temporary=destination+'.'+crypto.randomUUID()+'.tmp';
  try{await writeFile(temporary,new Uint8Array(await new Response(body).arrayBuffer()),{flag:'wx',mode:0o600});await rename(temporary,destination);}catch(error){await unlink(temporary).catch(()=>{});throw error;}
 },
 async get(key:string){try{return {body:new Uint8Array(await readFile(filePath(key)))};}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;throw error;}},
 async delete(key:string){try{await unlink(filePath(key));}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}},
};}
