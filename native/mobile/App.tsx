import React,{useCallback,useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,AppState,BackHandler,Linking,Pressable,StyleSheet,Text,Vibration,View} from 'react-native';
import {setAudioModeAsync,useAudioPlayer} from 'expo-audio';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {SafeAreaProvider,SafeAreaView,useSafeAreaInsets} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';

const SERVER=process.env.EXPO_PUBLIC_LUMA_URL||'';
const MOBILE_RELEASE='0.3.9';
const themeBridge=`(()=>{const send=()=>window.ReactNativeWebView.postMessage(JSON.stringify({theme:document.documentElement.dataset.luma}));new MutationObserver(send).observe(document.documentElement,{attributes:true,attributeFilter:['data-luma']});send()})();true;`;
// One persistent WebView keeps cookies, theme preferences and navigation together.
class NativeErrorBoundary extends React.Component<React.PropsWithChildren,{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return{failed:true};}
 render(){
  if(this.state.failed)return <View style={styles.fallback}><Text style={styles.logo}>Luma</Text><Text style={styles.text}>Luma a rencontré une erreur d’affichage.</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={()=>this.setState({failed:false})}><Text style={styles.retryText}>Relancer Luma</Text></Pressable></View>;
  return this.props.children;
 }
}
export default function App(){return <NativeErrorBoundary><SafeAreaProvider><LumaApp/></SafeAreaProvider></NativeErrorBoundary>;}
function LumaApp(){
 const insets=useSafeAreaInsets();
 const ringtone=useAudioPlayer(require('./assets/ringtone.wav'));
 const ringing=useRef<string|null>(null);
 const web=useRef<WebView>(null);
 const back=useRef(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [message,setMessage]=useState('Ouverture de Luma…');
 const [webKey,setWebKey]=useState(0);
 const [webMounted,setWebMounted]=useState(true);
 const [dark,setDark]=useState(true);
 const sharing=useRef(false);
 const rendererCrashes=useRef<number[]>([]);
 const loadTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const rendererTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
 const rendererGone=useRef(false);
 const loadFailed=useRef(false);
 const clearLoadTimer=useCallback(()=>{if(loadTimer.current){clearTimeout(loadTimer.current);loadTimer.current=null;}},[]);
 const clearRendererTimer=useCallback(()=>{if(rendererTimer.current){clearTimeout(rendererTimer.current);rendererTimer.current=null;}},[]);
 const beginLoad=useCallback(()=>{clearLoadTimer();loadFailed.current=false;setError(false);setLoading(true);setMessage('Ouverture de Luma…');loadTimer.current=setTimeout(()=>{loadFailed.current=true;setLoading(false);setError(true);setMessage('Luma met trop de temps à répondre.');},20000);},[clearLoadTimer]);
 const finishLoad=useCallback(()=>{clearLoadTimer();if(loadFailed.current)return;setLoading(false);setError(false);},[clearLoadTimer]);
 const recover=useCallback((reason='Connexion indisponible. Vérifiez votre réseau.')=>{clearLoadTimer();loadFailed.current=true;setMessage(reason);setError(true);setLoading(false);},[clearLoadTimer]);
 const retry=useCallback(()=>{rendererCrashes.current=[];rendererGone.current=false;clearRendererTimer();beginLoad();setWebKey(value=>value+1);setWebMounted(true);},[beginLoad,clearRendererTimer]);
 const recoverRenderer=useCallback(()=>{const now=Date.now(),recent=rendererCrashes.current.filter(time=>now-time<60000);rendererCrashes.current=[...recent,now];rendererGone.current=true;clearRendererTimer();setWebMounted(false);if(recent.length){recover('Le moteur d’affichage Android s’est arrêté deux fois. Touchez Recharger Luma pour repartir proprement.');return;}loadFailed.current=true;setLoading(true);setMessage('Redémarrage de l’affichage…');rendererTimer.current=setTimeout(()=>{rendererTimer.current=null;rendererGone.current=false;beginLoad();setWebKey(value=>value+1);setWebMounted(true);},100);},[beginLoad,clearRendererTimer,recover]);
 async function shareCard(image:unknown){
  if(sharing.current||typeof image!=='string'||image.length>3000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(image))return;
  sharing.current=true;
  try{
   if(!FileSystem.cacheDirectory||!await Sharing.isAvailableAsync())throw Error('Partage indisponible');
   const file=FileSystem.cacheDirectory+'ma-carte-luma.png';
   await FileSystem.writeAsStringAsync(file,image.split(',')[1],{encoding:FileSystem.EncodingType.Base64});
   await Sharing.shareAsync(file,{mimeType:'image/png',UTI:'public.png',dialogTitle:'Envoyer ma carte Luma'});
  }catch{Alert.alert('Partage indisponible','Réessayez ou copiez votre lien d’invitation depuis la page Amis.');}finally{sharing.current=false;}
 }
 useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(error){retry();return true;}if(!back.current)return false;web.current?.goBack();return true;});return()=>listener.remove();},[error,retry]);
 useEffect(()=>{const listener=AppState.addEventListener('change',state=>{if(state==='active'&&!error&&!rendererGone.current)web.current?.injectJavaScript("window.dispatchEvent(new Event('focus'));window.dispatchEvent(new Event('online'));true;");});return()=>listener.remove();},[error]);
 useEffect(()=>()=>{clearLoadTimer();clearRendererTimer();},[clearLoadTimer,clearRendererTimer]);
 useEffect(()=>{void setAudioModeAsync({playsInSilentMode:true,shouldPlayInBackground:false,interruptionMode:'doNotMix'}).catch(()=>{});return()=>{Vibration.cancel();try{ringtone.pause();}catch{}};},[ringtone]);
 const updateRingtone=useCallback((id:unknown)=>{
  try{
   if(typeof id==='string'&&id){if(ringing.current===id)return;ringing.current=id;ringtone.loop=true;void ringtone.seekTo(0).catch(()=>{});ringtone.play();Vibration.vibrate([0,450,250,450,1200],true);return;}
   ringing.current=null;Vibration.cancel();ringtone.pause();void ringtone.seekTo(0).catch(()=>{});
  }catch{ringing.current=null;Vibration.cancel();}
 },[ringtone]);
 let origin='';
 try{const url=new URL(SERVER);if(url.protocol==='https:')origin=url.origin;}catch{}
 if(!origin)return <SafeAreaView edges={['top','left','right']} style={styles.screen}><Text style={styles.text}>Configurez l’adresse HTTPS de Luma avant de construire l’application.</Text></SafeAreaView>;
 const safeAreaBridge=`document.documentElement.style.setProperty('--native-safe-bottom','${insets.bottom}px');true;`;
 return <SafeAreaView edges={['top','left','right']} style={[styles.screen,{backgroundColor:dark?'#121623':'#f4f5fb'}]}>
   {webMounted&&<WebView key={webKey} ref={web} style={styles.web} source={{uri:origin+'/fil?native=android&release='+MOBILE_RELEASE}} originWhitelist={[origin]} sharedCookiesEnabled thirdPartyCookiesEnabled domStorageEnabled javaScriptEnabled allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} mediaCapturePermissionGrantType="prompt" mixedContentMode="never" cacheEnabled={false} cacheMode="LOAD_NO_CACHE" setSupportMultipleWindows={false} overScrollMode="never" scrollEnabled nestedScrollEnabled decelerationRate="normal"
     onNavigationStateChange={state=>{back.current=state.canGoBack;}}
     injectedJavaScriptBeforeContentLoaded={safeAreaBridge} injectedJavaScript={safeAreaBridge+themeBridge} onMessage={event=>{try{const url=new URL(event.nativeEvent.url);if(url.origin!==origin)return;const message=JSON.parse(event.nativeEvent.data);if(message.theme==='dark'||message.theme==='light')setDark(message.theme==='dark');if(message.type==='share-contact-card'&&url.pathname==='/amis')void shareCard(message.image);if(message.type==='incoming-call')updateRingtone(message.id);}catch{}}}
     onLoadStart={beginLoad} onLoadEnd={finishLoad} onError={()=>recover()} onHttpError={event=>recover('Le serveur Luma répond avec une erreur ('+event.nativeEvent.statusCode+').')}
     onRenderProcessGone={recoverRenderer} onContentProcessDidTerminate={recoverRenderer}
     onShouldStartLoadWithRequest={request=>{try{const url=new URL(request.url);if(url.protocol==='https:'&&url.origin===origin)return true;if(['https:','mailto:'].includes(url.protocol))void Linking.openURL(request.url);return false;}catch{return false;}}}
   />}
   {loading&&<View style={styles.overlay}><ActivityIndicator size="large" color="#79e0f2"/><Text style={styles.text}>{message}</Text></View>}
   {error&&<View style={styles.overlay}><Text style={styles.logo}>Luma</Text><Text style={styles.text}>{message}</Text><Pressable accessibilityRole="button" style={styles.retry} onPress={retry}><Text style={styles.retryText}>Recharger Luma</Text></Pressable><Text style={styles.hint}>La conversation reprendra automatiquement sans supprimer votre compte ni vos messages.</Text></View>}
 </SafeAreaView>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#121623'},web:{flex:1,backgroundColor:'#121623'},fallback:{flex:1,backgroundColor:'#121623',justifyContent:'center',alignItems:'center',padding:24},logo:{color:'#fff',fontSize:32,fontWeight:'800',marginBottom:8},text:{color:'#e6e9f4',padding:18,textAlign:'center',fontSize:16},hint:{color:'#8f99b7',fontSize:12,lineHeight:18,textAlign:'center',maxWidth:300,marginTop:18},retry:{backgroundColor:'#6f72f2',paddingHorizontal:22,paddingVertical:14,borderRadius:14,minWidth:190},retryText:{color:'#fff',fontSize:15,fontWeight:'700',textAlign:'center'},overlay:{...StyleSheet.absoluteFillObject,backgroundColor:'#121623',justifyContent:'center',alignItems:'center',padding:24}});
