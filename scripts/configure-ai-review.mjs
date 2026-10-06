import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export function configureReview(dir,env){
 const file=path.join(dir,'.env.local');
 if(env.CODESPACES!=='true'||!/^[-a-z0-9]+$/.test(env.CODESPACE_NAME||''))throw new Error('Use only inside the existing development Codespace.');
 if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink())throw new Error('Existing private configuration is required; symbolic links are not supported.');
 const before=fs.readFileSync(file,'utf8'),values={};
 for(const line of before.split('\n')){const m=line.match(/^([A-Z_]+)=(.*)$/);if(m)values[m[1]]=m[2].replace(/^(["'])(.*)\1$/,'$2');}
 if(values.APP_MODE!=='local'||values.DATABASE_URL||env.DATABASE_URL||env.NODE_ENV==='production')throw new Error('Production and external databases are not supported by review setup.');
 const domain=env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN||'app.github.dev';
 if(!/^[a-z0-9.-]+$/.test(domain)||values.APP_URL!==`https://${env.CODESPACE_NAME}-4173.${domain}`)throw new Error('Codespace origin mismatch; preserve existing configuration.');
 const credential=env.OPENAI_API_KEY||values.AI_API_KEY;
 if(!credential||/[\r\n\s]/.test(credential))throw new Error('Set a private OPENAI_API_KEY Codespaces secret first. No configuration was changed.');
 if(!env.OPENAI_API_KEY&&values.AI_PROVIDER_URL&&values.AI_PROVIDER_URL!=='https://api.openai.com/v1/chat/completions')throw new Error('Existing provider is different; configuration preserved.');
 const profile={AI_PROVIDER_ADAPTER:'chat-completions',AI_PROVIDER_URL:'https://api.openai.com/v1/chat/completions',AI_MODEL:'gpt-4.1-mini',AI_RUN_RESERVATION_USD:'0.10',AI_DAILY_LIMIT_USD:'0.50',AI_MONTHLY_LIMIT_USD:'10',AI_API_KEY:credential,AI_ENABLED:'true'};
 let after=before;
 for(const [key,value] of Object.entries(profile)){const regex=new RegExp(`^${key}=.*(?:\\n|$)`,'gm');after=after.replace(regex,'');after+=`${after.endsWith('\n')?'':'\n'}${key}=${value}\n`;}
 // Atomic replacement: auth secret/origins/DB/storage and all unrelated settings preserved.
 const tmp=file+'.ai-review-tmp';const fd=fs.openSync(tmp,'wx',0o600);
 try{fs.writeFileSync(fd,after);fs.fsyncSync(fd);fs.closeSync(fd);fs.renameSync(tmp,file);fs.chmodSync(file,0o600);}catch(e){try{fs.closeSync(fd);}catch{}try{fs.unlinkSync(tmp);}catch{}throw e;}
 return {provider:'OpenAI',model:profile.AI_MODEL,dailyReservationUSD:0.5,monthlyReservationUSD:10};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const result=configureReview(process.cwd(),process.env);console.log(JSON.stringify(result));console.log('Private review configuration saved. Restart the existing server; no API call was made.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
