import {createHmac} from 'node:crypto';
export function iceConfiguration(userId:string){
 const servers:RTCIceServer[]=JSON.parse(process.env.LUMA_ICE_SERVERS||'[]');
 if(!Array.isArray(servers))throw Error('Invalid LUMA_ICE_SERVERS');
 const host=process.env.LUMA_TURN_PUBLIC_IP,secret=process.env.LUMA_TURN_SECRET;
 if(host&&secret){
  const username=`${Math.floor(Date.now()/1000)+7200}:${userId}`;
  servers.push({urls:`stun:${host}:3478`},{urls:[`turn:${host}:3478?transport=udp`,`turn:${host}:3478?transport=tcp`],username,credential:createHmac('sha1',secret).update(username).digest('base64')});
 }
 return {iceServers:servers,relayConfigured:servers.some(s=>(Array.isArray(s.urls)?s.urls:[s.urls]).some(url=>/^turns?:/.test(url)))};
}
