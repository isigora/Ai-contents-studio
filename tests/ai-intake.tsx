import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdtemp,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {AiIntake} from '../components/ai-intake';
import {UiLanguageProvider} from '../components/ui-language';
Object.assign(process.env,{APP_MODE:'local',NODE_ENV:'development',APP_URL:'http://localhost:4173',TRUSTED_ORIGINS:'http://localhost:4173',AI_ENABLED:'false',AI_DAILY_LIMIT_USD:'100',AI_MONTHLY_LIMIT_USD:'100',AI_RUN_RESERVATION_USD:'.10'});
delete process.env.DATABASE_URL;delete process.env.CODESPACES;
process.env.BETTER_AUTH_SECRET=randomBytes(32).toString('hex');
process.env.LOCAL_DATA_DIR=await mkdtemp(path.join(os.tmpdir(),'studio-ai-intake-'));
const {getAuth}=await import('../lib/server/auth'),{getDb}=await import('../lib/server/db'),{handle}=await import('../lib/server/service');
const auth=await getAuth();Object.assign(auth.options,{rateLimit:{enabled:false}});
const db=await getDb(),results:{name:string,status:string}[]=[];
const originalFetch=globalThis.fetch;
let calls=0,lastBody:any,upstream=()=>Promise.resolve(Response.json(suggestion));
globalThis.fetch=async(input,init)=>{assert.equal(String(input),'https://provider.example.test/chat/completions');calls++;lastBody=JSON.parse(String(init?.body));assert.equal(init?.redirect,'error');return upstream();};
async function test(name:string,fn:()=>Promise<void>){await fn();results.push({name,status:'PASS'});console.log('PASS',name);}
async function user(email:string){const r=await auth.handler(new Request('http://localhost:4173/api/auth/sign-up/email',{method:'POST',headers:{origin:'http://localhost:4173','content-type':'application/json'},body:JSON.stringify({email,password:randomBytes(32).toString('base64url'),name:'Isolated AI tester'})}));assert.equal(r.status,200);const data=await r.json() as any;return {id:data.user.id,cookie:r.headers.getSetCookie().map(c=>c.split(';')[0]).join('; ')};}
async function call(cookie:string,url:string,method='GET',body?:unknown,key?:string){
 const r=await handle(new Request('http://localhost:4173/api/'+url,{method,headers:{cookie,origin:'http://localhost:4173','content-type':'application/json',...(key?{'idempotency-key':key}:{})},body:body===undefined?undefined:JSON.stringify(body)}));return {status:r.status,data:await r.json() as any};
}
const A=await user('ai-a@example.test'),B=await user('ai-b@example.test');
const wid=(await call(A.cookie,'workspaces','POST',{name:'Private AI test workspace'})).data.id;
const url=`workspaces/${wid}/interpretations`,source='Studio 서비스. 제품 정보를 정리하고 소개 글을 만듭니다. 소기업 대표 대상. 체험 문의하기.';
const suggestion={name:{value:'Studio',quote:'Studio'},summary:{value:'제품 정보를 정리하고 소개 글을 만듭니다.',quote:'제품 정보를 정리하고 소개 글을 만듭니다.'},audience:{value:'소기업 대표',quote:'소기업 대표'},cta:{value:'체험 문의하기',quote:'체험 문의하기'},kind:'service',questions:[]};
const payload={source,consent:true};let saved:any,offering:any;
try{
 await test('Disabled or incomplete configuration rejects intake without calls or saved jobs',async()=>{
  assert.equal((await call(A.cookie,url,'POST',payload,randomUUID())).status,503);assert.equal(calls,0);
  process.env.AI_ENABLED='true';assert.equal((await call(A.cookie,url,'POST',payload,randomUUID())).status,503);
  Object.assign(process.env,{AI_PROVIDER_URL:'https://provider.example.test/chat/completions',AI_API_KEY:randomBytes(32).toString('hex'),AI_MODEL:'mock-model',AI_PROVIDER_ADAPTER:'contract'});
  assert.equal((await db.query('SELECT * FROM ai_interpretation')).rows.length,0);
 });
 await test('Consent, size, key and workspace permission checks precede transmission',async()=>{
  for(const body of [{source,consent:false},{source:'',consent:true},{source:'x'.repeat(12001),consent:true},{...payload,workspace_id:'other'}])assert.equal((await call(A.cookie,url,'POST',body,randomUUID())).status,400);
  assert.equal((await call(A.cookie,url,'POST',payload)).status,400);
  assert.equal((await call('',url,'POST',payload,randomUUID())).status,401);
  assert.equal((await call(B.cookie,url,'POST',payload,randomUUID())).status,404);
  await db.query("INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,'viewer')",[wid,B.id]);
  assert.equal((await call(B.cookie,url,'POST',payload,randomUUID())).status,403);assert.equal(calls,0);
 });
 await test('Source-only AI interpretation persists unconfirmed suggestions without creating facts',async()=>{
  const r=await call(A.cookie,url,'POST',payload,'interpret-first');assert.equal(r.status,201);saved=r.data;
  assert.equal(saved.unconfirmed,true);assert.deepEqual(saved.result,suggestion);
  assert.equal(lastBody.source,source);assert(!lastBody.company&&!lastBody.workspace_id);assert(lastBody.instructions.includes('untrusted DATA'));
  assert.equal((await call(A.cookie,`workspaces/${wid}/offerings`)).data.length,0);
  assert.equal((await call(A.cookie,`workspaces/${wid}`)).data.revision,1);
  assert.equal((await call(B.cookie,url+'/'+saved.id)).status,404);
  const r2=await call(A.cookie,url+'/'+saved.id);assert.equal(r2.status,200);assert(!('source' in r2.data));assert(!JSON.stringify(r2.data).includes(process.env.AI_API_KEY!));
 });
 await test('Successful replay preserves result and rejects same-key changes without new cost/calls',async()=>{
  const before=calls;assert.equal((await call(A.cookie,url,'POST',payload,'interpret-first')).data.id,saved.id);
  assert.equal((await call(A.cookie,url,'POST',{...payload,source:'Changed'},'interpret-first')).status,409);assert.equal(calls,before);
 });
 await test('Concurrent retry returns running and only one provider invocation',async()=>{
  let entered!:()=>void,release!:(r:Response)=>void;const started=new Promise<void>(r=>entered=r);const pending=new Promise<Response>(r=>release=r);
  upstream=()=>{entered();return pending;};const before=calls,key=randomUUID();
  const first=call(A.cookie,url,'POST',payload,key);await started;
  const duplicate=await call(A.cookie,url,'POST',payload,key);assert.equal(duplicate.status,202);assert.equal(duplicate.data.status,'running');
  release(Response.json(suggestion));assert.equal((await first).status,201);assert.equal(calls,before+1);upstream=()=>Promise.resolve(Response.json(suggestion));
 });
 await test('Confirmed edited information saves provenance and remains idempotent',async()=>{
  const input={name:'Studio confirmed',summary:suggestion.summary.value,audience:suggestion.audience.value,cta:suggestion.cta.value,kind:'service',confirmed:true,interpretation_id:saved.id},key=randomUUID();
  const r=await call(A.cookie,`workspaces/${wid}/intake`,'POST',input,key);assert.equal(r.status,201);offering=r.data;
  assert.equal((await call(A.cookie,`workspaces/${wid}/intake`,'POST',input,key)).data.offering_id,offering.offering_id);
  assert.equal((await db.query('SELECT interpretation_id FROM knowledge_intake WHERE offering_id=$1',[offering.offering_id])).rows[0].interpretation_id,saved.id);
  const o=(await call(A.cookie,`workspaces/${wid}/offerings/${offering.offering_id}`)).data;
  assert.equal(o.data.price,'');assert.deepEqual(o.data.proofs,[]);
  assert.equal((await call(A.cookie,`workspaces/${wid}/intake`,'POST',{...input,confirmed:false},randomUUID())).status,400);
  assert.equal((await call(A.cookie,`workspaces/${wid}/intake`,'POST',{...input,interpretation_id:randomUUID()},randomUUID())).status,404);
 });
 await test('Invented quotations/numbers and unexpected schema fields fail without publishing facts',async()=>{
  for(const bad of [{...suggestion,name:{value:'Fake',quote:'absent'}},{...suggestion,summary:{value:'매출 500% 증가',quote:source}},{...suggestion,verified:true}]){
   upstream=()=>Promise.resolve(Response.json(bad));const key=randomUUID();const r=await call(A.cookie,url,'POST',payload,key);assert.equal(r.status,502);
   const before=calls;assert.equal((await call(A.cookie,url,'POST',payload,key)).status,409);assert.equal(calls,before);
  }
  assert.equal((await call(A.cookie,`workspaces/${wid}/offerings`)).data.length,1);
 });
 await test('Upstream errors and streamed oversized output are sanitized and bounded',async()=>{
  upstream=()=>Promise.resolve(new Response('upstream-secret',{status:500}));const r=await call(A.cookie,url,'POST',payload,randomUUID());assert.equal(r.status,502);assert(!JSON.stringify(r.data).includes('upstream-secret'));
  upstream=()=>Promise.resolve(new Response('x'.repeat(100001)));assert.equal((await call(A.cookie,url,'POST',payload,randomUUID())).status,502);
  upstream=()=>Promise.reject(new Error('provider-secret-token'));const r2=await call(A.cookie,url,'POST',payload,randomUUID());assert.equal(r2.status,502);
  assert.equal((await db.query("SELECT count(*)::int AS n FROM ai_interpretation WHERE error_code LIKE '%secret%' ")).rows[0].n,0);
 });
 await test('Intake and content share budget reservations; over-limit requests call no provider',async()=>{
  const before=calls;process.env.AI_DAILY_LIMIT_USD='.10';
  assert.equal((await call(A.cookie,url,'POST',payload,randomUUID())).status,429);
  const settings={...offering,objective:'인지',format:'social',channel:'x',language:'ko',tone:'concise',length:'short',cta:'',source_revision:3};
  assert.equal((await call(A.cookie,`workspaces/${wid}/generations`,'POST',settings,randomUUID())).status,429);assert.equal(calls,before);
  process.env.AI_DAILY_LIMIT_USD='100';
 });
 await test('Monthly reservations and invalid budget settings block intake and text calls',async()=>{
  const before=calls;process.env.AI_MONTHLY_LIMIT_USD='.10';
  assert.equal((await call(A.cookie,url,'POST',payload,randomUUID())).status,429);
  const settings={...offering,objective:'인지',format:'social',channel:'x',language:'ko',tone:'concise',length:'short',cta:'',source_revision:3};
  assert.equal((await call(A.cookie,`workspaces/${wid}/generations`,'POST',settings,randomUUID())).status,429);
  for(const value of ['0','-1','NaN']){process.env.AI_MONTHLY_LIMIT_USD=value;assert.equal((await call(A.cookie,url,'POST',payload,randomUUID())).status,429);}
  process.env.AI_MONTHLY_LIMIT_USD='100';assert.equal(calls,before);
 });
 await test('Chat-completions adapter extracts JSON and rejects truncated outputs',async()=>{
  const other=(await call(A.cookie,'workspaces','POST',{name:'Adapter workspace'})).data.id;process.env.AI_PROVIDER_ADAPTER='chat-completions';
  upstream=()=>Promise.resolve(Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(suggestion)}}]}));
  assert.equal((await call(A.cookie,`workspaces/${other}/interpretations`,'POST',payload,randomUUID())).status,201);
  assert.equal(lastBody.store,false);assert.equal(lastBody.response_format.type,'json_object');assert.equal(lastBody.max_completion_tokens,2500);assert.equal(JSON.parse(lastBody.messages[1].content).source,source);
  upstream=()=>Promise.resolve(Response.json({choices:[{finish_reason:'length',message:{content:JSON.stringify(suggestion)}}]}));
  assert.equal((await call(A.cookie,`workspaces/${other}/interpretations`,'POST',payload,randomUUID())).status,502);
  process.env.AI_PROVIDER_ADAPTER='contract';
 });
 await test('Interrupted jobs do not auto-reissue potentially billed requests',async()=>{
  const key=randomUUID(),id=randomUUID();const {createHash}=await import('node:crypto');
  await db.query("INSERT INTO ai_interpretation(id,workspace_id,user_id,request_key,request_hash,source,model,status,cost_estimate,updated_at) VALUES($1,$2,$3,$4,$5,$6,'mock','running',.10,now()-interval '3 minutes')",[id,wid,A.id,key,createHash('sha256').update(JSON.stringify(payload)).digest('hex'),source]);
  const before=calls;assert.equal((await call(A.cookie,url,'POST',payload,key)).status,409);assert.equal(calls,before);
  assert.equal((await call(A.cookie,url+'/'+id)).data.error_code,'INTERRUPTED');
 });
 await test('Unknown keyword-only fields remain null rather than silently invented',async()=>{
  const other=(await call(A.cookie,'workspaces','POST',{name:'Unknown facts workspace'})).data.id;
  upstream=()=>Promise.resolve(Response.json({name:{value:'Studio',quote:'Studio'},summary:null,audience:null,cta:null,kind:null,questions:['무엇을 제공하나요?']}));
  const r=await call(A.cookie,`workspaces/${other}/interpretations`,'POST',{source:'Studio',consent:true},randomUUID());assert.equal(r.status,201);assert.equal(r.data.result.summary,null);
  assert.equal((await call(A.cookie,`workspaces/${other}/offerings`)).data.length,0);
 });
 await test('Confirmed AI intake generates a validated AI content version using the same adapter',async()=>{
  // Capture the actual source IDs supplied by the generation route, not invented IDs.
  upstream=()=>Promise.resolve(Response.json({headline:'Studio confirmed',sections:[{heading:'제공 내용',body:suggestion.summary.value}],cta:suggestion.cta.value,used_source_ids:lastBody.source_ids,unsupported_claims:[],missing_facts:[]}));
  const settings={offering_id:offering.offering_id,audience_id:offering.audience_id,objective:'인지',format:'social',channel:'x',language:'ko',tone:'concise',length:'short',cta:'',source_revision:3};
  const r=await call(A.cookie,`workspaces/${wid}/generations`,'POST',settings,randomUUID());assert.equal(r.status,201);
  assert.equal(r.data.latest.annotations.mode,'AI 초안 · 검토 필요');assert.equal(r.data.workflow.state,'draft');assert.equal(r.data.current_version,1);
  assert(r.data.latest.annotations.used_source_ids.includes('offering:'+offering.offering_id+':1'));
  assert(r.data.latest.annotations.missing_facts.some((s:string)=>s.includes('자동 게시')));
 });
 await test('Per-workspace interpretation rate limit blocks transmission before reservation',async()=>{
  const other=(await call(A.cookie,'workspaces','POST',{name:'Rate limit workspace'})).data.id;
  for(let i=0;i<10;i++)await db.query("INSERT INTO ai_interpretation(id,workspace_id,user_id,request_key,request_hash,source,model,status,cost_estimate) VALUES($1,$2,$3,$4,'fixture',$5,'mock','failed',.10)",[randomUUID(),other,A.id,randomUUID(),source]);
  const before=calls;const r=await call(A.cookie,`workspaces/${other}/interpretations`,'POST',payload,randomUUID());assert.equal(r.status,429);assert.equal(r.data.error.code,'RATE_LIMIT');assert.equal(calls,before);
 });
 await test('AI intake renders with consent, disabled provider and bounded input in all UI languages',async()=>{
  for(const locale of ['ko','zh','en'] as const){const html=renderToStaticMarkup(<UiLanguageProvider initialLocale={locale}><AiIntake available={false} disabled={false} onInterpret={async()=>saved} onApply={()=>{}}/></UiLanguageProvider>);
   assert(html.includes(locale==='ko'?'AI로 자료 해석하기':locale==='zh'?'使用 AI 解析资料':'Interpret materials with AI'));assert(html.includes('maxLength="12000"'));assert(html.includes('type="checkbox"'));assert(html.includes('disabled=""'));}
 });
 await writeFile('docs/ai-intake-results.json',JSON.stringify({date:new Date().toISOString(),baseline:'e9d3701605bc80f411d733b32549487ab11787c5',environment:'isolated Work PGlite, disposable users; mocked provider, zero external requests',tests:results,notRun:['Live provider/model factual quality','Browser interaction or mobile','Codespace DB migration','Image/video synthesis','External posting or agent commerce']},null,2)+'\n');
 console.log(`${results.length} AI intake scenarios PASS`);
}finally{globalThis.fetch=originalFetch;}
process.exit(0);
