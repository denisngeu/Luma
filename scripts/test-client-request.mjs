import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {ClientRequestError,requestJson} from '../lib/client-request.ts';

const server=createServer((request,response)=>{
 if(request.url==='/slow'){
  const timer=setTimeout(()=>response.end('{"ok":true}'),5000);
  response.on('close',()=>clearTimeout(timer));return;
 }
 if(request.url==='/conflict'){response.writeHead(409,{'Content-Type':'application/json'});response.end('{"error":"Demande déjà traitée."}');return;}
 if(request.url==='/html'){response.writeHead(502,{'Content-Type':'text/html'});response.end('<html>Unavailable</html>');return;}
 response.setHeader('Content-Type','application/json');response.end('{"ok":true}');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
try{
 assert.deepEqual(await requestJson(base),{ok:true});
 await assert.rejects(requestJson(base+'/conflict'),error=>error instanceof ClientRequestError&&error.status===409&&error.message==='Demande déjà traitée.');
 await assert.rejects(requestJson(base+'/html'),error=>error instanceof ClientRequestError&&error.status===502&&/illisible/.test(error.message));
 await assert.rejects(requestJson(base+'/slow',{},50),error=>error instanceof ClientRequestError&&/trop de temps/.test(error.message));
 const controller=new AbortController();const pending=requestJson(base+'/slow',{signal:controller.signal});controller.abort();
 await assert.rejects(pending,error=>error.name==='AbortError');
 console.log('PASS JSON requests, HTTP status errors, invalid responses, bounded loading and caller cancellation.');
}finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
