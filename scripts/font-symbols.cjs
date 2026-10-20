const {readdirSync,readFileSync}=require('node:fs');
const path=require('node:path');
module.exports=function fontSymbols(codepoints){
 const known=new Set(codepoints.trim().split(/\r?\n/).map(line=>line.split(/\s+/)[0])),used=new Set();
 function scan(directory){for(const entry of readdirSync(directory,{withFileTypes:true})){
  const file=path.join(directory,entry.name);if(entry.isDirectory())scan(file);
  else if(/\.[jt]sx?$/.test(entry.name))for(const token of readFileSync(file,'utf8').match(/[a-z0-9_]+/g)||[])if(known.has(token))used.add(token);
 }}
 for(const directory of ['app','components','hooks','lib'])scan(directory);
 return [...used].sort();
};
