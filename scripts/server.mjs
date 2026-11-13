import {existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {dirname,join} from 'node:path';
import {root} from './process.mjs';
const envFile=join(root,process.env.XECMS_ENV_FILE??'.env');
if(existsSync(envFile))process.loadEnvFile(envFile);
const require=createRequire(import.meta.url);
process.env.XECMS_ADMIN_DIST??=join(dirname(require.resolve('@xecms/admin-app/package.json')),'dist');
const {buildServer,listenServer}=await import('@xecms/server');
const {default:builder}=await import('@xecms/app-builder-server');
const server=await buildServer({extensions:[builder],plugins:[]});
let stopping=false;
async function stop(){if(stopping)return;stopping=true;try{await server.close();}catch(error){console.error(error);process.exitCode=1;}}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>void stop());
try{await listenServer(server);}catch(error){await stop();throw error;}
