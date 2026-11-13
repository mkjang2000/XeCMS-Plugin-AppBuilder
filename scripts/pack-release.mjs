import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {access,cp,mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {basename,join,resolve} from 'node:path';
import {root,run} from './process.mjs';
const args=process.argv.slice(2).filter(value=>value!=='--');
if(args.length!==2||args[0]!=='--output')throw new Error('Usage: pnpm release:pack --output <empty-directory>');
const output=resolve(args[1]);await mkdir(output,{recursive:true});assert.equal((await readdir(output)).length,0,'Output directory must be empty.');
const staging=await mkdtemp(join(tmpdir(),'xecms-builder-pack-'));
const entries=await Promise.all(['model','client','runtime','admin','server'].map(async name=>({name,manifest:JSON.parse(await readFile(join(root,'packages',name,'package.json'),'utf8'))})));
const versions=Object.fromEntries(entries.map(({manifest})=>[manifest.name,manifest.version]));
const artifacts=[];
try{
 for(const{name,manifest}of entries){
  const directory=join(staging,name);
  await cp(join(root,'packages',name),directory,{recursive:true,filter:path=>!['node_modules','dist-types'].includes(basename(path))});
  // Pack outside this workspace: the local pnpm bootstrap hook cannot rewrite
  // published dependency versions into file: paths.
  for(const section of ['dependencies','devDependencies','optionalDependencies','peerDependencies'])for(const[dependency,version]of Object.entries(manifest[section]??{})){
   if(version.startsWith('workspace:')){assert.ok(versions[dependency],dependency);manifest[section][dependency]=versions[dependency];}
   assert.ok(!/^(file:|link:|workspace:)/.test(manifest[section][dependency]),`Local dependency: ${dependency}`);
  }
  for(const notice of ['LICENSE','THIRD_PARTY_NOTICES.md'])await cp(join(root,notice),join(directory,notice));
  manifest.files=[...new Set([...manifest.files,'LICENSE','THIRD_PARTY_NOTICES.md'])];
  await writeFile(join(directory,'package.json'),JSON.stringify(manifest,null,2)+'\n');
  for(const entry of strings(manifest.exports))await access(join(directory,entry));
  await access(join(directory,'dist',name==='admin'?'index.html':name==='runtime'?'index.js':'index.js'));
  const packed=JSON.parse(await run(process.platform==='win32'?'npm.cmd':'npm',['pack','--ignore-scripts','--json','--pack-destination',output],{cwd:directory,capture:true}))[0];
  for(const file of packed.files)assert.ok(!/(\.pnpmfile|\.engine-|node_modules|\.tsbuildinfo|\.(?:test|spec)\.|(?:^|\/)(?:[^\/]*-)?test-(?:support|fixtures?)(?:[.\/_-]|$))/.test(file.path),`Internal packed file: ${file.path}`);
  const bytes=await readFile(join(output,packed.filename));artifacts.push({name:manifest.name,version:manifest.version,filename:packed.filename,sha512:createHash('sha512').update(bytes).digest('hex'),dependencies:manifest.dependencies??{}});
  console.log(`Prepared ${packed.filename}`);
 }
 await writeFile(join(output,'release-manifest.json'),JSON.stringify({engineVersion:'0.6.0',status:'prepared-not-published',packages:artifacts},null,2)+'\n');
}finally{await rm(staging,{recursive:true,force:true});}
function strings(value){return typeof value==='string'?[value]:value&&typeof value==='object'?Object.values(value).flatMap(strings):[];}
