// Public source allowlist: never include Git metadata, credentials or unrelated workspace files.
import {readdir,mkdir,copyFile} from 'node:fs/promises';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const files=[];
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())await walk(p);else files.push(p);}}
for(const dir of ['src','test','fixtures','evidence','contracts'])await walk(dir);
for(const e of await readdir('dist',{withFileTypes:true}))if(e.isFile())files.push(join('dist',e.name));
files.push('LICENSE','README.md','MAINNET-RELEASE.md','package.json','build.mjs','package-source.mjs');
await mkdir('dist/downloads',{recursive:true});
const python='import sys,json,zipfile\npaths=json.load(sys.stdin)\nwith zipfile.ZipFile("dist/downloads/specter-source.zip","w",zipfile.ZIP_DEFLATED) as z:\n for p in paths:z.write(p,p)\n';
const result=spawnSync('python',['-c',python],{input:JSON.stringify(files),encoding:'utf8'});
if(result.status!==0)throw Error(result.stderr||'Source packaging failed');
console.log('Public source archive created from '+files.length+' allowlisted files.');
