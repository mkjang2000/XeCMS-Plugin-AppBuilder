import {mkdtemp,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pnpm,run} from './process.mjs';
const useDocker=!process.env.XECMS_TEST_DATABASE_URL;
const project=`xecms-builder-${process.pid}`;
const databasePort=process.env.XECMS_E2E_POSTGRES_PORT??String(46000+process.pid%1000);
const databaseUrl=process.env.XECMS_TEST_DATABASE_URL??`postgresql://xecms:xecms@127.0.0.1:${databasePort}/xecms_e2e`;
const serverPort=String(34000+process.pid%1000),origin=`http://127.0.0.1:${serverPort}`;
const media=await mkdtemp(join(tmpdir(),'xecms-builder-e2e-'));
const schemas=[];
const env={...process.env,NODE_ENV:'test',DATABASE_URL:databaseUrl,XECMS_TEST_DATABASE_URL:databaseUrl,XECMS_E2E_DATABASE_URL:databaseUrl,XECMS_E2E_POSTGRES_PORT:databasePort,XECMS_SERVER_URL:origin,XECMS_HOST:'127.0.0.1',XECMS_PORT:serverPort,XECMS_ADMIN_ORIGINS:origin,XECMS_CONTENT_ORIGINS:origin,XECMS_SESSION_SECRET:'builder-e2e-only-session-secret-0123456789',XECMS_WORKER_ENABLED:'false',XECMS_E2E_AUTO_BOOTSTRAP:'true',XECMS_E2E_OWNER_PASSWORD:'Admin-test-only-2026!',XECMS_E2E_DISPLAY_MODE:'advanced',XECMS_BUILDER_ORIGIN:'',XECMS_SCHEMA_MODE:'editable',DISABLE_ADMIN_ORIGINS:'false'};
let started=false;
try{
 await run(pnpm,['build'],{env:{...env,NODE_ENV:'production'}});
 if(useDocker){started=true;await run('docker',['compose','--project-name',project,'--profile','e2e','up','--detach','--wait','postgres-e2e'],{env});}
 await run(pnpm,['test:database'],{env});
 for(const suite of ['admin-app-blocks','admin-apps']){
  const schema=`xecms_builder_${suite.replaceAll('-','_')}_${process.pid}_${Date.now()}`;schemas.push(schema);
  const storage=join(media,suite);await mkdir(storage);
  await run(pnpm,['exec','playwright','test',`tests/e2e/${suite}.spec.ts`],{env:{...env,XECMS_DB_SCHEMA:schema,XECMS_MEDIA_STORAGE_ROOT:storage}});
 }
}finally{
 if(!useDocker&&schemas.length){const {PostgresDatabase,quoteIdentifier}=await import('@xecms/database');const database=new PostgresDatabase({connectionString:databaseUrl,schema:schemas[0]});try{for(const schema of schemas)await database.pool.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(schema)} CASCADE`);}finally{await database.close();}}
 if(started)await run('docker',['compose','--project-name',project,'--profile','e2e','down','--volumes','--remove-orphans'],{env});
 await rm(media,{recursive:true,force:true});
}
