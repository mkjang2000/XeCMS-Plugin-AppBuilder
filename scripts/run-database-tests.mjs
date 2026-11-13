import {pnpm,run} from './process.mjs';
const url=process.env.XECMS_TEST_DATABASE_URL;if(!url)throw new Error('Set XECMS_TEST_DATABASE_URL to an isolated test database.');
await run(pnpm,['exec','vitest','run','--no-file-parallelism','packages/server'],{env:{...process.env,XECMS_RUN_POSTGRES_TESTS:'true',XECMS_TEST_DATABASE_URL:url}});
