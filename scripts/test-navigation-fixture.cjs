// The real App Router supplies reactive query values. Local component fixtures
// emulate that contract without a full-page reload or access to real accounts.
module.exports=`
 import {useSyncExternalStore} from 'react';
 const subscribe=notify=>{window.addEventListener('popstate',notify);return()=>window.removeEventListener('popstate',notify);};
 export const useSearchParams=()=>new URLSearchParams(useSyncExternalStore(subscribe,()=>location.search,()=>''));
 export const useRouter=()=>({push(url){location.assign(url);}});
`;
