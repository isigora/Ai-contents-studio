import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {interpretationInputSchema} from '../ai-intake';
import type {Database,Queryable} from './db';
import {aiConfiguration,AiError} from './ai-provider';
import {interpret} from './interpretation';
import {aiReservation,AiBudgetError} from './ai-budget';
export async function interpretationRoute(ctx:{db:Database,uid:string,wid:string,req:Request,id?:string,parse:(req:Request)=>Promise<any>,access:(uid:string,wid:string,write:boolean,q:Queryable)=>Promise<any>,fail:(status:number,code:string,message:string)=>never}):Promise<Response>{
 const {db,uid,wid,req,id,parse,access,fail}=ctx;
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
 const present=(row:any)=>({id:row.id,status:row.status,result:row.result,error_code:row.error_code,unconfirmed:true});
 if(req.method==='GET'&&id){
  const row=(await db.query('SELECT * FROM ai_interpretation WHERE workspace_id=$1 AND user_id=$2 AND id=$3',[wid,uid,id])).rows[0];
  if(!row)fail(404,'NOT_FOUND','자료를 찾을 수 없습니다.');return json(present(row));
 }
 if(req.method!=='POST'||id)fail(404,'NOT_FOUND','경로를 찾을 수 없습니다.');
 const input=interpretationInputSchema.parse(await parse(req));
 const key=z.string().min(8).max(100).parse(req.headers.get('idempotency-key'));
 const hash=createHash('sha256').update(JSON.stringify(input)).digest('hex');
 const reserved=await db.transaction(async q=>{
  await access(uid,wid,true,q);await q.query('SELECT id FROM workspace WHERE id=$1 FOR UPDATE',[wid]);
  const old=(await q.query('SELECT * FROM ai_interpretation WHERE workspace_id=$1 AND user_id=$2 AND request_key=$3',[wid,uid,key])).rows[0];
  if(old){if(old.request_hash!==hash)fail(409,'KEY_CONFLICT','다른 입력에 같은 요청 키를 사용할 수 없습니다.');return {old};}
  const config=aiConfiguration();if(!config)return fail(503,'AI_NOT_CONFIGURED','AI 제공자 설정이 필요합니다. 입력 자료는 유지됩니다.');
  let cost:number;try{cost=await aiReservation(q,wid);}catch(error){if(error instanceof AiBudgetError)return fail(429,'BUDGET_LIMIT','설정된 생성 예산 한도에 도달했거나 예산 설정이 올바르지 않습니다.');throw error;}
  const count=(await q.query("SELECT count(*)::int AS n FROM ai_interpretation WHERE workspace_id=$1 AND created_at>now()-interval '1 minute'",[wid])).rows[0].n;
  if(count>=10)fail(429,'RATE_LIMIT','요청이 많습니다. 잠시 후 다시 시도해 주세요.');
  const runId=randomUUID();
  await q.query("INSERT INTO ai_interpretation(id,workspace_id,user_id,request_key,request_hash,source,model,status,cost_estimate) VALUES($1,$2,$3,$4,$5,$6,$7,'running',$8)",[runId,wid,uid,key,hash,input.source,config.model,cost]);
  await q.query("INSERT INTO audit_event(id,user_id,workspace_id,action,entity_id) VALUES($1,$2,$3,'ai.intake.requested',$4)",[randomUUID(),uid,wid,runId]);
  return {runId};
 });
 if(reserved.old){
  const old=reserved.old;
  if(old.status==='succeeded')return json(present(old));
  if(old.status==='failed')fail(409,'PREVIOUS_RUN_FAILED','이전 해석 요청이 실패했습니다. 입력을 확인하고 새 요청으로 다시 시도해 주세요.');
  if(new Date(old.updated_at).getTime()<Date.now()-120000){
   await db.query("UPDATE ai_interpretation SET status='failed',error_code='INTERRUPTED',updated_at=now() WHERE id=$1 AND workspace_id=$2 AND status='running'",[old.id,wid]);
   fail(409,'INTERRUPTED','해석이 중단되었습니다. 입력을 확인하고 새 요청으로 다시 시도해 주세요.');
  }
  return json(present(old),202);
 }
 try{
  const output=await interpret(input.source);
  const result=await db.transaction(async q=>{
   await access(uid,wid,true,q);
   const row=(await q.query("UPDATE ai_interpretation SET status='succeeded',result=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3 AND status='running' RETURNING *",[JSON.stringify(output),wid,reserved.runId])).rows[0];
   if(!row)throw new AiError('AI_INTERRUPTED');
   await q.query("INSERT INTO audit_event(id,user_id,workspace_id,action,entity_id) VALUES($1,$2,$3,'ai.intake.succeeded',$4)",[randomUUID(),uid,wid,reserved.runId]);return row;
  });return json(present(result),201);
 }catch(error){
  const code=error instanceof AiError?error.message:'AI_INTERPRETATION_FAILED';
  await db.query("UPDATE ai_interpretation SET status='failed',error_code=$1,updated_at=now() WHERE workspace_id=$2 AND id=$3 AND status='running'",[code,wid,reserved.runId]);
  return fail(502,'INTERPRETATION_FAILED','AI 해석에 실패했습니다. 입력 자료는 유지됩니다. 결과를 확인한 뒤 새 요청으로 다시 시도해 주세요.');
 }
}
