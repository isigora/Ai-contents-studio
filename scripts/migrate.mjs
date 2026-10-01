import fs from 'node:fs/promises';import {Pool} from 'pg';
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL required');
const pool=new Pool({connectionString:process.env.DATABASE_URL});
try{await pool.query(await fs.readFile(new URL('../lib/server/schema.sql',import.meta.url),'utf8'));console.log('Schema installed.')}finally{await pool.end()}
