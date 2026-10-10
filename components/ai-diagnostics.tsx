'use client';
import {useEffect,useRef,useState} from 'react';
import {aiFailureMessage} from '@/lib/ai-failure';
import {readAiDiagnostics,type AiDiagnosticsResult} from '@/lib/ai-diagnostics';
import {UiText} from './ui-language';

export function AiDiagnosticsView({result}:{result:AiDiagnosticsResult}){
 return <div>
  <p><UiText>{result.configured?'AI 연결 설정이 준비되어 있습니다. 실제 생성 성공 여부는 작업 기록에서 확인하세요.':'AI 연결 설정이 준비되지 않았습니다. 서버 설정과 재시작 여부를 확인하세요.'}</UiText></p>
  {!result.recent.length&&<p><UiText>조회할 작업 기록이 없습니다.</UiText></p>}
  <ul>{result.recent.map((run,index)=><li key={index} style={{overflowWrap:'anywhere'}}>
   <strong><UiText>{run.task==='text'?'글 생성':'자료 해석'}</UiText> · <UiText>{run.status==='failed'?'실패':run.status==='running'?'처리 중':'성공'}</UiText></strong>
   <div><time dateTime={run.updated_at}>{run.updated_at}</time> (UTC)</div>
   {run.status==='failed'&&<p><code>{run.reason}</code> · <UiText>{aiFailureMessage(run.reason)}</UiText></p>}
  </li>)}</ul>
 </div>;
}
export function AiDiagnostics(){
 const [result,setResult]=useState<AiDiagnosticsResult|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const active=useRef<AbortController|null>(null);
 useEffect(()=>()=>{active.current?.abort();active.current=null;},[]);
 async function read(){
  if(active.current)return;
  const controller=new AbortController();active.current=controller;setBusy(true);setError('');setResult(null);
  try{const next=await readAiDiagnostics(controller.signal);if(!controller.signal.aborted)setResult(next);}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'진단 조회에 실패했습니다.');}
  finally{if(!controller.signal.aborted){active.current=null;setBusy(false);}}
 }
 return <details className="translation-details">
  <summary><UiText>AI 작업 진단</UiText></summary>
  <p className="small muted"><UiText>현재 편집 권한이 있는 작업공간의 최근 본인 작업 5개를 조회합니다. AI를 호출하거나 생성을 재시도하지 않습니다.</UiText></p>
  <button type="button" className="button" disabled={busy} onClick={()=>void read()}><UiText>{busy?'조회 중…':'진단 조회'}</UiText></button>
  <div aria-live="polite" aria-busy={busy}>{error&&<p role="alert"><UiText>{error}</UiText></p>}{result&&<AiDiagnosticsView result={result}/>}</div>
 </details>;
}
