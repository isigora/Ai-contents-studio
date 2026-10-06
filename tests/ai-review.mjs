import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {configureReview} from '../scripts/configure-ai-review.mjs';
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ai-review-profile-')),file=path.join(dir,'.env.local');
const secret=crypto.randomBytes(32).toString('hex'),key=crypto.randomBytes(32).toString('hex');
const original=`APP_MODE=local\nAPP_URL=https://review-profile-4173.app.github.dev\nTRUSTED_ORIGINS=https://review-profile-4173.app.github.dev,http://localhost:4173\nBETTER_AUTH_SECRET=${secret}\nAI_ENABLED=false\nLOCAL_DATA_DIR=.data\nCUSTOM_SETTING=preserve-me\n`;
const env={CODESPACES:'true',CODESPACE_NAME:'review-profile',OPENAI_API_KEY:key};let n=0;
function test(name,fn){fn();n++;console.log('PASS',name);}
try{
 fs.writeFileSync(file,original);
 test('Missing private credential causes no mutation',()=>{assert.throws(()=>configureReview(dir,{...env,OPENAI_API_KEY:undefined}),/secret first/);assert.equal(fs.readFileSync(file,'utf8'),original);});
 test('Non-Codespace, production, external DB and wrong origin are refused',()=>{
  for(const bad of [{...env,CODESPACES:'false'},{...env,NODE_ENV:'production'},{...env,DATABASE_URL:'external'},{...env,CODESPACE_NAME:'other'}])assert.throws(()=>configureReview(dir,bad));
  assert.equal(fs.readFileSync(file,'utf8'),original);
 });
 test('Approved development profile preserves auth, data and unrelated settings',()=>{
  const result=configureReview(dir,env),after=fs.readFileSync(file,'utf8');assert.equal(result.model,'gpt-4.1-mini');assert.equal(result.dailyReservationUSD,.5);assert.equal(result.monthlyReservationUSD,10);
  for(const line of original.split('\n').filter(x=>x&&!x.startsWith('AI_')))assert(after.includes(line+'\n'));
  assert(after.includes('AI_ENABLED=true\n'));assert(after.includes('AI_API_KEY='+key+'\n'));assert(!JSON.stringify(result).includes(key));
  assert.equal(fs.statSync(file).mode&0o777,0o600);
 });
 test('Repeated configuration is deterministic with exactly one value per field',()=>{
  const before=fs.readFileSync(file,'utf8');configureReview(dir,{...env,OPENAI_API_KEY:undefined});assert.equal(fs.readFileSync(file,'utf8'),before);
  assert.equal(before.split('\n').filter(x=>x.startsWith('AI_API_KEY=')).length,1);
 });
 test('Malformed credential and existing different provider are not silently accepted',()=>{
  const before=fs.readFileSync(file,'utf8');assert.throws(()=>configureReview(dir,{...env,OPENAI_API_KEY:key+'\n'}));assert.equal(fs.readFileSync(file,'utf8'),before);
  fs.writeFileSync(file,before.replace('https://api.openai.com/v1/chat/completions','https://other.example.test/adapter'));
  assert.throws(()=>configureReview(dir,{...env,OPENAI_API_KEY:undefined}),/different/);
 });
 test('Symbolic-link configuration target is refused',()=>{
  fs.renameSync(file,file+'.original');fs.symlinkSync(file+'.original',file);assert.throws(()=>configureReview(dir,env),/symbolic/);
 });
 fs.writeFileSync('docs/ai-review-results.json',JSON.stringify({date:new Date().toISOString(),baseline:'e9d3701605bc80f411d733b32549487ab11787c5',environment:'isolated temporary configuration, random credentials; no network',passed:n,notRun:['Live Codespace configuration/restart','Key issuance or billing','Live provider calls']},null,2)+'\n');
 console.log(`${n} AI review profile checks PASS; temporary credentials only, no network calls.`);
}finally{fs.rmSync(dir,{recursive:true,force:true});}
