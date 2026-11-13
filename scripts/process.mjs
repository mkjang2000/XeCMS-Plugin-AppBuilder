import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../',import.meta.url));
export const pnpm=process.platform==='win32'?'pnpm.cmd':'pnpm';
export function run(command,args,{cwd=root,env=process.env,capture=false}={}){
 return new Promise((resolve,reject)=>{const child=spawn(command,args,{cwd,env,stdio:capture?['ignore','pipe','inherit']:'inherit'});let output='';if(capture)child.stdout.on('data',chunk=>{output+=chunk;});child.once('error',reject);child.once('exit',(code,signal)=>code===0?resolve(output):reject(new Error(`${command} ${args.join(' ')} failed (${signal??code}).`)));});
}
