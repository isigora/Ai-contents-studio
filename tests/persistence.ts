import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {execFile} from 'node:child_process';import {promisify} from 'node:util';
import {PGlite} from '@electric-sql/pglite';
const exec=promisify(execFile),base=await mkdtemp(path.join(os.tmpdir(),'studio-backup-')),original=path.join(base,'original'),backup=path.join(base,'backup'),restore=path.join(base,'restore');
await mkdir(original);const schema=await readFile('lib/server/schema.sql','utf8'),p0=schema.split('-- P1 is additive:')[0];
let db=new PGlite(path.join(original,'postgres'));await db.exec(p0);
await db.query("INSERT INTO workspace(id,name) VALUES('w','복원 회사')");await db.query("INSERT INTO company(workspace_id,data) VALUES('w','{\"name\":\"복원 회사\",\"price\":\"30,000\"}')");
await db.exec(schema);await db.exec(schema);assert.equal((await db.query<{name:string}>("SELECT name FROM workspace WHERE id='w'")).rows[0].name,'복원 회사');await db.close();
await mkdir(path.join(original,'objects/w'),{recursive:true});await writeFile(path.join(original,'objects/w/asset'),'복원 자산');
await exec(process.execPath,['scripts/backup-local.mjs',backup],{env:{...process.env,LOCAL_DATA_DIR:original}});
await exec(process.execPath,['scripts/restore-local.mjs',backup,restore]);
// A fresh process reads the restored database and file; no in-memory state can satisfy this assertion.
const probe=path.join(base,'probe.mjs');await writeFile(probe,`import {PGlite} from ${JSON.stringify(path.resolve('node_modules/@electric-sql/pglite/dist/index.js'))};import fs from 'node:fs/promises';const d=new PGlite(${JSON.stringify(path.join(restore,'postgres'))});const r=(await d.query("SELECT data FROM company WHERE workspace_id='w'")).rows[0];if(r.data.price!=='30,000')throw new Error('DB mismatch');if(await fs.readFile(${JSON.stringify(path.join(restore,'objects/w/asset'))},'utf8')!=='복원 자산')throw new Error('Asset mismatch');await d.close();`);await exec(process.execPath,[probe]);
await assert.rejects(()=>exec(process.execPath,['scripts/restore-local.mjs',backup,restore]));
await writeFile('docs/persistence-results.json',JSON.stringify({date:new Date().toISOString(),tests:['P0 schema → P1 additive migration twice preserves data','Backup and restore DB plus object files','Restored data read in a fresh process','Nonempty restore target rejected'],status:'PASS'},null,2)+'\n');
console.log('4 migration / backup / restore checks passed');
