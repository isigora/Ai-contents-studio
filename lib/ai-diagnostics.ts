import {z} from 'zod';
import {safeAiCode} from './ai-failure';

const resultSchema=z.object({
 configured:z.boolean(),
 recent:z.array(z.object({
  task:z.enum(['text','interpretation']),
  status:z.enum(['running','succeeded','failed']),
  updated_at:z.string().datetime({offset:true}),
  reason:z.string().optional()
 })).max(5)
});
// Ignore upstream messages and extra fields. Only fixed public classifications are rendered.
export function parseAiDiagnostics(value:unknown){
 const result=resultSchema.parse(value);
 return {...result,recent:result.recent.map(run=>({...run,updated_at:new Date(run.updated_at).toISOString(),reason:run.status==='failed'?safeAiCode(run.reason):undefined}))};
}
export type AiDiagnosticsResult=ReturnType<typeof parseAiDiagnostics>;
export async function readAiDiagnostics(signal:AbortSignal){
 let response:Response;
 try{response=await fetch('/api/ai-diagnostics',{method:'GET',credentials:'include',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(10000)])});}
 catch{throw new Error('진단 결과를 불러오지 못했습니다. 다시 조회해 주세요.');}
 if(!response.ok)throw new Error(response.status===401?'먼저 로그인해 주세요.':'진단 결과를 불러오지 못했습니다. 다시 조회해 주세요.');
 try{return parseAiDiagnostics(await response.json());}
 catch{throw new Error('진단 응답을 확인할 수 없습니다. 서버 업데이트 상태를 확인해 주세요.');}
}
