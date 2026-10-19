type DevicePreferences = {input: string; output: string};

export function mediaDevicePreferences(): DevicePreferences {
  try {
    const saved = JSON.parse(localStorage.getItem('luma-media-devices') || '{}');
    return {
      input: typeof saved?.input === 'string' ? saved.input : '',
      output: typeof saved?.output === 'string' ? saved.output : '',
    };
  } catch {
    return {input: '', output: ''};
  }
}

export function preferredMicrophone(options: MediaTrackConstraints): MediaTrackConstraints {
  const {input} = mediaDevicePreferences();
  // Keep calls usable when a saved USB/Bluetooth microphone is disconnected.
  return input ? {...options, deviceId: {ideal: input}} : options;
}

export async function applyPreferredAudioOutput(element: HTMLMediaElement) {
  const {output} = mediaDevicePreferences();
  if (!output || typeof element.setSinkId !== 'function' || element.sinkId === output) return;
  try {
    await element.setSinkId(output);
  } catch {
    // An unavailable or unauthorized output must not silence the call.
    await element.setSinkId('').catch(() => {});
  }
}
