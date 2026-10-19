let nativeActive=true,installed=false;
const observers=new Set<()=>void>();

export function isAppVisible(){return typeof document!=='undefined'&&!document.hidden&&nativeActive;}

export function watchAppVisibility(observer:()=>void){
  if(!installed){
    installed=true;
    const notify=()=>{for(const callback of observers)callback();};
    // Track native state for this window even between page subscriptions.
    window.addEventListener('luma-native-background',()=>{nativeActive=false;notify();});
    window.addEventListener('luma-native-active',()=>{nativeActive=true;notify();});
    document.addEventListener('visibilitychange',notify);
    window.addEventListener('focus',notify);window.addEventListener('online',notify);
  }
  observers.add(observer);
  return()=>{observers.delete(observer);};
}
