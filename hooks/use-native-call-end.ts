'use client';
import {useEffect,useRef} from 'react';
import type {createNativeCallSession} from '@/lib/native-call-session';

export function useNativeCallEnd(session:ReturnType<typeof createNativeCallSession>,onEnd:()=>Promise<void>){
 const callback=useRef(onEnd);
 useEffect(()=>{callback.current=onEnd;},[onEnd]);
 useEffect(()=>{
  const ended=(event:Event)=>{if(session.owns((event as CustomEvent<{token:string}>).detail?.token))void callback.current();};
  window.addEventListener('luma-native-call-ended',ended);
  return()=>window.removeEventListener('luma-native-call-ended',ended);
 },[session]);
}
