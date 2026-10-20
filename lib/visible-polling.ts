import {isAppVisible,watchAppVisibility} from './app-visibility';

// One read at a time. A suspended page cancels its read rather than building
// a queue of responses to replay when Android resumes it.
export function startVisiblePolling<T>({read,onData,onError,interval=4000}:{
 read:(signal:AbortSignal)=>Promise<T>;onData:(data:T)=>void;onError:(error:unknown)=>void;interval?:number;
}){
 let live=true,pending=false,failures=0,nextAttempt=0,controller:AbortController|null=null,timer:ReturnType<typeof setTimeout>|null=null;
 function schedule(){
  if(timer)clearTimeout(timer);timer=null;
  if(live&&isAppVisible())timer=setTimeout(()=>void refresh(),Math.max(0,nextAttempt-Date.now()));
 }
 async function refresh(){
  if(!live||pending||!isAppVisible())return;
  if(Date.now()<nextAttempt){schedule();return;}
  pending=true;const current=new AbortController();controller=current;
  try{
   const data=await read(current.signal);
   if(!live||current.signal.aborted)return;
   onData(data);failures=0;nextAttempt=Date.now()+interval;
  }catch(error){
   if(!live||current.signal.aborted)return;
   failures=Math.min(failures+1,4);nextAttempt=Date.now()+Math.min(60000,interval*2**failures);onError(error);
  }finally{pending=false;if(controller===current)controller=null;schedule();}
 }
 const unwatch=watchAppVisibility(()=>{
  if(!isAppVisible()){if(timer)clearTimeout(timer);timer=null;controller?.abort();return;}
  void refresh();
 });
 void refresh();
 return()=>{live=false;controller?.abort();if(timer)clearTimeout(timer);unwatch();};
}
