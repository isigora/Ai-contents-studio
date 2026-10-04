// No secrets or response bodies are logged. Works against loopback only by default.
export async function checkReady(base = 'http://localhost:4173') {
  const page = await fetch(base + '/studio', {signal: AbortSignal.timeout(5000), redirect:'error'});
  if (!page.ok || !page.headers.get('content-type')?.includes('text/html') ||
      page.headers.get('content-disposition')?.includes('attachment') ||
      !(await page.text()).includes('Content Studio')) throw new Error('Studio HTML is not ready');
  const session = await fetch(base + '/api/auth/get-session', {signal: AbortSignal.timeout(5000), redirect:'error'});
  if (!session.ok || !session.headers.get('content-type')?.includes('application/json')) throw new Error('Authentication service is not ready');
  if (await session.json() !== null) throw new Error('Unexpected anonymous session response');
}
if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  try { await checkReady(); console.log('Studio HTML and authentication service are ready.'); }
  catch { console.error('Studio or authentication service is unavailable. Inspect .data/dev-server.log privately.'); process.exitCode=1; }
}
