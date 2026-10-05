import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import {getDb,rows,type Queryable,type Row} from './db';
import {getAuth} from './auth';
import {requestOriginAllowed} from './auth-origins';
import {companySchema,audienceSchema,offeringSchema,generationSchema,intakeSchema} from '../models';
import {generate,bodyOf,type Snapshot} from './generator';
import {inspectFile,putObject,getObject,deleteObject} from './storage';
import sharp from 'sharp';
import {p1Route} from './p1';
import {channels,templateVersion} from '../templates';
export class HttpError extends Error{constructor(public status:number,public code:string,message:string){super(message)}}
function fail(status:number,code:string,message:string):never{throw new HttpError(status,code,message)}
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function readLimited(req:Request,limit:number){
 if(Number(req.headers.get('content-length')||0)>limit)fail(413,'TOO_LARGE','요청 크기가 제한을 초과했습니다.');
 const reader=req.body?.getReader();if(!reader)return new Uint8Array();const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();fail(413,'TOO_LARGE','요청 크기가 제한을 초과했습니다.');}chunks.push(value)}}finally{reader.releaseLock()}
 return new Uint8Array(Buffer.concat(chunks));
}
async function parse(req:Request){const text=new TextDecoder().decode(await readLimited(req,150000));try{return JSON.parse(text)}catch{fail(400,'INVALID_JSON','입력 형식이 올바르지 않습니다.')}}

