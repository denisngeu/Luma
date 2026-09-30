// Keep the microphone independent of Web Audio: mobile browsers can suspend it.
export function mediaError(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'Accès refusé. Autorisez le micro ou la caméra dans les réglages de Luma et du téléphone, puis réessayez.';
    if (error.name === 'NotFoundError') return 'Aucun micro ou aucune caméra disponible sur cet appareil.';
    if (error.name === 'NotReadableError') return 'Le micro ou la caméra est utilisé par une autre application. Fermez-la puis réessayez.';
  }
  return error instanceof Error ? error.message : 'Impossible d’accéder aux appareils.';
}

export async function gatherIce(peer: RTCPeerConnection) {
  if (peer.iceGatheringState === 'complete') return;
  await new Promise<void>((resolve, reject) => {
    const finish = (error?: Error) => {
      clearTimeout(timer);
      peer.removeEventListener('icegatheringstatechange', check);
      peer.removeEventListener('connectionstatechange', closed);
      if (error) reject(error);
      else resolve();
    };
    const check = () => { if (peer.iceGatheringState === 'complete') finish(); };
    const closed = () => { if (peer.connectionState === 'closed') finish(new Error('Appel interrompu.')); };
    const timer = setTimeout(() => finish(), 12000);
    peer.addEventListener('icegatheringstatechange', check);
    peer.addEventListener('connectionstatechange', closed);
    check();
  });
}

export function screenSharingSupported() {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

export const screenSharingUnavailable = 'Cet appareil ne permet pas de partager son écran depuis Luma. Vous pouvez recevoir un partage ; pour en lancer un, utilisez Luma sur ordinateur.';
