import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {QuickStart} from '../components/quick-start';
import {UiLanguageProvider} from '../components/ui-language';
Object.assign(process.env,{APP_MODE:'local',NODE_ENV:'development',CODESPACES:'true',CODESPACE_NAME:'quick-test'});
const publicOrigin='https://quick-test-4173.app.github.dev',proxy='https://localhost:4173';
process.env.APP_URL=publicOrigin;process.env.TRUSTED_ORIGINS=publicOrigin+',http://localhost:4173';
process.env.BETTER_AUTH_SECRET=randomBytes(32).toString('hex');process.env.AI_ENABLED='false';
process.env.LOCAL_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'studio-intake-'));
delete process.env.DATABASE_URL;delete process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const {getAuth}=await import('../lib/server/auth');const {handle}=await import('../lib/server/service');const {getDb}=await import('../lib/server/db');
const auth=await getAuth();Object.assign(auth.options,{rateLimit:{enabled:false}});
const results:{name:string,status:string}[]=[];
async function test(name:string,fn:()=>Promise<void>){await fn();results.push({name,status:'PASS'});console.log('PASS',name);}
async function user(email:string){const r=await auth.handler(new Request(publicOrigin+'/api/auth/sign-up/email',{method:'POST',headers:{origin:publicOrigin,'content-type':'application/json'},body:JSON.stringify({email,password:randomBytes(32).toString('base64url'),name:'Temporary intake tester'})}));assert.equal(r.status,200);const data=await r.json() as {user:{id:string}};return {cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; '),id:data.user.id};}
async function call(cookie:string,url:string,method='GET',body?:unknown,key?:string,origin=proxy,site='same-origin'){
  const r=await handle(new Request(proxy+'/api/'+url,{method,headers:{cookie,origin,'sec-fetch-site':site,'content-type':'application/json',...(key?{'idempotency-key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)}));
  const text=await r.text();let data:any;try{data=JSON.parse(text);}catch{data=text;}return {status:r.status,data};
}
const A=await user('quick-a@example.test'),B=await user('quick-b@example.test');
const workspace=await call(A.cookie,'workspaces','POST',{name:'Isolated intake workspace'});assert.equal(workspace.status,201);const wid=workspace.data.id;
const payload={name:'연변 공원골프 체험',summary:'장비 대여와 기본 규칙 안내',audience:'가족 입문자',cta:'체험 일정 문의하기',kind:'service',confirmed:true};
const key=randomUUID();let saved:any,content:any;
await test('Confirmed minimum inputs save linked audience and offering through proxy origin',async()=>{
  const r=await call(A.cookie,`workspaces/${wid}/intake`,'POST',payload,key);assert.equal(r.status,201);saved=r.data;
  const o=await call(A.cookie,`workspaces/${wid}/offerings/${saved.offering_id}`);
  assert.equal(o.data.audience_id,saved.audience_id);assert.equal(o.data.data.summary,payload.summary);
  assert.equal(o.data.data.price,'');assert.deepEqual(o.data.data.proofs,[]);
  assert.equal((await call(A.cookie,`workspaces/${wid}`)).data.revision,3);
});
await test('Same-key retries and concurrent retries create no duplicate facts or revisions',async()=>{
  const retries=await Promise.all([call(A.cookie,`workspaces/${wid}/intake`,'POST',payload,key),call(A.cookie,`workspaces/${wid}/intake`,'POST',payload,key)]);
  for(const r of retries){assert.equal(r.status,200);assert.equal(r.data.offering_id,saved.offering_id);assert(r.data.replayed);}
  assert.equal((await call(A.cookie,`workspaces/${wid}/offerings`)).data.length,1);
  assert.equal((await call(A.cookie,`workspaces/${wid}/audiences`)).data.length,1);
  assert.equal((await call(A.cookie,`workspaces/${wid}`)).data.revision,3);
});
await test('Changed input with a reused request key is rejected',async()=>{
  assert.equal((await call(A.cookie,`workspaces/${wid}/intake`,'POST',{...payload,summary:'Changed'},key)).status,409);
});
await test('Incomplete, unconfirmed, oversized and unkeyed requests leave existing data intact',async()=>{
  for(const body of [{...payload,confirmed:false},{...payload,summary:''},{...payload,audience:'a'.repeat(161)},{...payload,summary:'a'.repeat(4001)}])assert.equal((await call(A.cookie,`workspaces/${wid}/intake`,'POST',body,randomUUID())).status,400);
  assert.equal((await call(A.cookie,`workspaces/${wid}/intake`,'POST',payload)).status,400);
  assert.equal((await call(A.cookie,`workspaces/${wid}/offerings`)).data.length,1);
});
await test('Atomic rollback leaves no orphan audience or revision after offering insert fails',async()=>{
  const db=await getDb();
  await db.query("CREATE FUNCTION fail_intake_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.data->>'name'='Forced intake failure' THEN RAISE EXCEPTION 'Test failure'; END IF; RETURN NEW; END; $$");
  await db.query('CREATE TRIGGER fail_intake_test BEFORE INSERT ON offering FOR EACH ROW EXECUTE FUNCTION fail_intake_test()');
  const r=await call(A.cookie,`workspaces/${wid}/intake`,'POST',{...payload,name:'Forced intake failure'},randomUUID());assert.equal(r.status,500);
  assert.equal((await call(A.cookie,`workspaces/${wid}/audiences`)).data.length,1);
  assert.equal((await call(A.cookie,`workspaces/${wid}`)).data.revision,3);
  await db.query('DROP TRIGGER fail_intake_test ON offering');await db.query('DROP FUNCTION fail_intake_test()');
});
await test('Anonymous, foreign-workspace and viewer writes are denied',async()=>{
  assert.equal((await call('',`workspaces/${wid}/intake`,'POST',payload,randomUUID())).status,401);
  assert.equal((await call(B.cookie,`workspaces/${wid}/intake`,'POST',payload,randomUUID())).status,404);
  const db=await getDb();await db.query("INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,'viewer')",[wid,B.id]);
  assert.equal((await call(B.cookie,`workspaces/${wid}/intake`,'POST',payload,randomUUID())).status,403);
});
await test('Foreign origin, wrong port and null cross-site mutations remain denied',async()=>{
  for(const origin of ['https://foreign.invalid','https://localhost:9999'])assert.equal((await call(A.cookie,'workspaces','POST',{name:'Denied'},undefined,origin)).status,403);
  assert.equal((await call(A.cookie,'workspaces','POST',{name:'Denied'},undefined,'null','cross-site')).status,403);
  assert.equal((await call(A.cookie,`workspaces/${wid}/intake`,'POST',payload,key,'null')).status,200);
});
await test('Quick registered facts generate and persist an X text draft without publishing',async()=>{
  const settings={offering_id:saved.offering_id,audience_id:saved.audience_id,objective:'문의',format:'social',channel:'x',language:'ko',tone:'concise',length:'short',cta:'',source_revision:3};
  const r=await call(A.cookie,`workspaces/${wid}/generations`,'POST',settings,randomUUID());assert.equal(r.status,201);content=r.data;
  assert.equal(content.settings.channel,'x');assert.equal(content.latest.annotations.mode,'기본 문안');
  assert(content.latest.body.includes(payload.name));assert(content.latest.body.includes(payload.cta));assert(!content.latest.body.includes('50%'));
  assert(content.latest.annotations.missing_facts.some((s:string)=>s.includes('자동 게시')));
  assert.equal((await call(A.cookie,`workspaces/${wid}/generations`,'POST',{...settings,format:'page'},randomUUID())).status,400);
});
await test('Editing creates a version and export preserves the saved text',async()=>{
  const body=content.latest.body+'\n직접 확인한 초안';
  const r=await call(A.cookie,`workspaces/${wid}/contents/${content.id}`,'PUT',{title:payload.name,body,version:1,status:'reviewed'});assert.equal(r.status,200);
  assert.equal(r.data.current_version,2);assert.equal(r.data.versions[1].body,content.latest.body);
  assert.equal((await call(A.cookie,`workspaces/${wid}/contents/${content.id}/export`)).data,body);
});
await test('Actual quick entry form renders in three languages with required fields and confirmation',async()=>{
  for(const locale of ['ko','zh','en'] as const){
    const html=renderToStaticMarkup(<UiLanguageProvider initialLocale={locale}><QuickStart disabled={false} onCreate={async()=>{}}/></UiLanguageProvider>);
    assert(html.includes(locale==='ko'?'간편 등록으로 시작하기':locale==='zh'?'快速登记，立即开始':'Start with quick registration'));
    assert(html.includes('type="checkbox"'));assert(html.includes('maxLength="4000"'));assert(html.includes('disabled=""'));
    assert(!html.includes('undefined'));
  }
});
await writeFile('docs/quick-start-results.json',JSON.stringify({date:new Date().toISOString(),baseline:'6584e3ffdf096251218da55e6f7f225c39aa47c9',environment:'isolated Work PGlite, random disposable users',tests:results,notRun:['Actual browser clicks/mobile','Live X OAuth or posting','Paid AI calls']},null,2)+'\n');
console.log(`${results.length} quick-start integration scenarios PASS`);process.exit(0);
