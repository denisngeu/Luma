import {mkdir,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const mark=await readFile(new URL('../public/luma-mark.svg',import.meta.url));
const foreground=await readFile(new URL('../public/luma-foreground.svg',import.meta.url));
await Promise.all([mkdir(new URL('../native/mobile/assets/',import.meta.url),{recursive:true}),mkdir(new URL('../native/desktop/build/',import.meta.url),{recursive:true})]);
const render=(source,size,target,options={})=>sharp(source).resize(size,size,{fit:'contain',...options}).png().toFile(fileURLToPath(new URL(target,import.meta.url)));
await Promise.all([
 render(mark,192,'../public/icon-192.png'),
 render(mark,512,'../public/icon-512.png'),
 render(mark,512,'../public/icon-maskable-512.png'),
 render(mark,180,'../public/apple-touch-icon.png'),
 render(mark,1024,'../native/mobile/assets/icon.png'),
 render(foreground,700,'../native/mobile/assets/adaptive-icon.png',{background:{r:0,g:0,b:0,alpha:0}}),
 render(mark,512,'../native/mobile/assets/splash-icon.png'),
 render(mark,512,'../native/desktop/build/icon.png'),
]);
console.log('Icônes Luma générées.');
