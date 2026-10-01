import {betterAuth} from 'better-auth';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {getDb} from './db';
import * as schema from './auth-schema';
const g=globalThis as typeof globalThis & {studioAuth?:ReturnType<typeof createAuth>};
export function getAuth(){return g.studioAuth??=createAuth()}
async function createAuth(){
 const secret=process.env.BETTER_AUTH_SECRET;if(!secret||secret.length<32)throw new Error('Set a random BETTER_AUTH_SECRET of at least 32 characters');
 const db=await getDb();return betterAuth({appName:'Content Studio',secret,baseURL:process.env.APP_URL||'http://localhost:4173',database:drizzleAdapter(db.orm,{provider:'pg',schema}),emailAndPassword:{enabled:true,minPasswordLength:10},session:{expiresIn:60*60*24*7},rateLimit:{enabled:true,window:60,max:30},trustedOrigins:(process.env.TRUSTED_ORIGINS||process.env.APP_URL||'http://localhost:4173').split(','),advanced:{useSecureCookies:(process.env.APP_URL||'').startsWith('https://')||process.env.APP_MODE!=='local'}});
 }
