export type CallNetworkResult={ok:boolean;message:string;relayCandidates:number;errors:number[]};

// Two local WebRTC endpoints exchange a random marker through TURN only.
// No microphone, camera, contact, or application message is involved.
export async function probeCallNetwork(iceServers:RTCIceServer[],signal:AbortSignal,timeoutMs=20000):Promise<CallNetworkResult>{
 if(signal.aborted)throw new DOMException('Test annulé.','AbortError');
 const hasRelay=iceServers.some(server=>(Array.isArray(server.urls)?server.urls:[server.urls]).some(url=>/^turns?:/.test(url)));
 if(!hasRelay)return {ok:false,message:'Aucun relais d’appel n’est configuré sur le serveur.',relayCandidates:0,errors:[]};
 if(typeof RTCPeerConnection==='undefined')return {ok:false,message:'Cet appareil ne prend pas en charge le test de connexion.',relayCandidates:0,errors:[]};
 const peers:RTCPeerConnection[]=[],channels:RTCDataChannel[]=[],errors=new Set<number>();
 let relayCandidates=0,timer:ReturnType<typeof setTimeout>|undefined,finished=false;
 let complete:(result:CallNetworkResult)=>void=()=>{},fail:(error:unknown)=>void=()=>{};
 const outcome=new Promise<CallNetworkResult>((resolve,reject)=>{complete=resolve;fail=reject;});
 const pending:[RTCIceCandidate[],RTCIceCandidate[]]=[[],[]];
 const finish=(ok:boolean,message:string)=>{if(finished)return;finished=true;complete({ok,message,relayCandidates,errors:[...errors]});};
 const abort=()=>{if(!finished){finished=true;fail(new DOMException('Test annulé.','AbortError'));}};
 signal.addEventListener('abort',abort,{once:true});
 try{
  peers.push(new RTCPeerConnection({iceServers,iceTransportPolicy:'relay'}));
  peers.push(new RTCPeerConnection({iceServers,iceTransportPolicy:'relay'}));
  const [sender,receiver]=peers;
  const marker='luma-network-'+crypto.randomUUID();
  for(const [index,peer]of peers.entries()){
   const target=peers[1-index];
   peer.onicecandidate=event=>{
    if(!event.candidate||finished)return;
    if(event.candidate.type==='relay')relayCandidates++;
    if(!target.remoteDescription)pending[1-index].push(event.candidate);
    else void target.addIceCandidate(event.candidate).catch(()=>{});
   };
   peer.onicecandidateerror=event=>{if(Number.isInteger(event.errorCode))errors.add(event.errorCode);};
  }
  receiver.ondatachannel=event=>{const channel=event.channel;channels.push(channel);channel.onmessage=message=>{if(!finished&&message.data===marker)channel.send(marker+':ok');};};
  const channel=sender.createDataChannel('luma-network-check');channels.push(channel);
  channel.onopen=()=>{if(!finished)channel.send(marker);};
  channel.onmessage=event=>{if(event.data===marker+':ok')finish(true,'Le relais fonctionne : les données d’appel circulent dans les deux sens.');};
  timer=setTimeout(()=>{
   const message=relayCandidates?'Le relais répond, mais le transfert ne s’établit pas sur ce réseau.':
    errors.has(486)||errors.has(508)?'Le relais d’appel a atteint sa limite de connexions. Terminez les autres appels puis réessayez.':
    errors.has(401)||errors.has(403)?'Le serveur refuse l’accès au relais d’appel. Réessayez et signalez ce résultat si le problème continue.':
    'Le relais d’appel est injoignable depuis ce réseau. Essayez aussi en Wi-Fi ou en 4G/5G.';
   finish(false,message);
  },timeoutMs);
  // Signaling is local to this test; ICE and the data channel use the real relay.
  void(async()=>{
   try{
    await sender.setLocalDescription(await sender.createOffer());if(finished)return;
    await receiver.setRemoteDescription(sender.localDescription!);if(finished)return;
    for(const candidate of pending[1].splice(0))await receiver.addIceCandidate(candidate);
    await receiver.setLocalDescription(await receiver.createAnswer());if(finished)return;
    await sender.setRemoteDescription(receiver.localDescription!);if(finished)return;
    for(const candidate of pending[0].splice(0))await sender.addIceCandidate(candidate);
   }catch{finish(false,'Impossible d’établir le test de connexion. Réessayez après avoir vérifié votre réseau.');}
  })();
  return await outcome;
 }finally{
  finished=true;if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);
  for(const channel of channels){channel.onopen=null;channel.onmessage=null;channel.close();}
  for(const peer of peers){peer.onicecandidate=null;peer.onicecandidateerror=null;peer.ondatachannel=null;peer.close();}
 }
}
