import {readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {Pool} from 'pg';
import {drizzle as liteDrizzle} from 'drizzle-orm/pglite';
import {drizzle as pgDrizzle} from 'drizzle-orm/node-postgres';
import * as schema from './auth-schema';
export type Row=Record<string,any>;
export interface Queryable{query:(sql:string,args?:any[])=>Promise<{rows:Row[]}>}
export interface Database extends Queryable{orm:ReturnType<typeof liteDrizzle>|ReturnType<typeof pgDrizzle>;transaction:<T>(fn:(q:Queryable)=>Promise<T>)=>Promise<T>}
const globals=globalThis as typeof globalThis & {studioDb?:Promise<Database>};
export function getDb(){return globals.studioDb??=open()}
async function open():Promise<Database>{
 const sql=await readFile(path.join(process.cwd(),'lib/server/schema.sql'),'utf8');
 if(process.env.DATABASE_URL){const pool=new Pool({connectionString:process.env.DATABASE_URL,max:5});
  if(process.env.DB_AUTO_MIGRATE==='true')await pool.query(sql);
  return {orm:pgDrizzle(pool,{schema}),query:async(s,a)=>pool.query(s,a),transaction:async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const result=await fn(c);await c.query('COMMIT');return result}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}}};}
 if(process.env.APP_MODE!=='local')throw new Error('DATABASE_URL is required outside local mode');
 const dir=process.env.LOCAL_DATA_DIR||path.join(process.cwd(),'.data');await mkdir(dir,{recursive:true});
 const p=new PGlite(path.join(dir,'postgres'));await p.exec(sql);
 return {orm:liteDrizzle(p,{schema}),query:async(s,a)=>p.query(s,a),transaction:fn=>p.transaction(tx=>fn({query:async(s,a)=>tx.query(s,a)}))};
}
export async function rows(sql:string,args:any[]=[]){return (await (await getDb()).query(sql,args)).rows}
