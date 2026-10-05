/** Exact development proxy origin, never a wildcard or a disabled CSRF check. */
export function authOrigins(env: Record<string, string | undefined> = process.env): string[] {
  const origins = (env.TRUSTED_ORIGINS || env.APP_URL || 'http://localhost:4173')
    .split(',').map(value => value.trim()).filter(Boolean);
  const name = env.CODESPACE_NAME;
  const domain = env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN || 'app.github.dev';
  const isLocalCodespace = env.CODESPACES === 'true' && env.APP_MODE === 'local' &&
    env.NODE_ENV !== 'production' && !env.DATABASE_URL && name &&
    /^[a-z0-9-]+$/.test(name) && /^[a-z0-9.-]+$/.test(domain) &&
    env.APP_URL === `https://${name}-4173.${domain}`;
  // The private forwarding path has been observed to present this exact origin.
  if (isLocalCodespace) origins.push('https://localhost:4173');
  return [...new Set(origins)];
}
