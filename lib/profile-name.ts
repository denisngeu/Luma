export const PROFILE_NAME_MIN=2;
export const PROFILE_NAME_MAX=60;
export const PROFILE_NAME_ERROR='Le nom doit contenir entre 2 et 60 caractères.';

export function normalizeProfileName(value:unknown):string|null{
 if(typeof value!=='string')return null;
 const name=value.trim().replace(/\s+/g,' ');
 return name.length>=PROFILE_NAME_MIN&&name.length<=PROFILE_NAME_MAX?name:null;
}
