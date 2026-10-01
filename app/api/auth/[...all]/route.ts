import {getAuth} from '@/lib/server/auth';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(req:Request){return (await getAuth()).handler(req)}
export async function POST(req:Request){return (await getAuth()).handler(req)}
