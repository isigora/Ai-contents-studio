import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
if (process.env.CODESPACES !== 'true' || process.env.APP_MODE !== 'local' || process.env.DATABASE_URL || process.env.NODE_ENV === 'production') throw new Error('Codespaces local development only');
const origin = process.env.APP_URL;
if (!origin || new URL(origin).hostname !== process.env.CODESPACE_NAME+'-4173.'+(process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev')) throw new Error('Unexpected development origin');
const file = '.data/dev-test-login.json';
fs.mkdirSync('.data', {recursive:true});
let credentials;
if (fs.existsSync(file)) credentials = JSON.parse(fs.readFileSync(file,'utf8'));
else {
 credentials = {email:'review-owner@example.test',password:crypto.randomBytes(32).toString('base64url'),name:'Development Review Owner'};
 fs.writeFileSync(file,JSON.stringify(credentials,null,2),{mode:0o600,flag:'wx'});
}
fs.chmodSync(file,0o600);
let cookie = '';
async function request(path, method='GET', body) {
 const response = await fetch('http://localhost:4173'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const data = await response.json();
 if (!response.ok) throw new Error(path+': HTTP '+response.status+' '+(data.code || data.error?.code || 'request failed'));
 const cookies = response.headers.getSetCookie();
 if (cookies.length) cookie = cookies.map(c=>c.split(';')[0]).join('; ');
 return data;
}
try { await request('/api/auth/sign-in/email','POST',credentials); }
catch(error) {
 if (!error.message.includes('HTTP 401')) throw error;
 await request('/api/auth/sign-up/email','POST',credentials);
}
cookie='';
const signed = await request('/api/auth/sign-in/email','POST',credentials);
assert.equal(signed.user.email,credentials.email);
const me = await request('/api/me');
let workspace = me.workspaces.find(w=>w.name==='Development Review');
if (!workspace) workspace = await request('/api/workspaces','POST',{name:'Development Review',locale:'ko'});
const accessed = await request('/api/workspaces/'+workspace.id);
assert.equal(accessed.role,'owner');
console.log(JSON.stringify({email:credentials.email,emailVerified:signed.user.emailVerified,role:accessed.role,workspace:accessed.name,checks:['password sign-in','session /api/me','workspace access'],credentialFile:file,passwordPrinted:false},null,2));
