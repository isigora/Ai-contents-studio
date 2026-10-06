'use client';
import {useRef,useState,type FormEvent} from 'react';
import {UiText,useTranslate} from './ui-language';
import {AiIntake,type InterpretationResponse} from './ai-intake';
export type QuickInput={name:string,summary:string,audience:string,cta:string,kind:'product'|'service',confirmed:true,interpretation_id?:string};
export function QuickStart({disabled,onCreate,aiAvailable=false,onInterpret}:{disabled:boolean,onCreate:(input:QuickInput,key:string)=>Promise<void>,aiAvailable?:boolean,onInterpret?:(source:string,key:string)=>Promise<InterpretationResponse>}){
  const t=useTranslate();
  const [input,setInput]=useState({name:'',summary:'',audience:'',cta:'',kind:'product' as 'product'|'service'|''});
  const [confirmed,setConfirmed]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState('');
  const [interpretationId,setInterpretationId]=useState<string|undefined>();
  const active=useRef(false),request=useRef<{fingerprint:string,key:string}|null>(null);
  const update=(field:string,value:string)=>{setInput(s=>({...s,[field]:value}));setConfirmed(false);setError('');};
  async function submit(event:FormEvent){
    event.preventDefault();if(disabled||active.current||!confirmed||!input.kind)return;
    const payload:QuickInput={...input,kind:input.kind,confirmed:true,...(interpretationId?{interpretation_id:interpretationId}:{})};
    const fingerprint=JSON.stringify(payload);
    if(request.current?.fingerprint!==fingerprint)request.current={fingerprint,key:crypto.randomUUID()};
    active.current=true;setPending(true);setError('');
    try{await onCreate(payload,request.current.key);setInput({name:'',summary:'',audience:'',cta:'',kind:'product'});setConfirmed(false);setInterpretationId(undefined);request.current=null;}
    catch(e){setError(e instanceof Error?e.message:'등록하지 못했습니다. 입력은 유지됩니다.');}
    finally{active.current=false;setPending(false);}
  }
  return <section className="panel"><h2><UiText>간편 등록으로 시작하기</UiText></h2>
    <p className="muted"><UiText>제품 키워드와 실제 제공 내용, 고객, 다음 행동만 입력하세요. 나머지 정보는 나중에 보완할 수 있습니다.</UiText></p>
    {onInterpret&&<AiIntake available={aiAvailable} disabled={disabled||pending} onInterpret={onInterpret} onApply={(suggestion,id)=>{setInput({name:suggestion.name?.value||'',summary:suggestion.summary?.value||'',audience:suggestion.audience?.value||'',cta:suggestion.cta?.value||'',kind:suggestion.kind||''});setInterpretationId(id);setConfirmed(false);setError('');request.current=null;}}/>}
    <form onSubmit={submit}>
      <fieldset disabled={disabled||pending} style={{border:0,padding:0,minWidth:0}}>
        <label className="field"><span><UiText>제품·서비스 키워드</UiText></span><input required maxLength={180} value={input.name} onChange={e=>update('name',e.target.value)} /></label>
        <label className="field"><span><UiText>실제 제공 내용 · 자료 붙여넣기</UiText></span><textarea required rows={4} maxLength={4000} value={input.summary} onChange={e=>update('summary',e.target.value)} /></label>
        <div className="two-col">
          <label className="field"><span><UiText>대상 고객</UiText></span><input required maxLength={160} value={input.audience} onChange={e=>update('audience',e.target.value)} /></label>
          <label className="field"><span><UiText>다음 행동</UiText></span><input required maxLength={500} value={input.cta} onChange={e=>update('cta',e.target.value)} /></label>
        </div>
        <label className="field"><span><UiText>구분</UiText></span><select required value={input.kind} onChange={e=>update('kind',e.target.value)}><option value="">{t('선택해 주세요.')}</option><option value="product">{t('제품')}</option><option value="service">{t('서비스')}</option></select></label>
        <label><input type="checkbox" required checked={confirmed} onChange={e=>setConfirmed(e.target.checked)} /> <UiText>입력한 내용을 사실로 확인했습니다.</UiText></label>
        <p className="small muted"><UiText>입력한 사실만 저장합니다. 등록 후 X 초안 설정으로 이동하며 자동 게시하지 않습니다.</UiText></p>
        <button className="button primary" disabled={!confirmed||pending} type="submit"><UiText>{pending?'저장 중…':'등록하고 X 초안 만들기'}</UiText></button>
      </fieldset>
      {error&&<p role="alert">{t(error)}</p>}
    </form>
  </section>;
}
