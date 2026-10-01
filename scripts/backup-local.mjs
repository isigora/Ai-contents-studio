import {PGlite} from '@electric-sql/pglite';import fs from 'node:fs/promises';import path from 'node:path';
// Stop the app before taking a local backup; never open one PGlite directory twice.
const target=process.argv[2];if(!target)throw new Error('Usage: node scripts/backup-local.mjs /absolute/backup-directory (stop app first)');
await fs.mkdir(target,{recursive:true});const root=process.env.LOCAL_DATA_DIR||'.data';const pg=new PGlite(path.join(root,'postgres'));
try{const dump=await pg.dumpDataDir();await fs.writeFile(path.join(target,'postgres.tar.gz'),new Uint8Array(await dump.arrayBuffer()));await fs.cp(path.join(root,'objects'),path.join(target,'objects'),{recursive:true}).catch(e=>{if(e.code!=='ENOENT')throw e});console.log('Backup completed; treat it as confidential customer data.')}finally{await pg.close()}
