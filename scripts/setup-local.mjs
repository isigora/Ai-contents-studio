import fs from 'node:fs';import crypto from 'node:crypto';
if(fs.existsSync('.env.local')){console.log('.env.local already exists; preserved.');process.exit(0)}
fs.writeFileSync('.env.local',`APP_MODE=local\nAPP_URL=http://localhost:4173\nTRUSTED_ORIGINS=http://localhost:4173\nBETTER_AUTH_SECRET=${crypto.randomBytes(32).toString('hex')}\nAI_ENABLED=false\n`,{mode:0o600});
console.log('Local configuration created. No paid AI calls are enabled.');
