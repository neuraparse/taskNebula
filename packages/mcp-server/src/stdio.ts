/**
 * stdio entry point.
 *
 * This is what `npx @tasknebula/mcp-server` runs. Claude Desktop, Cursor,
 * and Claude Code spawn this process and speak MCP over stdin/stdout.
 */
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { TaskNebulaClient } from './client.js';
import { resolveStdioAuth, clientOptionsFromStdio } from './auth.js';
import { createMcpServer } from './server.js';

export async function runStdio(): Promise<void> {
  const auth = resolveStdioAuth(process.env);
  const client = new TaskNebulaClient(clientOptionsFromStdio(auth));
  const server = createMcpServer({ client });
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // The transport keeps the event loop alive until the parent closes stdin.
}
