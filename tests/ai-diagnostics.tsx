import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseAiDiagnostics,readAiDiagnostics} from '../lib/ai-diagnostics';
import {AiDiagnostics,AiDiagnosticsView} from '../components/ai-diagnostics';
import {UiLanguageProvider} from '../components/ui-language';

const fixture={configured:true,recent:[{task:'text',status:'failed',updated_at:'2026-10-10T21:00:00+09:00',reason:'AI_BILLING_QUOTA',message:'PRIVATE-UPSTREAM',prompt:'PRIVATE-SOURCE'}],secret:'PRIVATE-KEY'};
const parsed=parseAiDiagnostics(fixture);
const html=renderToStaticMarkup(<UiLanguageProvider><AiDiagnosticsView result={parsed}/></UiLanguageProvider>);
assert(html.includes('AI_BILLING_QUOTA'));assert(html.includes('크레딧'));assert(html.includes('2026-10-10T12:00:00.000Z'));
assert(!html.includes('PRIVATE-'));assert(!JSON.stringify(parsed).includes('PRIVATE-'));
const unknown=parseAiDiagnostics({...fixture,recent:[{...fixture.recent[0],reason:'secret raw error'}]});
assert.equal(unknown.recent[0].reason,'GENERATION_FAILED');
assert.throws(()=>parseAiDiagnostics({...fixture,recent:Array(6).fill(fixture.recent[0])}));
assert.throws(()=>parseAiDiagnostics({...fixture,recent:[{...fixture.recent[0],status:'invented'}]}));
assert.throws(()=>parseAiDiagnostics({...fixture,recent:[{...fixture.recent[0],updated_at:'invalid'}]}));
assert(renderToStaticMarkup(<UiLanguageProvider><AiDiagnosticsView result={{configured:false,recent:[]}}/></UiLanguageProvider>).includes('조회할 작업 기록이 없습니다.'));
const original=globalThis.fetch;let calls=0;
try{
 globalThis.fetch=async(url,init)=>{calls++;assert.equal(url,'/api/ai-diagnostics');assert.equal(init?.method,'GET');assert.equal(init?.credentials,'include');assert.equal(init?.cache,'no-store');assert.equal(init?.body,undefined);return Response.json(fixture);};
 const panel=renderToStaticMarkup(<UiLanguageProvider><AiDiagnostics/></UiLanguageProvider>);
 assert(panel.includes('진단 조회'));assert.equal(calls,0); // Mount/render must not trigger an AI or diagnostic request.
 assert.deepEqual(await readAiDiagnostics(new AbortController().signal),parsed);assert.equal(calls,1);
 globalThis.fetch=async()=>Response.json({message:'PRIVATE-UPSTREAM'},{status:401});
 await assert.rejects(readAiDiagnostics(new AbortController().signal),{message:'먼저 로그인해 주세요.'});
 globalThis.fetch=async()=>Response.json({secret:'PRIVATE-KEY'});
 await assert.rejects(readAiDiagnostics(new AbortController().signal),/진단 응답을 확인할 수 없습니다/);
 globalThis.fetch=async()=>{throw new Error('PRIVATE-NETWORK');};
 await assert.rejects(readAiDiagnostics(new AbortController().signal),{message:'진단 결과를 불러오지 못했습니다. 다시 조회해 주세요.'});
}finally{globalThis.fetch=original;}
console.log('AI diagnostics: read-only request, safe projection, validation and SSR checks passed (no live AI/browser).');
