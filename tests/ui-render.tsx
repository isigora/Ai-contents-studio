import assert from 'node:assert/strict';
import {renderToStaticMarkup} from 'react-dom/server';
import {writeFile} from 'node:fs/promises';
import dictionary from '../lib/ui-translations.json';
import {translate,UiLanguageProvider} from '../components/ui-language';
import {ReviewPanel,MediaPanel} from '../components/studio-production';
const detail={id:'demo',current_version:3,workflow:{state:'pending'},latest:{title:'공원구 입문 체험 · 예시',body:'공원구 입문 체험 · 예시\n장비 대여와 기본 규칙 안내\n체험 일정 문의하기'},reviews:[{version:3,action:'submit',note:'실제 고객 데이터가 아닌 UI 검토 예시',created_at:'2026-09-29T03:00:00Z'}]};
for(const locale of ['ko','zh','en'] as const){
 for(const [label,values] of Object.entries(dictionary)){assert(values.zh.trim());assert(values.en.trim());assert.equal(translate(label,locale),locale==='ko'?label:values[locale])}
 const html=renderToStaticMarkup(<UiLanguageProvider initialLocale={locale}><ReviewPanel wid="demo" detail={detail} role="owner" onOpen={async()=>{}}/><MediaPanel wid="demo" detail={detail} assets={[]} canEdit={true}/></UiLanguageProvider>);
 assert(!html.includes('undefined'));assert(html.includes(locale==='ko'?'승인 대기':locale==='zh'?'等待批准':'Awaiting approval'));
 assert(html.includes(detail.reviews[0].note)); // User-entered notes remain unchanged.
}
await writeFile('docs/ui-render-results.json',JSON.stringify({date:new Date().toISOString(),status:'PASS',locales:['ko','zh','en'],translationEntries:Object.keys(dictionary).length,scope:'React SSR of actual review/media components; locale labels and unchanged user content. Not browser interaction.'},null,2)+'\n');
console.log('3 UI language renders passed');
