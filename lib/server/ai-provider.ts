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
  if(!response.ok){await response.body?.cancel();throw new AiError('AI_PROVIDER_FAILED');}
  const raw=await boundedJson(response);
  if(config.adapter==='contract')return raw;
  const choice=raw?.choices?.[0];
  if(choice?.finish_reason!=='stop'||choice.message?.refusal||typeof choice.message?.content!=='string')throw new AiError('AI_OUTPUT_INVALID');
  try{return JSON.parse(choice.message.content);}catch{throw new AiError('AI_OUTPUT_INVALID');}
 }catch(error){if(error instanceof AiError)throw error;throw new AiError('AI_REQUEST_FAILED');}
}
