import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import path from 'node:path';
const source=process.argv[2],target=process.argv[3];
if(!source||!target||!path.isAbsolute(source)||!path.isAbsolute(target))throw new Error('Usage: node scripts/restore-local.mjs /absolute/backup-directory /absolute/EMPTY-target-directory');
if(path.resolve(source)===path.resolve(target))throw new Error('Backup and restore directories must differ');
try{const entries=await fs.readdir(target);if(entries.length)throw new Error('Restore target must be empty. Existing data is never overwritten.')}catch(e){if(e.code!=='ENOENT')throw e}
const archive=await fs.readFile(path.join(source,'postgres.tar.gz'));
await fs.mkdir(target,{recursive:true,mode:0o700});
const pg=new PGlite({dataDir:path.join(target,'postgres'),loadDataDir:new Blob([archive])});
try{await pg.waitReady;await fs.cp(path.join(source,'objects'),path.join(target,'objects'),{recursive:true}).catch(e=>{if(e.code!=='ENOENT')throw e});console.log('Restore completed. Point LOCAL_DATA_DIR at the restored directory after stopping the app.')}finally{await pg.close()}
