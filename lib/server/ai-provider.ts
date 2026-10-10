// Server-only adapter. Credentials and raw upstream errors never reach clients/logs.
export class AiError extends Error {}
export function aiConfiguration(){
 const adapter=process.env.AI_PROVIDER_ADAPTER||'contract';
 if(process.env.AI_ENABLED!=='true')return null;
 const endpoint=process.env.AI_PROVIDER_URL,key=process.env.AI_API_KEY,model=process.env.AI_MODEL;
 if(!endpoint||!key||!model||!['contract','chat-completions'].includes(adapter))return null;
 try{const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.hash)return null;}catch{return null;}
 return {endpoint,key,model,adapter};
}
async function boundedJson(response:Response){
 const reader=response.body?.getReader();if(!reader)throw new AiError('AI_OUTPUT_INVALID');
 const chunks:Uint8Array[]=[];let size=0;
 try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>100000){await reader.cancel();throw new AiError('AI_OUTPUT_INVALID');}chunks.push(part.value);}}
 finally{reader.releaseLock();}
 try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new AiError('AI_OUTPUT_INVALID');}
}
export async function requestAi(task:string,instructions:string,data:Record<string,unknown>){
 const config=aiConfiguration();if(!config)throw new AiError('AI_NOT_CONFIGURED');
 const body=config.adapter==='contract'?{model:config.model,task,instructions,...data}:{
  model:config.model,store:false,max_completion_tokens:2500,response_format:{type:'json_object'},
  messages:[{role:'system',content:instructions},{role:'user',content:JSON.stringify({task,...data})}]
 };
 try{
  const response=await fetch(config.endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.key},body:JSON.stringify(body),signal:AbortSignal.timeout(30000),redirect:'error'});
  if(!response.ok){
   // Read only a bounded error body; retain a fixed classification, never raw messages.
   let upstreamCode='';try{const error=await boundedJson(response);if(typeof error?.error?.code==='string')upstreamCode=error.error.code;}catch{}
   if(['insufficient_quota','billing_hard_limit_reached'].includes(upstreamCode))throw new AiError('AI_BILLING_QUOTA');
   const code=response.status===401?'AI_AUTH_FAILED':response.status===403?'AI_PERMISSION_DENIED':response.status===429?'AI_RATE_LIMIT':response.status===404?'AI_MODEL_UNAVAILABLE':response.status===400?'AI_REQUEST_INVALID':'AI_PROVIDER_FAILED';
   throw new AiError(code);
  }
  const raw=await boundedJson(response);
  if(config.adapter==='contract')return raw;
  const choice=raw?.choices?.[0];
  if(choice?.finish_reason==='length')throw new AiError('AI_OUTPUT_TRUNCATED');
  if(choice?.message?.refusal||choice?.finish_reason==='content_filter')throw new AiError('AI_REFUSAL');
  if(choice?.finish_reason!=='stop'||typeof choice.message?.content!=='string')throw new AiError('AI_OUTPUT_INVALID');
  try{return JSON.parse(choice.message.content);}catch{throw new AiError('AI_OUTPUT_INVALID');}
 }catch(error){if(error instanceof AiError)throw error;if(error instanceof Error&&error.name==='TimeoutError')throw new AiError('AI_TIMEOUT');throw new AiError('AI_REQUEST_FAILED');}
}