async function access(uid:string,wid:string,write=false,q?:Queryable){const db=q||await getDb();const r=(await db.query('SELECT w.*,m.role FROM workspace w JOIN membership m ON m.workspace_id=w.id WHERE w.id=$1 AND m.user_id=$2',[wid,uid])).rows[0];if(!r)fail(404,'NOT_FOUND','작업공간을 찾을 수 없습니다.');if(write&&r.role==='viewer')fail(403,'READ_ONLY','이 계정에는 열람 권한만 있습니다.');return r}
async function audit(q:Queryable,uid:string,wid:string,action:string,id?:string){await q.query('INSERT INTO audit_event(id,user_id,workspace_id,action,entity_id) VALUES($1,$2,$3,$4,$5)',[randomUUID(),uid,wid,action,id||null])}
async function revision(q:Queryable,uid:string,wid:string,type:string,id:string,rev:number,data:unknown){await q.query('INSERT INTO knowledge_revision(id,workspace_id,entity_type,entity_id,revision,snapshot,created_by) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),wid,type,id,rev,JSON.stringify(data),uid]);await q.query('UPDATE workspace SET revision=revision+1 WHERE id=$1',[wid]);await audit(q,uid,wid,type+'.saved',id)}
async function own(q:Queryable,table:string,wid:string,id:string){if(!['offering','audience','asset','content'].includes(table))throw new Error('Invalid table');const r=(await q.query(`SELECT * FROM ${table} WHERE workspace_id=$1 AND id=$2`,[wid,id])).rows[0];if(!r)fail(404,'NOT_FOUND','자료를 찾을 수 없습니다.');return r}
async function fullContent(q:Queryable,wid:string,id:string){const c=await own(q,'content',wid,id);const vs=(await q.query('SELECT * FROM content_version WHERE workspace_id=$1 AND content_id=$2 ORDER BY version DESC',[wid,id])).rows;const w=(await q.query('SELECT revision FROM workspace WHERE id=$1',[wid])).rows[0];const workflow=(await q.query('SELECT * FROM content_workflow WHERE workspace_id=$1 AND content_id=$2',[wid,id])).rows[0]||{state:'draft',version:c.current_version};const reviews=(await q.query('SELECT version,action,note,actor_id,created_at FROM review_event WHERE workspace_id=$1 AND content_id=$2 ORDER BY created_at DESC,id DESC',[wid,id])).rows;return {...c,versions:vs,latest:vs[0],stale:c.source_revision!==w.revision,workflow,reviews}}
export async function handle(req:Request):Promise<Response>{
 let uid='',wid='';
 try{
  const path=new URL(req.url).pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=req.method;
  if(method!=='GET'&&!requestOriginAllowed(req))fail(403,'ORIGIN','허용되지 않은 요청입니다.');
  const auth=await getAuth(),session=await auth.api.getSession({headers:req.headers});
  if(!session)fail(401,'UNAUTHORIZED','먼저 로그인해 주세요.');uid=session.user.id;
  const db=await getDb();
  if(path[0]==='me'&&method==='GET'){const ws=await rows('SELECT w.*,m.role FROM workspace w JOIN membership m ON w.id=m.workspace_id WHERE m.user_id=$1 ORDER BY w.created_at',[uid]);return json({user:{id:uid,name:session.user.name,email:session.user.email},workspaces:ws,mode:process.env.AI_ENABLED==='true'?'ai':'basic'})}
  if(path[0]!=='workspaces')fail(404,'NOT_FOUND','경로를 찾을 수 없습니다.');
  if(path.length===1&&method==='POST'){
   const p=z.object({name:z.string().trim().min(1).max(160),locale:z.enum(['ko','zh','en']).default('ko')}).parse(await parse(req));
   const result=await db.transaction(async q=>{const n=(await q.query('SELECT count(*)::int AS n FROM membership WHERE user_id=$1 AND role=$2',[uid,'owner'])).rows[0].n;if(n>=10)fail(429,'WORKSPACE_LIMIT','최대 10개 작업공간을 만들 수 있습니다.');const id=randomUUID();await q.query('INSERT INTO workspace(id,name,locale) VALUES($1,$2,$3)',[id,p.name,p.locale]);await q.query('INSERT INTO membership(workspace_id,user_id,role) VALUES($1,$2,$3)',[id,uid,'owner']);await q.query('INSERT INTO company(workspace_id,data) VALUES($1,$2)',[id,JSON.stringify(companySchema.parse({name:p.name}))]);await audit(q,uid,id,'workspace.created',id);return {id,...p,role:'owner',revision:1}});return json(result,201);
  }
  wid=path[1];if(!wid)fail(404,'NOT_FOUND','작업공간을 선택해 주세요.');const workspace=await access(uid,wid,method!=='GET');const resource=path[2],id=path[3];
  if(!resource&&method==='GET')return json(workspace);
  const extended=await p1Route({db,uid,wid,workspace,resource,id,path,method,req,parse,access,fullContent,own,audit,fail});if(extended)return extended;
  if(resource==='intake'&&method==='POST'&&!id){
   const input=intakeSchema.parse(await parse(req));
   const key=z.string().min(8).max(100).parse(req.headers.get('idempotency-key'));
   const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
   const result=await db.transaction(async q=>{
    await access(uid,wid,true,q);
    // Serialise same-workspace intake retries before creating either linked entity.
    await q.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE',[wid]);
    const old=(await q.query('SELECT * FROM knowledge_intake WHERE workspace_id=$1 AND user_id=$2 AND request_key=$3',[wid,uid,key])).rows[0];
    if(old){
     if(old.request_hash!==hash)fail(409,'KEY_CONFLICT','다른 입력에 같은 요청 키를 사용할 수 없습니다.');
     return {offering_id:old.offering_id,audience_id:old.audience_id,replayed:true};
    }
    const count=(await q.query("SELECT count(*)::int AS n FROM knowledge_intake WHERE workspace_id=$1 AND created_at>now()-interval '1 minute'",[wid])).rows[0].n;
    if(count>=10)fail(429,'INTAKE_LIMIT','잠시 후 다시 등록해 주세요.');
    const audienceId=randomUUID(),offeringId=randomUUID();
    const audience=audienceSchema.parse({name:input.audience,status:'approved'});
    const offering=offeringSchema.parse({name:input.name,kind:input.kind,summary:input.summary,audience_id:audienceId,cta:input.cta,currency:'KRW'});
    await q.query('INSERT INTO audience(id,workspace_id,data) VALUES($1,$2,$3)',[audienceId,wid,JSON.stringify(audience)]);
    await q.query('INSERT INTO offering(id,workspace_id,audience_id,data) VALUES($1,$2,$3,$4)',[offeringId,wid,audienceId,JSON.stringify(offering)]);
    await revision(q,uid,wid,'audience',audienceId,1,audience);
    await revision(q,uid,wid,'offering',offeringId,1,offering);
    await q.query('INSERT INTO knowledge_intake(workspace_id,user_id,request_key,request_hash,offering_id,audience_id) VALUES($1,$2,$3,$4,$5,$6)',[wid,uid,key,hash,offeringId,audienceId]);
    return {offering_id:offeringId,audience_id:audienceId,replayed:false};
   });return json(result,result.replayed?200:201);
  }
  if(resource==='company'){
   if(method==='GET')return json((await rows('SELECT * FROM company WHERE workspace_id=$1',[wid]))[0]);
   if(method==='PUT'){const p=await parse(req),data=companySchema.parse(p.data),rev=z.number().int().positive().parse(p.revision);return json(await db.transaction(async q=>{await access(uid,wid,true,q);if(data.brand.logo_asset_id){const logo=await own(q,'asset',wid,data.brand.logo_asset_id);if(logo.status!=='ready'||!logo.mime.startsWith('image/'))fail(400,'LOGO_ASSET','사용 가능한 이미지 자산을 선택해 주세요.');}const r=(await q.query('UPDATE company SET data=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND revision=$3 RETURNING *',[JSON.stringify(data),wid,rev])).rows[0];if(!r)fail(409,'REVISION_CONFLICT','다른 창에서 정보가 바뀌었습니다. 새로 불러온 뒤 다시 저장해 주세요.');await revision(q,uid,wid,'company',wid,r.revision,data);return r}));}
  }
  if(['audiences','offerings'].includes(resource)){
   const table=resource==='audiences'?'audience':'offering';
   if(method==='GET'){
    if(id&&path[4]==='versions'){await own(db,table,wid,id);return json(await rows('SELECT * FROM knowledge_revision WHERE workspace_id=$1 AND entity_type=$2 AND entity_id=$3 ORDER BY revision DESC',[wid,table,id]));}
    if(id)return json(await own(db,table,wid,id));return json(await rows(`SELECT * FROM ${table} WHERE workspace_id=$1 ORDER BY updated_at DESC`,[wid]));
   }
   if(method==='POST'||method==='PUT'){
    const p=await parse(req),data=table==='audience'?audienceSchema.parse(p.data):offeringSchema.parse(p.data),revisionNumber=method==='PUT'?z.number().int().positive().parse(p.revision):1;
    const result=await db.transaction(async q=>{
     await access(uid,wid,true,q);
     if(table==='offering'){
      const o=data as z.infer<typeof offeringSchema>;const a=await own(q,'audience',wid,o.audience_id);if(a.archived)fail(400,'ARCHIVED','보관된 고객군은 선택할 수 없습니다.');
      for(const assetId of [...o.asset_ids,...o.proofs.map(p=>p.asset_id).filter(Boolean)])await own(q,'asset',wid,assetId);
      for(const p of o.proofs){if(p.source&&!/^https?:\/\//i.test(p.source))fail(400,'PROOF_SOURCE','근거 URL은 http 또는 https 주소로 입력해 주세요.');if(p.status==='verified'&&(!p.statement||(!p.source&&!p.asset_id)||!p.verified_at))fail(400,'PROOF_REQUIRED','검증된 근거에는 주장·출처·확인일이 필요합니다.');if(p.status==='verified'&&p.asset_id&&(await own(q,'asset',wid,p.asset_id)).status!=='ready')fail(400,'ASSET_QUARANTINED','격리 중인 파일은 검증 근거로 사용할 수 없습니다.');}
      for(const date of [o.valid_from,o.valid_to])if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))fail(400,'DATE','날짜 형식은 YYYY-MM-DD입니다.');
      if(o.valid_from&&o.valid_to&&o.valid_from>o.valid_to)fail(400,'DATE_RANGE','가격 시작일이 종료일보다 늦습니다.');
     }
     let result:Row;
     if(method==='POST'){const nid=randomUUID();result=(await q.query(table==='offering'?'INSERT INTO offering(id,workspace_id,audience_id,data) VALUES($1,$2,$3,$4) RETURNING *':'INSERT INTO audience(id,workspace_id,data) VALUES($1,$2,$3) RETURNING *',table==='offering'?[nid,wid,(data as any).audience_id,JSON.stringify(data)]:[nid,wid,JSON.stringify(data)])).rows[0];}
     else{await own(q,table,wid,id);result=(await q.query(table==='offering'?'UPDATE offering SET data=$1,audience_id=$2,revision=revision+1,updated_at=now() WHERE workspace_id=$3 AND id=$4 AND revision=$5 RETURNING *':'UPDATE audience SET data=$1,revision=revision+1,updated_at=now() WHERE workspace_id=$2 AND id=$3 AND revision=$4 RETURNING *',table==='offering'?[JSON.stringify(data),(data as any).audience_id,wid,id,revisionNumber]:[JSON.stringify(data),wid,id,revisionNumber])).rows[0];if(!result)fail(409,'REVISION_CONFLICT','다른 창에서 정보가 바뀌었습니다. 새로 불러와 주세요.');}
     await revision(q,uid,wid,table,result.id,result.revision,data);return result;
    });return json(result,method==='POST'?201:200);
   }
   if(method==='DELETE'&&id){await db.transaction(async q=>{const item=await own(q,table,wid,id);await q.query(`UPDATE ${table} SET archived=true,revision=revision+1,updated_at=now() WHERE workspace_id=$1 AND id=$2`,[wid,id]);await revision(q,uid,wid,table,id,item.revision+1,{...item.data,archived:true})});return json({archived:true});}
  }
  if(resource==='assets'){
   if(method==='GET'){
    if(!id)return json(await rows('SELECT id,name,mime,size,rights_note,status,created_at FROM asset WHERE workspace_id=$1 ORDER BY created_at DESC',[wid]));
    const asset=await own(db,'asset',wid,id);
    if(path[4]==='download'){if(asset.status!=='ready')fail(423,'QUARANTINED','안전 검사 전 격리 중인 파일입니다.');const bytes=await getObject(asset.object_key);return new Response(new Uint8Array(bytes),{headers:{'Content-Type':asset.mime,'Content-Disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(asset.name),'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}
    return json({...asset,object_key:undefined});
   }
   if(method==='POST'){
    if(Number(req.headers.get('content-length')||0)>6*1024*1024)fail(413,'FILE_SIZE','파일은 5MB 이하로 선택해 주세요.');
    const limited=await readLimited(req,6*1024*1024);const form=await new Response(limited,{headers:{'Content-Type':req.headers.get('content-type')||''}}).formData(),file=form.get('file');if(!(file instanceof File)||!file.size||file.size>5*1024*1024)fail(400,'FILE_SIZE','파일은 1바이트 이상 5MB 이하로 선택해 주세요.');
    if(file.name.length>200)fail(400,'FILE_NAME','파일 이름이 너무 깁니다.');let bytes=new Uint8Array(await file.arrayBuffer()),inspection:{mime:string,status:string};try{inspection=inspectFile(bytes,file.name)}catch{fail(400,'FILE_TYPE','PNG, JPG, PDF, UTF-8 TXT 파일만 허용됩니다. 파일 내용도 형식과 일치해야 합니다.');}
    let name=file.name;
    if(inspection.mime.startsWith('image/')){try{bytes=new Uint8Array(await sharp(bytes,{limitInputPixels:24000000}).rotate().png().toBuffer());inspection={mime:'image/png',status:'ready'};name=file.name.replace(/\.[^.]+$/,'.png')}catch{fail(400,'INVALID_IMAGE','이미지를 읽을 수 없거나 해상도가 너무 큽니다.');}}
    const assetId=randomUUID(),key=wid+'/'+assetId,rights=String(form.get('rights_note')||'').slice(0,1000);await putObject(key,bytes,inspection.mime);
    try{await db.transaction(async q=>{await access(uid,wid,true,q);await q.query('INSERT INTO asset(id,workspace_id,object_key,name,mime,size,rights_note,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[assetId,wid,key,name,inspection.mime,bytes.length,rights,inspection.status,uid]);await audit(q,uid,wid,'asset.uploaded',assetId)})}catch(e){await deleteObject(key);throw e}
    return json({id:assetId,name,...inspection,size:bytes.length,rights_note:rights},201);
   }
  }
  if(resource==='generations'){
   if(method==='GET'&&id){const r=(await rows('SELECT id,status,content_id,error_code,model FROM generation_run WHERE workspace_id=$1 AND id=$2',[wid,id]))[0];if(!r)fail(404,'NOT_FOUND','생성 작업을 찾을 수 없습니다.');return json(r)}
   if(method==='POST'){
    const settings=generationSchema.parse(await parse(req)),key=req.headers.get('idempotency-key')||'';
    if(!/^[\w-]{8,100}$/.test(key))fail(400,'IDEMPOTENCY_REQUIRED','요청 식별자가 필요합니다.');
    if(!(channels[settings.channel].formats as readonly string[]).includes(settings.format))fail(400,'CHANNEL_FORMAT','선택한 채널에 맞는 형식을 선택해 주세요.');
    const hash=createHash('sha256').update(JSON.stringify(settings)).digest('hex');
    const reserved=await db.transaction(async q=>{
     await q.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE',[wid]);await access(uid,wid,true,q);
     const old=(await q.query('SELECT * FROM generation_run WHERE workspace_id=$1 AND idempotency_key=$2',[wid,key])).rows[0];
     if(old){if(old.request_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT','동일 요청 식별자로 다른 내용을 보낼 수 없습니다.');return {old};}
     const w=(await q.query('SELECT revision FROM workspace WHERE id=$1',[wid])).rows[0];if(w.revision!==settings.source_revision)fail(409,'SOURCE_CHANGED','원천 정보가 바뀌었습니다. 새로 불러온 뒤 생성해 주세요.');
     const offering=await own(q,'offering',wid,settings.offering_id),audience=await own(q,'audience',wid,settings.audience_id),company=(await q.query('SELECT * FROM company WHERE workspace_id=$1',[wid])).rows[0];
     if(offering.archived||audience.archived)fail(400,'ARCHIVED','보관된 자료는 생성에 사용할 수 없습니다.');
     const count=(await q.query("SELECT count(*)::int AS n FROM generation_run WHERE workspace_id=$1 AND created_at>now()-interval '1 minute'",[wid])).rows[0].n;
     if(count>=20)fail(429,'RATE_LIMIT','요청이 많습니다. 잠시 후 다시 시도해 주세요.');
     const ai=process.env.AI_ENABLED==='true',cost=ai?Number(process.env.AI_RUN_RESERVATION_USD||'.10'):0,limit=Number(process.env.AI_DAILY_LIMIT_USD||'2');
     if(ai){const spent=Number((await q.query("SELECT coalesce(sum(cost_estimate),0) AS amount FROM generation_run WHERE workspace_id=$1 AND created_at>date_trunc('day',now())",[wid])).rows[0].amount);if(!Number.isFinite(cost)||cost<=0||!Number.isFinite(limit)||spent+cost>limit)fail(429,'BUDGET_LIMIT','설정된 일일 생성 예산 한도에 도달했습니다.');}
     const runId=randomUUID();await q.query('INSERT INTO generation_run(id,workspace_id,user_id,idempotency_key,request_hash,status,model,request,cost_estimate) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',[runId,wid,uid,key,hash,'running',ai?(process.env.AI_MODEL||'not-configured'):'facts-template-v1',JSON.stringify(settings),cost]);
     return {runId,snapshot:{offering,audience,company,revision:w.revision} as Snapshot};
    });
    if(reserved.old){if(reserved.old.status==='succeeded')return json(await fullContent(db,wid,reserved.old.content_id));if(reserved.old.status==='failed')fail(409,'PREVIOUS_RUN_FAILED','이전 요청이 실패했습니다. 새 요청으로 다시 시도해 주세요.');if(new Date(reserved.old.updated_at).getTime()<Date.now()-120000){await rows("UPDATE generation_run SET status='failed',error_code='INTERRUPTED' WHERE workspace_id=$1 AND id=$2 AND status='running'",[wid,reserved.old.id]);fail(409,'INTERRUPTED','생성이 중단되었습니다. 새 요청으로 다시 시도해 주세요.');}return json({run_id:reserved.old.id,status:'running'},202);}
    try{
     const {output,mode}=await generate(reserved.snapshot!,settings);
     const cid=await db.transaction(async q=>{await access(uid,wid,true,q);const contentId=randomUUID();await q.query('INSERT INTO content(id,workspace_id,offering_id,audience_id,settings,source_snapshot,source_revision,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[contentId,wid,settings.offering_id,settings.audience_id,JSON.stringify(settings),JSON.stringify(reserved.snapshot),settings.source_revision,uid]);await q.query('INSERT INTO content_version(id,workspace_id,content_id,version,title,body,annotations,created_by) VALUES($1,$2,$3,1,$4,$5,$6,$7)',[randomUUID(),wid,contentId,output.headline,bodyOf(output),JSON.stringify({...output,mode,template_version:templateVersion,channel:settings.channel}),uid]);await q.query("UPDATE generation_run SET status='succeeded',content_id=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3",[contentId,wid,reserved.runId]);await audit(q,uid,wid,'content.generated',contentId);return contentId});return json(await fullContent(db,wid,cid),201);
    }catch(e){await rows("UPDATE generation_run SET status='failed',error_code=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3",[e instanceof Error?e.message.slice(0,80):'FAILED',wid,reserved.runId]);fail(502,'GENERATION_FAILED','생성에 실패했습니다. 원천 정보는 보존되어 있습니다. 설정 확인 후 다시 시도해 주세요.');}
   }
  }
  if(resource==='contents'){
   if(method==='GET'){
    if(!id)return json(await rows('SELECT c.*,v.title,v.annotations,w.revision<>c.source_revision AS stale,coalesce(wf.state,\'draft\') AS workflow_state FROM content c JOIN content_version v ON v.content_id=c.id AND v.workspace_id=c.workspace_id AND v.version=c.current_version JOIN workspace w ON w.id=c.workspace_id LEFT JOIN content_workflow wf ON wf.workspace_id=c.workspace_id AND wf.content_id=c.id AND wf.version=c.current_version WHERE c.workspace_id=$1 ORDER BY c.updated_at DESC',[wid]));
    const c=await fullContent(db,wid,id);
    if(path[4]==='export'){const format=new URL(req.url).searchParams.get('format');const body=format==='json'?JSON.stringify(c,null,2):c.latest.body;return new Response(body,{headers:{'Content-Type':format==='json'?'application/json; charset=utf-8':'text/plain; charset=utf-8','Content-Disposition':'attachment; filename="content-'+id+'.'+(format==='json'?'json':'txt')+'"','Cache-Control':'no-store'}})}
    if(path[4]==='versions')return json(c.versions);return json(c);
   }
   if(method==='PUT'&&id){const p=z.object({title:z.string().trim().min(1).max(300),body:z.string().trim().min(1).max(20000),version:z.number().int().positive(),status:z.enum(['draft','reviewed']).default('draft')}).parse(await parse(req));await db.transaction(async q=>{await access(uid,wid,true,q);await q.query('SELECT id FROM content WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[wid,id]);const c=await fullContent(q,wid,id);const changed=(await q.query('UPDATE content SET current_version=current_version+1,status=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3 AND current_version=$4 RETURNING current_version',[p.status,wid,id,p.version])).rows[0];if(!changed)fail(409,'REVISION_CONFLICT','새 버전이 이미 저장되었습니다. 다시 불러와 주세요.');await q.query('INSERT INTO content_version(id,workspace_id,content_id,version,title,body,annotations,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),wid,id,changed.current_version,p.title,p.body,JSON.stringify({...c.latest.annotations,manually_edited:true,approved:false,reviewed:p.status==='reviewed'}),uid]);await q.query("INSERT INTO content_workflow(workspace_id,content_id,version,state) VALUES($1,$2,$3,'draft') ON CONFLICT(workspace_id,content_id) DO UPDATE SET version=excluded.version,state='draft',updated_at=now()",[wid,id,changed.current_version]);if(c.workflow.state!=='draft')await q.query("INSERT INTO review_event(id,workspace_id,content_id,version,action,note,actor_id) VALUES($1,$2,$3,$4,'invalidate','새 편집 버전으로 승인 초기화',$5)",[randomUUID(),wid,id,changed.current_version,uid]);await audit(q,uid,wid,'content.edited',id)});return json(await fullContent(db,wid,id));}
  }
  fail(404,'NOT_FOUND','경로를 찾을 수 없습니다.');
 }catch(e){
  if(e instanceof z.ZodError)return json({error:{code:'VALIDATION',message:'필수 항목과 입력 길이를 확인해 주세요.',fields:e.issues.map(i=>({path:i.path.join('.'),message:i.message}))}},400);
  if(e instanceof HttpError){if(uid&&wid&&(e.status===403||e.status===404))console.warn(JSON.stringify({event:'access.denied',user:uid,workspace:wid,code:e.code}));return json({error:{code:e.code,message:e.message}},e.status)}
  console.error('API failed',e instanceof Error?e.message:'unknown');return json({error:{code:'INTERNAL',message:'요청 처리에 실패했습니다. 입력을 보존한 상태로 다시 시도해 주세요.'}},500);
 }
}
