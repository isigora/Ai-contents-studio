import {z} from 'zod';
import {randomUUID,createHash} from 'node:crypto';
import type {Database,Queryable,Row} from './db';
import {getObject,putObject,deleteObject} from './storage';
import {renderMedia} from './media';
import {channels,templateVersion,channelTargets} from '../templates';
type Context={db:Database,uid:string,wid:string,workspace:Row,resource:string,id:string,path:string[],method:string,req:Request,parse:(r:Request)=>Promise<any>,access:(uid:string,wid:string,write?:boolean,q?:Queryable)=>Promise<Row>,fullContent:(q:Queryable,wid:string,id:string)=>Promise<any>,own:(q:Queryable,t:string,wid:string,id:string)=>Promise<Row>,audit:(q:Queryable,uid:string,wid:string,action:string,id?:string)=>Promise<void>,fail:(status:number,code:string,message:string)=>never};
const json=(value:any,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store'}});
const keySchema=z.string().regex(/^[\w-]{8,100}$/);
export async function p1Route(c:Context):Promise<Response|undefined>{
 const {db,uid,wid,workspace,resource,id,path,method,req,parse,access,fullContent,own,audit,fail}=c;
 if(resource==='templates'&&method==='GET')return json({version:templateVersion,channels,editorialTargets:channelTargets});
 if(resource==='contents'&&id&&path[4]==='review'&&method==='POST'){
  const p=z.object({action:z.enum(['submit','approve','request_changes','withdraw']),version:z.number().int().positive(),note:z.string().trim().max(1000).default('')}).parse(await parse(req));
  await db.transaction(async q=>{
   const w=await access(uid,wid,true,q);await q.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE',[wid]);
   await q.query('SELECT id FROM content WHERE workspace_id=$1 AND id=$2 FOR UPDATE',[wid,id]);
   const item=await fullContent(q,wid,id);if(item.current_version!==p.version)fail(409,'REVISION_CONFLICT','현재 버전을 다시 불러온 뒤 검토해 주세요.');
   const state=item.workflow?.state||'draft';let next='draft',version=p.version;
   if(p.action==='submit'){if(!['draft','changes_requested'].includes(state))fail(409,'REVIEW_STATE','이 버전은 이미 검토 중이거나 승인되었습니다.');next='pending'}
   if(p.action==='approve'||p.action==='request_changes'){
    if(w.role!=='owner')fail(403,'OWNER_REQUIRED','작업공간 소유자만 승인하거나 수정을 요청할 수 있습니다.');
    if(state!=='pending')fail(409,'REVIEW_STATE','승인 요청된 버전만 처리할 수 있습니다.');
    if(p.action==='request_changes'&&!p.note)fail(400,'REVIEW_NOTE','수정할 내용을 적어 주세요.');
    next=p.action==='approve'?'approved':'changes_requested';
   }
   if(p.action==='withdraw'&&!['pending','approved'].includes(state))fail(409,'REVIEW_STATE','검토 중 또는 승인된 버전만 회수할 수 있습니다.');
   if(next==='approved'){
    if(item.stale)fail(409,'SOURCE_CHANGED','원천 정보가 바뀌었습니다. 새 정보로 재생성한 뒤 승인해 주세요.');
    version++;
    await q.query('INSERT INTO content_version(id,workspace_id,content_id,version,title,body,annotations,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[randomUUID(),wid,id,version,item.latest.title,item.latest.body,JSON.stringify({...item.latest.annotations,approved:true,approved_from_version:p.version}),uid]);
    await q.query("UPDATE content SET current_version=$1,status='reviewed',updated_at=now() WHERE workspace_id=$2 AND id=$3",[version,wid,id]);
   }
   await q.query('INSERT INTO content_workflow(workspace_id,content_id,version,state) VALUES($1,$2,$3,$4) ON CONFLICT(workspace_id,content_id) DO UPDATE SET version=excluded.version,state=excluded.state,updated_at=now()',[wid,id,version,next]);
   await q.query('INSERT INTO review_event(id,workspace_id,content_id,version,action,note,actor_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[randomUUID(),wid,id,version,p.action,p.note,uid]);
   await q.query('UPDATE content SET updated_at=now() WHERE workspace_id=$1 AND id=$2',[wid,id]);
   await audit(q,uid,wid,'content.'+p.action,id);
  });return json(await fullContent(db,wid,id));
 }
 if(resource==='contents'&&id&&path[4]==='reuse'&&method==='POST'){
  const p=z.object({version:z.number().int().positive()}).parse(await parse(req));
  const newId=await db.transaction(async q=>{
   await access(uid,wid,true,q);const item=await fullContent(q,wid,id);
   const version=item.versions.find((v:any)=>v.version===p.version);if(!version)fail(404,'NOT_FOUND','버전을 찾을 수 없습니다.');
   const nid=randomUUID();
   await q.query('INSERT INTO content(id,workspace_id,offering_id,audience_id,settings,source_snapshot,source_revision,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[nid,wid,item.offering_id,item.audience_id,JSON.stringify(item.settings),JSON.stringify(item.source_snapshot),item.source_revision,uid]);
   await q.query('INSERT INTO content_version(id,workspace_id,content_id,version,title,body,annotations,created_by) VALUES($1,$2,$3,1,$4,$5,$6,$7)',[randomUUID(),wid,nid,version.title,version.body,JSON.stringify({...version.annotations,approved:false,reviewed:false,reused_from:{content_id:id,version:p.version}}),uid]);
   await audit(q,uid,wid,'content.reused',nid);return nid;
  });return json(await fullContent(db,wid,newId),201);
 }
 if(resource==='media'){
  if(method==='GET'){
   if(!id){const result=(await db.query('SELECT id,content_id,version,asset_id,status,manifest,error_code,created_at FROM media_job WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100',[wid])).rows;return json(result.map(publicJob));}
   const job=(await db.query('SELECT * FROM media_job WHERE workspace_id=$1 AND id=$2',[wid,id])).rows[0];if(!job)fail(404,'NOT_FOUND','제작물을 찾을 수 없습니다.');
   if(path[4]==='download'){
    const name=new URL(req.url).searchParams.get('file');const file=job.manifest.files?.find((f:any)=>f.name===name);
    if(job.status!=='succeeded'||!file)fail(404,'NOT_FOUND','완성된 파일을 찾을 수 없습니다.');
    return new Response(new Uint8Array(await getObject(file.key)),{headers:{'Content-Type':file.mime,'Content-Disposition':`attachment; filename="${file.name}"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
   }
   return json(publicJob(job));
  }
  if(method==='POST'){
   const p=z.object({content_id:z.string().min(1).max(100),version:z.number().int().positive(),asset_id:z.string().min(1).max(100),kind:z.enum(['cards','video']),scenes:z.array(z.string().trim().min(1).max(160).refine(s=>!/[\u0000-\u001f]/.test(s),'한 줄로 입력하세요.')).length(3)}).parse(await parse(req));
   const key=keySchema.parse(req.headers.get('idempotency-key')),hash=createHash('sha256').update(JSON.stringify(p)).digest('hex');
   const reserved=await db.transaction(async q=>{
    await q.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE',[wid]);await access(uid,wid,true,q);
    const old=(await q.query('SELECT * FROM media_job WHERE workspace_id=$1 AND request_key=$2',[wid,key])).rows[0];
    if(old?.status==='running'&&new Date(old.updated_at).getTime()<Date.now()-300000){await q.query("UPDATE media_job SET status='failed',error_code='INTERRUPTED',updated_at=now() WHERE workspace_id=$1 AND id=$2",[wid,old.id]);return {old:{...old,status:'failed'}};}
    if(old){if(old.request_hash!==hash)fail(409,'IDEMPOTENCY_CONFLICT','같은 요청 키로 다른 미디어를 만들 수 없습니다.');return {old};}
    await q.query("UPDATE media_job SET status='failed',error_code='INTERRUPTED',updated_at=now() WHERE workspace_id=$1 AND status='running' AND updated_at<now()-interval '5 minutes'",[wid]);
    const running=(await q.query("SELECT count(*)::int AS n FROM media_job WHERE workspace_id=$1 AND status='running'",[wid])).rows[0].n;
    const recent=(await q.query("SELECT count(*)::int AS n FROM media_job WHERE workspace_id=$1 AND created_at>now()-interval '1 minute'",[wid])).rows[0].n;
    if(running||recent>=3)fail(429,'MEDIA_LIMIT','진행 중인 제작이 끝나거나 잠시 지난 뒤 다시 시도해 주세요.');
    const item=await fullContent(q,wid,p.content_id),version=item.versions.find((v:any)=>v.version===p.version);
    if(!version)fail(404,'NOT_FOUND','콘텐츠 버전을 찾을 수 없습니다.');
    const corpus=(version.title+'\n'+version.body).replace(/\s+/g,' ');
    if(p.scenes.some(s=>!corpus.includes(s.replace(/\s+/g,' '))))fail(400,'MEDIA_EXCERPT','문구는 선택한 저장 버전의 제목·본문에서 그대로 발췌해 주세요. 수정 문구는 먼저 새 버전으로 저장하세요.');
    const photo=await own(q,'asset',wid,p.asset_id);if(photo.status!=='ready'||photo.mime!=='image/png')fail(400,'MEDIA_ASSET','사용 가능한 사진 자산을 선택해 주세요.');
    if(!photo.rights_note.trim())fail(400,'MEDIA_RIGHTS','사진의 사용권·출처 메모를 등록한 뒤 제작해 주세요.');
    const jid=randomUUID();await q.query("INSERT INTO media_job(id,workspace_id,content_id,version,asset_id,request_key,request_hash,status,created_by,manifest) VALUES($1,$2,$3,$4,$5,$6,$7,'running',$8,$9)",[jid,wid,p.content_id,p.version,p.asset_id,key,hash,uid,JSON.stringify({kind:p.kind,scenes:p.scenes,derived_status:'draft',source_workflow:item.workflow.version===p.version?item.workflow:{state:'historical',version:p.version},state_at_creation:item.stale?'source_changed':'current',rights_note:photo.rights_note})]);return {jid,photo};
   });
   if(reserved.old){if(reserved.old.status==='failed')fail(409,'MEDIA_FAILED','이전 제작에 실패했습니다. 새 요청으로 다시 시도해 주세요.');return json(publicJob(reserved.old),reserved.old.status==='running'?202:200);}
   const written:string[]=[];
   try{
    const files=await renderMedia(await getObject(reserved.photo!.object_key),p.scenes,p.kind),manifestFiles:{name:string,key:string,mime:string,size:number}[]=[];
    for(const file of files){const objectKey=wid+'/'+randomUUID();await putObject(objectKey,file.bytes,file.mime);written.push(objectKey);manifestFiles.push({name:file.name,key:objectKey,mime:file.mime,size:file.bytes.length});}
    await db.transaction(async q=>{await access(uid,wid,true,q);await q.query("UPDATE media_job SET status='succeeded',manifest=manifest || $1::jsonb,updated_at=now() WHERE workspace_id=$2 AND id=$3 AND status='running'",[JSON.stringify({files:manifestFiles,duration_seconds:p.kind==='video'?9:0}),wid,reserved.jid]);await audit(q,uid,wid,'media.created',reserved.jid)});
    const job=(await db.query('SELECT * FROM media_job WHERE workspace_id=$1 AND id=$2',[wid,reserved.jid])).rows[0];return json(publicJob(job),201);
   }catch(e){await Promise.allSettled(written.map(deleteObject));const code=e instanceof Error&&e.message==='MEDIA_TEXT_TOO_LONG'?'MEDIA_TEXT_TOO_LONG':'MEDIA_RENDER_FAILED';await db.query("UPDATE media_job SET status='failed',error_code=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3",[code,wid,reserved.jid]);fail(503,code,code==='MEDIA_TEXT_TOO_LONG'?'문구가 카드에 들어가지 않습니다. 더 짧은 본문 구절을 선택해 주세요.':'제작에 실패했습니다. 사진·콘텐츠는 보존됩니다. FFmpeg와 글꼴 설정을 확인한 뒤 다시 시도해 주세요.');}
  }
 }
}
function publicJob(job:any){return {...job,request_hash:undefined,request_key:undefined,manifest:{...job.manifest,files:job.manifest.files?.map(({key,...f}:any)=>f)}}}
