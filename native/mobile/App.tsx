import React,{useEffect,useRef,useState} from 'react';
import {ActivityIndicator,Alert,BackHandler,Linking,Pressable,StyleSheet,Text,View} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {SafeAreaProvider,SafeAreaView} from 'react-native-safe-area-context';
import {WebView} from 'react-native-webview';

const SERVER=process.env.EXPO_PUBLIC_LUMA_URL||'';
const themeBridge=`(()=>{const send=()=>window.ReactNativeWebView.postMessage(JSON.stringify({theme:document.documentElement.dataset.luma}));new MutationObserver(send).observe(document.documentElement,{attributes:true,attributeFilter:['data-luma']});send()})();true;`;
// One persistent WebView keeps cookies, theme preferences and navigation together.
export default function App(){
 const web=useRef<WebView>(null);
 const back=useRef(false);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState(false);
 const [dark,setDark]=useState(true);
 const sharing=useRef(false);
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
 useEffect(()=>{const listener=BackHandler.addEventListener('hardwareBackPress',()=>{if(!back.current)return false;web.current?.goBack();return true;});return()=>listener.remove();},[]);
 let origin='';
 try{const url=new URL(SERVER);if(url.protocol==='https:')origin=url.origin;}catch{}
 if(!origin)return <SafeAreaProvider><SafeAreaView style={styles.screen}><Text style={styles.text}>Configurez l’adresse HTTPS de Luma avant de construire l’application.</Text></SafeAreaView></SafeAreaProvider>;
 return <SafeAreaProvider><SafeAreaView style={[styles.screen,{backgroundColor:dark?'#121623':'#f4f5fb'}]}>
   <WebView ref={web} style={styles.web} source={{uri:origin+'/fil'}} sharedCookiesEnabled domStorageEnabled javaScriptEnabled allowsInlineMediaPlayback mediaCapturePermissionGrantType="prompt" mixedContentMode="never"
     onNavigationStateChange={state=>{back.current=state.canGoBack;}}
     injectedJavaScript={themeBridge} onMessage={event=>{try{const url=new URL(event.nativeEvent.url);if(url.origin!==origin)return;const message=JSON.parse(event.nativeEvent.data);if(message.theme==='dark'||message.theme==='light')setDark(message.theme==='dark');if(message.type==='share-contact-card'&&url.pathname==='/amis')void shareCard(message.image);}catch{}}}
     onLoadEnd={()=>setLoading(false)} onError={()=>{setError(true);setLoading(false);}}
     onShouldStartLoadWithRequest={request=>{try{const url=new URL(request.url);if(url.protocol==='https:'&&url.origin===origin)return true;if(['https:','mailto:'].includes(url.protocol))void Linking.openURL(request.url);return false;}catch{return false;}}}
   />
   {loading&&<View style={styles.overlay}><ActivityIndicator color="#a4a0ff"/><Text style={styles.text}>Ouverture de Luma…</Text></View>}
   {error&&<View style={styles.overlay}><Text style={styles.text}>Connexion indisponible. Vérifiez votre réseau.</Text><Pressable accessibilityRole="button" onPress={()=>{setError(false);setLoading(true);web.current?.reload();}}><Text style={styles.text}>Réessayer</Text></Pressable></View>}
 </SafeAreaView></SafeAreaProvider>;
}
const styles=StyleSheet.create({screen:{flex:1,backgroundColor:'#121623'},web:{flex:1,backgroundColor:'#121623'},text:{color:'#e6e9f4',padding:18,textAlign:'center'},overlay:{...StyleSheet.absoluteFillObject,backgroundColor:'#121623',justifyContent:'center',alignItems:'center'}});
