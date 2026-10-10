import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {writeFile} from 'node:fs/promises';
import {z} from 'zod';
import {requestAi} from '../lib/server/ai-provider';
import {safeAiCode,aiFailureMessage} from '../lib/server/ai-failure';
Object.assign(process.env,{AI_ENABLED:'true',AI_PROVIDER_URL:'https://provider.example.test/chat/completions',AI_PROVIDER_ADAPTER:'chat-completions',AI_MODEL:'mock',AI_API_KEY:randomBytes(32).toString('hex')});
const original=globalThis.fetch,results:{name:string,status:string}[]=[];
async function test(name:string,response:()=>Promise<Response>,expected:string){globalThis.fetch=async()=>response();await assert.rejects(()=>requestAi('test','Return JSON.',{source:'Temporary test data'}),e=>e instanceof Error&&e.message===expected);results.push({name,status:'PASS'});console.log('PASS',name);}
try{
 for(const [status,code] of [[401,'AI_AUTH_FAILED'],[403,'AI_PERMISSION_DENIED'],[400,'AI_REQUEST_INVALID'],[404,'AI_MODEL_UNAVAILABLE'],[429,'AI_RATE_LIMIT'],[500,'AI_PROVIDER_FAILED']] as const)await test('HTTP '+status+' classified without raw errors',async()=>Response.json({error:{message:'private upstream data'}},{status}),code);
 await test('Billing quota is distinct from rate limit',async()=>Response.json({error:{code:'insufficient_quota',message:'private billing data'}},{status:429}),'AI_BILLING_QUOTA');
 await test('Oversized error cannot leak or replace HTTP classification',async()=>new Response('x'.repeat(100001),{status:401}),'AI_AUTH_FAILED');
 await test('Output truncation is distinct from malformed JSON',async()=>Response.json({choices:[{finish_reason:'length',message:{content:'{}'}}]}),'AI_OUTPUT_TRUNCATED');
 await test('Refusal is distinct from invalid output',async()=>Response.json({choices:[{finish_reason:'stop',message:{refusal:'private refusal'}}]}),'AI_REFUSAL');
 await test('Timeout classified without its error details',async()=>{throw new DOMException('private timeout detail','TimeoutError');},'AI_TIMEOUT');
 await test('Network errors sanitized',async()=>{throw new Error('private-key-content');},'AI_REQUEST_FAILED');
 assert.equal(safeAiCode(new Error('customer upload text or token')),'GENERATION_FAILED');
 let validation;try{z.string().parse(3);}catch(e){validation=e;}assert.equal(safeAiCode(validation),'AI_OUTPUT_INVALID');
 assert(!aiFailureMessage('customer-secret').includes('customer-secret'));
 results.push({name:'Unknown and schema errors sanitized',status:'PASS'});
 await writeFile('docs/ai-failures-results.json',JSON.stringify({date:new Date().toISOString(),baseline:'60eb840892c17d4e5fe959a30895fd6c0b70ef0d',environment:'isolated mocked provider; no network or fees',tests:results},null,2)+'\n');
 console.log(`${results.length} AI failure classification checks PASS`);
}finally{globalThis.fetch=original;}
