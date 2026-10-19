import assert from 'node:assert/strict';
import {applyPreferredAudioOutput,mediaDevicePreferences,preferredMicrophone} from '../lib/media-devices.ts';

let saved;
globalThis.localStorage={getItem:()=>saved};
for(const corrupt of [undefined,'null','{invalid','[]','{"input":123,"output":false}']){
 saved=corrupt;assert.deepEqual(mediaDevicePreferences(),{input:'',output:''});
}
saved=JSON.stringify({input:'usb-mic',output:'headphones'});
assert.deepEqual(preferredMicrophone({echoCancellation:true}),{echoCancellation:true,deviceId:{ideal:'usb-mic'}});
const selected=[];
await applyPreferredAudioOutput({sinkId:'',setSinkId:async id=>selected.push(id)});
assert.deepEqual(selected,['headphones']);
const fallback=[];
await applyPreferredAudioOutput({sinkId:'',setSinkId:async id=>{fallback.push(id);if(id)throw new DOMException('Disconnected','NotFoundError');}});
assert.deepEqual(fallback,['headphones','']);
await applyPreferredAudioOutput({}); // Mobile platforms may choose outputs through the OS.
saved='{}';assert.deepEqual(preferredMicrophone({echoCancellation:true}),{echoCancellation:true});
console.log('PASS audio device preferences, corrupt storage, selected output, disconnected output fallback and unsupported output selection.');
