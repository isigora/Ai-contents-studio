import fs from 'node:fs';
import crypto from 'node:crypto';

const file = '.env.local';
const previous = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const name = process.env.CODESPACE_NAME;
const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
if (name && (!/^[a-z0-9-]+$/.test(name) || !/^[a-z0-9.-]+$/.test(domain))) {
  throw new Error('Invalid Codespaces hostname');
}
const url = name ? `https://${name}-4173.${domain}` : 'http://localhost:4173';
const values = {
  APP_MODE: 'local',
  APP_URL: url,
  TRUSTED_ORIGINS: [...new Set([url, 'http://localhost:4173'])].join(','),
};
let content = previous;
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp(`^${key}=.*$`, 'm');
  content = pattern.test(content) ? content.replace(pattern, `${key}=${value}`) : `${content}\n${key}=${value}`;
}
if (!/^BETTER_AUTH_SECRET=.{32,}$/m.test(content)) {
  content = content.replace(/^BETTER_AUTH_SECRET=.*\n?/m, '');
  content += `\nBETTER_AUTH_SECRET=${crypto.randomBytes(32).toString('hex')}\n`;
}
if (!/^AI_ENABLED=/m.test(content)) content += '\nAI_ENABLED=false\n';
fs.writeFileSync(file, content.trim() + '\n', {mode: 0o600});
fs.chmodSync(file, 0o600);
console.log(`Test environment configured: ${url}`);
console.log('Database and uploads persist under .data. Keep port 4173 private.');
