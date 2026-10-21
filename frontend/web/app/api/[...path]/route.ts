import { proxyApiRequest } from '../../../lib/server/api-proxy';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  return proxyApiRequest(request, path);
}

export { handle as GET, handle as HEAD, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
