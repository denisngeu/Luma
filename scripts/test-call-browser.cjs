// Optional Edge runner for machines where the Electron test runtime cannot start.
const {chromium}=require('playwright');
const flags=[];
let browser;
const app={
 commandLine:{appendSwitch(name,value){flags.push('--'+name+(value===undefined?'':'='+value));}},
 setPath(){},on(){},
 async whenReady(){browser=await chromium.launch({channel:'msedge',headless:true,args:flags});},
 async exit(code){await browser?.close();process.exit(code);},
};
const session={fromPartition(){return {setPermissionRequestHandler(){},setPermissionCheckHandler(){}};}};
class BrowserWindow{
 constructor({width,height}){
  this.closed=false;
  this.ready=browser.newContext({viewport:{width,height},permissions:['microphone','camera']}).then(async context=>{this.context=context;this.page=await context.newPage();this.page.on('pageerror',error=>console.error('Browser error:',error.message));});
  this.webContents={
   executeJavaScript:async code=>{await this.ready;return this.page.evaluate(code);},
   capturePage:async()=>{await this.ready;const png=await this.page.screenshot();return {toPNG:()=>png};},
  };
 }
 async loadURL(url){await this.ready;await this.page.goto(url);}
 isDestroyed(){return this.closed;}
 destroy(){this.closed=true;void this.context?.close();}
}
module.exports={app,BrowserWindow,session};
