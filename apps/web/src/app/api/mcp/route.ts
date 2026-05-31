import { createMcpHttpHandler } from '@tasknebula/mcp-server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHttpHandler();

export const GET = handler;
export const POST = handler;
