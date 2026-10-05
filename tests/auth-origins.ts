import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {authOrigins,requestOriginAllowed} from '../lib/server/auth-origins';
const publicOrigin = 'https://origin-test-4173.app.github.dev';
const env:NodeJS.ProcessEnv = {CODESPACES:'true',CODESPACE_NAME:'origin-test',APP_MODE:'local',NODE_ENV:'development',APP_URL:publicOrigin,TRUSTED_ORIGINS:publicOrigin+',http://localhost:4173'};
const alias = 'https://localhost:4173';
assert(authOrigins(env).includes(alias));
for (const override of [{CODESPACES:'false'},{APP_MODE:'production'},{NODE_ENV:'production'},{DATABASE_URL:'postgres://test.invalid/db'},{APP_URL:'https://other.invalid'},{CODESPACE_NAME:'bad/name'}]) {
  assert(!authOrigins({...env,...override}).includes(alias));
}
assert.deepEqual(authOrigins({TRUSTED_ORIGINS:' https://one.invalid, ,https://one.invalid '}),['https://one.invalid']);
const inferredRequest=new Request(alias+'/api/workspaces',{method:'POST',headers:{origin:'null','sec-fetch-site':'same-origin'}});
assert(requestOriginAllowed(inferredRequest,env));
assert(!requestOriginAllowed(inferredRequest,{...env,NODE_ENV:'production',TRUSTED_ORIGINS:alias}));
Object.assign(process.env,env);
delete process.env.DATABASE_URL;
delete process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
process.env.LOCAL_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'studio-origin-'));
process.env.BETTER_AUTH_SECRET=randomBytes(32).toString('hex');
const {getAuth}=await import('../lib/server/auth');
const auth=await getAuth();
// Isolate origin validation from Better Auth's per-endpoint login throttling.
Object.assign(auth.options,{rateLimit:{enabled:false}});
const email='origin-check@example.test';
const password=randomBytes(32).toString('base64url');
const signup=await auth.handler(new Request(publicOrigin+'/api/auth/sign-up/email',{
  method:'POST',headers:{origin:publicOrigin,'content-type':'application/json'},
  body:JSON.stringify({email,password,name:'Isolated origin test'}),
}));
assert.equal(signup.status,200);
const cookie=signup.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ');
assert(cookie);
async function login(origin:string,site='same-origin') {
  return auth.handler(new Request(alias+'/api/auth/sign-in/email',{
    method:'POST',headers:{origin,cookie,'content-type':'application/json','sec-fetch-site':site},
    body:JSON.stringify({email,password}),
  }));
}
assert.equal((await login(alias)).status,200);
assert.equal((await login('null')).status,200);
assert.equal((await login(publicOrigin)).status,200);
assert.equal((await login('https://untrusted.invalid','cross-site')).status,403);
assert.equal((await login('https://localhost:9999')).status,403);
assert.equal((await login('null','cross-site')).status,403);
console.log('Auth origin tests PASS: development guards, proxy password login, null/same-origin inference, foreign-origin rejection. Credentials are random and isolated.');
process.exit(0);
