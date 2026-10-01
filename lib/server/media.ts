import sharp, {type OverlayOptions} from 'sharp';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const exec=promisify(execFile);
const escape=(s:string)=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
let active=0;
export type MediaFile={name:string,mime:string,bytes:Uint8Array};
export async function textLayer(text:string,width:number,maxHeight:number,size:number,color='#141619'){
 const fontfile=process.env.MEDIA_FONT_PATH||path.join(process.cwd(),'vendor/fonts/NotoSansCJK-Regular.ttc');
 await access(fontfile);
 // Escape all user text before passing Pango markup. Never interpret user SVG/HTML.
 for(let fontSize=size;fontSize>=20;fontSize-=2){
  const result=await sharp({text:{text:`<span foreground="${color}">${escape(text)}</span>`,font:`Noto Sans CJK KR ${fontSize}`,fontfile,width,wrap:'word-char',rgba:true,spacing:8,dpi:72}}).png().toBuffer({resolveWithObject:true});
  if(result.info.height<=maxHeight)return result.data;
 }
 throw new Error('MEDIA_TEXT_TOO_LONG');
}
export function subtitles(scenes:string[]){return scenes.map((s,i)=>`${i+1}\n00:00:${String(i*3).padStart(2,'0')},000 --> 00:00:${String((i+1)*3).padStart(2,'0')},000\n${s.replace(/[\r\n]+/g,' ')}\n`).join('\n')}
async function card(photo:Uint8Array,scenes:string[],portrait:boolean,slide?:number){
 const width=1080,height=portrait?1920:1080,photoHeight=portrait?920:430;
 const pic=await sharp(photo,{limitInputPixels:24000000}).resize(984,photoHeight,{fit:'contain',background:'#f5f6f8'}).png().toBuffer();
 const title=slide===undefined?scenes[0]:scenes[slide];
 const layers:OverlayOptions[]=[{input:pic,left:48,top:90},
 {input:await textLayer('CONTENT STUDIO / DRAFT',950,36,22,'#63708a'),left:48,top:35},
 {input:await textLayer(title,960,portrait?340:210,58),left:60,top:photoHeight+135}];
 if(slide===undefined){layers.push({input:await textLayer(scenes[1],960,portrait?280:140,32,'#526075'),left:60,top:portrait?1450:780});}
 layers.push({input:await textLayer(scenes[2],960,110,30,'#3155f5'),left:60,top:height-150});
 return sharp({create:{width,height,channels:3,background:'#ffffff'}}).composite(layers).png().toBuffer();
}
export async function renderMedia(photo:Uint8Array,scenes:string[],kind:'cards'|'video'):Promise<MediaFile[]>{
 if(active>=2)throw new Error('MEDIA_BUSY');active++;
 let tmp:string|undefined;
 try{
  const files:MediaFile[]=[{name:'square.png',mime:'image/png',bytes:await card(photo,scenes,false)}, {name:'portrait.png',mime:'image/png',bytes:await card(photo,scenes,true)}];
  if(kind==='video'){
   tmp=await mkdtemp(path.join(os.tmpdir(),'studio-media-'));
   for(let i=0;i<3;i++)await writeFile(path.join(tmp,`slide${i}.png`),await card(photo,scenes,true,i));
   await writeFile(path.join(tmp,'slides.txt'),"file 'slide0.png'\nduration 3\nfile 'slide1.png'\nduration 3\nfile 'slide2.png'\nduration 3\nfile 'slide2.png'\n");
   await exec(process.env.FFMPEG_PATH||'ffmpeg',['-hide_banner','-loglevel','error','-y','-f','concat','-safe','1','-i','slides.txt','-vf','fps=24,scale=720:1280:flags=lanczos,format=yuv420p','-t','9','-c:v','libx264','-threads','2','-preset','veryfast','-crf','26','-movflags','+faststart','video.mp4'],{cwd:tmp,timeout:120000,maxBuffer:1024*1024});
   files.push({name:'video.mp4',mime:'video/mp4',bytes:await readFile(path.join(tmp,'video.mp4'))},{name:'subtitles.srt',mime:'text/plain; charset=utf-8',bytes:Buffer.from(subtitles(scenes),'utf8')});
  }
  return files;
 }finally{active--;if(tmp)await rm(tmp,{recursive:true,force:true})}
}
