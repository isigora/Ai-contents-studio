'use client';
import {useRef,useState} from 'react';
import {intakeFields,type Interpretation} from '@/lib/ai-intake';
import {UiText,useTranslate} from './ui-language';
export type InterpretationResponse={id:string,status:'running'|'succeeded'|'failed',result:Interpretation|null};
const labels={name:'제품·서비스 키워드',summary:'실제 제공 내용 · 자료 붙여넣기',audience:'대상 고객',cta:'다음 행동'};
export function AiIntake({available,disabled,onInterpret,onApply}:{available:boolean,disabled:boolean,onInterpret:(source:string,key:string)=>Promise<InterpretationResponse>,onApply:(suggestion:Interpretation,id:string)=>void}){
 const t=useTranslate(),[source,setSource]=useState(''),[consent,setConsent]=useState(false),[pending,setPending]=useState(false),[result,setResult]=useState<InterpretationResponse|null>(null),[error,setError]=useState('');
 const active=useRef(false),request=useRef<{source:string,key:string}|null>(null);
 const change=(value:string)=>{setSource(value);setConsent(false);setResult(null);setError('');request.current=null;};
 async function run(){
  if(active.current||disabled||!available||!consent||!source.trim())return;
  if(request.current?.source!==source)request.current={source,key:crypto.randomUUID()};
  active.current=true;setPending(true);setError('');
  try{const response=await onInterpret(source,request.current.key);setResult(response);}
  catch(e){setError(e instanceof Error?e.message:'AI 해석에 실패했습니다. 입력 자료는 유지됩니다.');}
  finally{active.current=false;setPending(false);}
 }
 return <div className="panel">
  <h3><UiText>AI로 자료 해석하기</UiText></h3>
  <p className="muted"><UiText>키워드나 설명 자료를 붙여넣으세요. AI 제안과 원문을 확인한 뒤 필요한 정보를 보완합니다.</UiText></p>
  {!available&&<p role="status"><UiText>AI 제공자 설정이 필요합니다. 아래에서 직접 등록할 수 있습니다.</UiText></p>}
  <fieldset disabled={disabled||pending} style={{border:0,padding:0,minWidth:0}}>
   <label className="field"><span><UiText>해석할 자료</UiText></span><textarea rows={5} maxLength={12000} value={source} onChange={e=>change(e.target.value)}/></label>
   <label><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)}/><UiText>이 자료를 사용할 권한이 있으며 설정된 AI 제공자에게 전송하는 데 동의합니다.</UiText></label>
   <p className="small muted"><UiText>붙여넣은 자료만 전송합니다. 비밀번호나 비밀키는 입력하지 마세요. 해석 결과는 확인 전까지 제안 상태입니다.</UiText></p>
   <button type="button" className="button" disabled={!available||!consent||!source.trim()} onClick={()=>void run()}><UiText>{pending?'해석 중…':result?.status==='running'?'해석 상태 확인':'AI로 해석'}</UiText></button>
  </fieldset>
  {error&&<p role="alert">{t(error)} <button type="button" className="button" disabled={pending||disabled} onClick={()=>{request.current=null;setResult(null);setError('');}}><UiText>새 요청 준비</UiText></button><span className="small"><UiText>새 요청은 추가 비용이 발생할 수 있습니다.</UiText></span></p>}
  {result?.status==='running'&&<p role="status"><UiText>이전 요청이 처리 중입니다. 잠시 후 상태를 확인해 주세요.</UiText></p>}
  {result?.status==='succeeded'&&result.result&&<div>
   <h4><UiText>AI 제안 · 확인 필요</UiText></h4>
   {intakeFields.map(field=><div key={field}><strong>{t(labels[field])}</strong><p>{result.result![field]?.value||t('정보 없음 · 직접 보완해 주세요.')}</p>{result.result![field]&&<blockquote style={{overflowWrap:'anywhere'}}>{result.result![field]!.quote}</blockquote>}</div>)}
   <p><UiText>구분</UiText>: {result.result.kind?t(result.result.kind==='service'?'서비스':'제품'):t('정보 없음 · 직접 보완해 주세요.')}</p>
   {!!result.result.questions.length&&<><h4><UiText>보완 질문</UiText></h4><ul>{result.result.questions.map((q,i)=><li key={i}>{q}</li>)}</ul></>}
   <button type="button" className="button" disabled={disabled||pending} onClick={()=>onApply(result.result!,result.id)}><UiText>제안을 등록 폼에 적용하고 검토</UiText></button>
  </div>}
 </div>;
}
