// Node runtime is required by the specification's PostgreSQL/auth/storage adapters.
const args=process.argv.slice(2);const p=args.indexOf('--port');const port=p>=0?args[p+1]:(process.env.PORT||'4173');
process.argv=[process.execPath,'next','dev','--webpack','--hostname','0.0.0.0','--port',port];
await import('next/dist/bin/next');
