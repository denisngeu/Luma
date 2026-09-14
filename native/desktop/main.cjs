const {app,BrowserWindow,dialog,shell,session}=require('electron');
const config=require('./config.json');
let win;
function safeUrl(raw){try{const u=new URL(raw);return u.protocol==='https:'?u:null;}catch{return null;}}
app.whenReady().then(()=>{const server=safeUrl(process.env.LUMA_URL||config.serverUrl);if(!server){dialog.showErrorBox('Configuration Luma','Renseignez une adresse HTTPS dans config.json (serverUrl).');app.quit();return;}const trusted=new Set([server.origin,'https://auth.openai.com','https://auth0.openai.com','https://chatgpt.com','https://accounts.google.com','https://appleid.apple.com','https://login.microsoftonline.com']);
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
 function create(){win=new BrowserWindow({width:1300,height:860,minWidth:760,minHeight:600,title:'Luma',backgroundColor:'#103f35',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});win.webContents.setWindowOpenHandler(({url})=>{const u=safeUrl(url);if(u?.origin===server.origin)win.loadURL(u.href);else if(u)shell.openExternal(u.href);return {action:'deny'};});win.webContents.on('will-navigate',(event,url)=>{const u=safeUrl(url);if(!u||!trusted.has(u.origin)){event.preventDefault();if(u)shell.openExternal(u.href);}});win.webContents.on('will-attach-webview',event=>event.preventDefault());win.loadURL(server.href);win.on('closed',()=>{win=null;});}create();app.on('activate',()=>{if(!win)create();});});
app.on('window-all-closed',()=>{if(process.platform!=='darwin')app.quit();});
