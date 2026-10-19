import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import {themeBootstrap} from '../app/theme-bootstrap.ts';
for(const [stored,system,expected,accent] of [
 [null,false,'light'],[null,true,'light'],['light',true,'light'],['dark',false,'dark'],
 [JSON.stringify({mode:'system',accent:'#123456',size:18}),true,'dark','#123456'],
 [JSON.stringify({mode:'dark',accent:'#6366f1'}),false,'dark','#6366f1'],
 [JSON.stringify({mode:'system'}),false,'light'],['{invalid',false,'light'],['null',false,'light'],
]){
 const root={dataset:{},style:{setProperty(name,value){this[name]=value;}}};
 runInNewContext(themeBootstrap,{document:{documentElement:root},localStorage:{getItem:()=>stored},matchMedia:()=>({matches:system})});
 assert.equal(root.dataset.luma,expected);
 assert.ok(root.style['--luma-accent']);
 if(accent)assert.equal(root.style['--luma-accent'],accent);
 assert.ok(root.style['--luma-on-accent']);
}
console.log('Theme before paint: saved, system, legacy and corrupt preferences passed.');
