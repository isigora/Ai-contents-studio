import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {S3Client,PutObjectCommand,GetObjectCommand,DeleteObjectCommand} from '@aws-sdk/client-s3';
function objectPath(key:string){if(!/^[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+$/.test(key))throw new Error('Invalid object key');return path.join(process.env.LOCAL_DATA_DIR||'.data','objects',key)}
function s3(){return new S3Client({endpoint:process.env.S3_ENDPOINT,region:process.env.S3_REGION||'auto',forcePathStyle:true,credentials:{accessKeyId:process.env.S3_ACCESS_KEY_ID!,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}})}
export async function putObject(key:string,bytes:Uint8Array,mime:string){if(process.env.S3_BUCKET){await s3().send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:bytes,ContentType:mime}));return}if(process.env.APP_MODE!=='local')throw new Error('OBJECT_STORAGE_NOT_CONFIGURED');const p=objectPath(key);await mkdir(path.dirname(p),{recursive:true});await writeFile(p,bytes)}
export async function getObject(key:string){if(process.env.S3_BUCKET){const r=await s3().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));return await r.Body!.transformToByteArray()}if(process.env.APP_MODE!=='local')throw new Error('OBJECT_STORAGE_NOT_CONFIGURED');return readFile(objectPath(key))}
export async function deleteObject(key:string){if(process.env.S3_BUCKET){await s3().send(new DeleteObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));return}await unlink(objectPath(key)).catch(()=>{})}
export function inspectFile(bytes:Uint8Array,name:string){
 const b=Buffer.from(bytes),ext=name.toLowerCase().split('.').pop();
 if(ext==='png'&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return {mime:'image/png',status:'quarantined'};
 if(['jpg','jpeg'].includes(ext||'')&&b[0]===255&&b[1]===216&&b[2]===255)return {mime:'image/jpeg',status:'quarantined'};
 if(ext==='pdf'&&b.subarray(0,5).toString()==='%PDF-')return {mime:'application/pdf',status:'quarantined'};
 if(ext==='txt'){const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.includes('\0'))throw new Error('FILE_TYPE');return {mime:'text/plain',status:'ready'}}
 throw new Error('FILE_TYPE');
}
