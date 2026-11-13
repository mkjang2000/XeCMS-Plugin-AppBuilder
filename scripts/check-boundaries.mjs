import {readdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {root} from './process.mjs';
const manifests=await Promise.all(['model','runtime','client','server','admin'].map(async name=>JSON.parse(await readFile(join(root,'packages',name,'package.json'),'utf8'))));
const local=new Set(manifests.map(value=>value.name));
for(const manifest of [JSON.parse(await readFile(join(root,'package.json'),'utf8')),...manifests]){
 for(const section of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])for(const[name,version]of Object.entries(manifest[section]??{})){
  if(version.startsWith('workspace:')&&!local.has(name))throw new Error(`External workspace dependency: ${name}`);
  if(name.startsWith('@xecms/')&&!local.has(name)&&version!==(['@xecms/plugin-sdk','@xecms/example-plugin'].includes(name)?'2.0.0':'0.6.0'))throw new Error(`Engine dependency must use its exact package version: ${name} ${version}`);
 }
}
async function inspect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){if(['node_modules','dist','dist-types'].includes(entry.name))continue;const path=join(directory,entry.name);if(entry.isDirectory())await inspect(path);else if(/\.(ts|tsx|json)$/.test(path)){const source=await readFile(path,'utf8');if(/\.\.\/\.\.\/\.\.\/(?:packages|apps)|(?:XeCMS\/|\.engine-source\/)(?:packages|apps)/.test(source))throw new Error(`Engine source reference: ${path}`);}}}
await inspect(join(root,'packages'));
console.log('Builder workspace is independent; engine dependencies use public package versions.');
