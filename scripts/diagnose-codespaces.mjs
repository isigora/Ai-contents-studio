// Read-only local diagnostics: never opens the database or prints credentials/bodies.
import fs from 'node:fs';
import {parseEnv} from 'node:util';
import {pathToFileURL} from 'node:url';

export async function inspectEndpoint(url, kind, timeout = 5000) {
  try {
    const response = await fetch(url, {redirect:'manual', signal:AbortSignal.timeout(timeout)});
    const body = await response.text();
    if (response.status >= 300 && response.status < 400) return {ok:false, reason:'redirect', status:response.status};
    if (!response.ok) return {ok:false, reason:'http-error', status:response.status};
    if (response.headers.get('content-disposition')?.toLowerCase().includes('attachment')) return {ok:false, reason:'download-response'};
    if (!body.trim()) return {ok:false, reason:'empty-response'};
    const type = response.headers.get('content-type')?.toLowerCase() || '';
    if (kind === 'studio') {
      if (!type.includes('text/html')) return {ok:false, reason:'wrong-content-type'};
      if (!body.includes('Content Studio')) return {ok:false, reason:'unexpected-page'};
    } else {
      if (!type.includes('application/json')) return {ok:false, reason:'wrong-content-type'};
      try { if (JSON.parse(body) !== null) return {ok:false, reason:'unexpected-session'}; }
      catch { return {ok:false, reason:'invalid-json'}; }
    }
    return {ok:true, reason:'ready'};
  } catch { return {ok:false, reason:'connection-failed-or-timeout'}; }
}

export async function diagnose() {
  const env = fs.existsSync('.env.local') ? parseEnv(fs.readFileSync('.env.local','utf8')) : {};
  const name = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
  const expected = name ? `https://${name}-4173.${domain}` : 'http://localhost:4173';
  const [studio, auth] = await Promise.all([
    inspectEndpoint('http://127.0.0.1:4173/studio','studio'),
    inspectEndpoint('http://127.0.0.1:4173/api/auth/get-session','auth'),
  ]);
  const config = {
    codespaces:process.env.CODESPACES === 'true',
    localMode:env.APP_MODE === 'local',
    appUrlMatches:env.APP_URL === expected,
    trustedOriginMatches:(env.TRUSTED_ORIGINS || '').split(',').includes(expected),
    secretConfigured:typeof env.BETTER_AUTH_SECRET === 'string' && env.BETTER_AUTH_SECRET.length >= 32,
    externalDatabaseConfigured:Boolean(env.DATABASE_URL || process.env.DATABASE_URL),
    reviewCredentialFilePresent:fs.existsSync('.data/dev-test-login.json'),
  };
  const ready = studio.ok && auth.ok && config.localMode && config.appUrlMatches && config.trustedOriginMatches && config.secretConfigured;
  return {ready, config, studio, auth, forwardedBrowserVerified:false,
    next:ready ? 'Local service is ready. Open PRIVATE port 4173 from Codespaces Ports in your signed-in browser. Forwarding and browser login still require verification.' : 'Inspect the failing checks and .data/dev-server.log privately. Do not delete the database or start a second server on an occupied port.'};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { const report = await diagnose(); console.log(JSON.stringify(report,null,2)); process.exitCode=report.ready?0:1; }
  catch { console.error('Cannot inspect local configuration. Do not share its contents.'); process.exitCode=1; }
}
