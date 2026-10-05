/** Exact development proxy origin, never a wildcard or a disabled CSRF check. */
export function authOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const origins = (env.TRUSTED_ORIGINS || env.APP_URL || 'http://localhost:4173')
    .split(',').map(value => value.trim()).filter(Boolean);
  // The private forwarding path has been observed to present this exact origin.
  if (localCodespace(env)) origins.push('https://localhost:4173');
  return [...new Set(origins)];
}

function localCodespace(env: Record<string, string | undefined>): boolean {
  const name = env.CODESPACE_NAME;
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
  return Boolean(env.CODESPACES === 'true' && env.APP_MODE === 'local' &&
    env.NODE_ENV !== 'production' && !env.DATABASE_URL && name &&
    /^[a-z0-9-]+$/.test(name) && /^[a-z0-9.-]+$/.test(domain) &&
    env.APP_URL === `https://${name}-4173.${domain}`);
}

export function requestOriginAllowed(req: Request, env: Record<string, string | undefined> = process.env): boolean {
  const allowed = authOrigins(env);
  const origin = req.headers.get('origin');
  if (origin && allowed.includes(origin)) return true;
  // Match Better Auth's narrowly defined same-origin inference, only in guarded Codespaces.
  return localCodespace(env) && origin === 'null' && req.headers.get('sec-fetch-site') === 'same-origin' &&
    new URL(req.url).origin === 'https://localhost:4173';
}
