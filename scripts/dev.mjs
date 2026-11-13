import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {join} from 'node:path';
import {pnpm,root} from './process.mjs';
const envFile=join(root,process.env.XECMS_ENV_FILE??'.env');if(existsSync(envFile))process.loadEnvFile(envFile);
const port=process.env.XECMS_PORT??'3100',builderPort=process.env.XECMS_BUILDER_PORT??'5174';
const engine=`http://127.0.0.1:${port}`,builder=`http://127.0.0.1:${builderPort}`;
const env={...process.env,NODE_ENV:'development',XECMS_HOST:'127.0.0.1',XECMS_PORT:port,XECMS_BUILDER_HOST:'127.0.0.1',XECMS_BUILDER_PORT:builderPort,XECMS_SERVER_URL:engine,VITE_XECMS_ADMIN_URL:engine,XECMS_BUILDER_ORIGIN:builder,XECMS_ADMIN_ORIGINS:[process.env.XECMS_ADMIN_ORIGINS,engine,builder].filter(Boolean).join(','),XECMS_CONTENT_ORIGINS:[process.env.XECMS_CONTENT_ORIGINS,engine,builder].filter(Boolean).join(',')};
const children=[spawn(process.execPath,['scripts/server.mjs'],{cwd:root,env,stdio:'inherit'}),spawn(pnpm,['--filter','@xecms/app-builder-admin','dev'],{cwd:root,env,stdio:'inherit'})];
let stopping=false;
function stop(signal='SIGTERM'){if(stopping)return;stopping=true;for(const child of children)child.kill(signal);}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop(signal));
for(const child of children){child.on('error',error=>{console.error(error);process.exitCode=1;stop();});child.on('exit',code=>{if(!stopping){process.exitCode=code??1;stop();}});}
await Promise.all(children.map(child=>new Promise(resolve=>child.once('close',resolve))));
