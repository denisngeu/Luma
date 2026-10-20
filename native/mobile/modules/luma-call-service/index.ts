import {requireOptionalNativeModule} from 'expo';

type CallService={
 start(token:string,camera:boolean):Promise<void>;
 stop(token:string):Promise<void>;
 addListener(name:'onCallEnded',listener:(event:{token:string})=>void):{remove():void};
};

export default requireOptionalNativeModule<CallService>('LumaCallService');
