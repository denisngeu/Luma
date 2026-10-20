const {readFileSync}=require('node:fs');
const {runInNewContext}=require('node:vm');
const path=require('node:path');

// Use the stylesheet order emitted by the production build, not a hand-built
// approximation that could hide a CSS chunk-order regression.
module.exports=function compiledStyles(route='fil'){
 const context={};runInNewContext(readFileSync(`.next/server/app/${route}/page_client-reference-manifest.js`,'utf8'),context);
 const entries=Object.entries(context.__RSC_MANIFEST[`/${route}/page`].entryCSSFiles).filter(([key])=>['/app/layout',`/app/${route}/page`].some(suffix=>key.replaceAll('\\','/').endsWith(suffix)));
 const files=[...new Set(entries.flatMap(([,styles])=>styles.map(style=>style.path)))];
 if(!files.length)throw Error('Run the production build before browser layout tests.');
 // Fixtures serve their own tiny HTTP app. Embed production font bytes so an
 // icon-font failure cannot silently turn layout tests into tests of words.
 return files.map(file=>readFileSync(path.join('.next',file),'utf8')).join('\n').replace(/url\(["']?\/fonts\/([a-z0-9-]+\.woff2)["']?\)/g,(_url,file)=>'url(data:font/woff2;base64,'+readFileSync(path.join('public/fonts',file)).toString('base64')+')');
};
