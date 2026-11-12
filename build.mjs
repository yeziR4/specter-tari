import {mkdir,copyFile,cp,readFile} from 'node:fs/promises';
await mkdir('dist/lib',{recursive:true});
for(const name of ['analyze','json','compare','wallet','reference-policy','experiment','receipt'])await copyFile(`src/${name}.mjs`,`dist/lib/${name}.mjs`);
for(const name of ['capture-fee','capture-stealth','mainnet-publish','specter-mainnet-deployment','mainnet-receipt','sapient-mainnet-receipt'])await cp(`evidence/${name}`,`dist/evidence/${name}`,{recursive:true});
console.log('Static inspector prepared. Original captures included unchanged.');
