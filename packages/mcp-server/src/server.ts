/**
 * Build an `McpServer` instance from the shared tool / resource / prompt
 * definitions.
 *
 * Both transports (stdio and HTTP/Streamable) use this factory so that
 * the model sees exactly the same surface area regardless of how it
 * connected.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

import { TaskNebulaClient } from './client.js';
import { allTools } from './tools/index.js';
import { resourceTemplates } from './resources.js';
import { allPrompts } from './prompts.js';
import { toMcpContent } from './tools/types.js';

export const SERVER_NAME = '@tasknebula/mcp-server';
export const SERVER_VERSION = '0.1.0';

export interface CreateServerOptions {
  client: TaskNebulaClient;
}

export function createMcpServer(opts: CreateServerOptions): McpServer {
  const { client } = opts;
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {}, resources: {}, prompts: {} } },
  );

  // -- Tools --------------------------------------------------------------
  for (const tool of allTools) {
    // The MCP SDK accepts a ZodRawShape (object) for `inputSchema`. Our
    // tool inputs are all `z.object(...)`, so we expose `.shape` here.
    const shape = (tool.inputSchema as unknown as z.ZodObject<z.ZodRawShape>).shape;
    server.tool(
      tool.name,
      tool.description,
      shape,
      async (args: unknown) => {
        try {
          // `tool.handler` parses internally (see `toAnyTool`).
          const result = await tool.handler(args, { client });
          return { content: toMcpContent(result) };
        } catch (err) {
          return {
            isError: true,
            content: toMcpContent({
              error: err instanceof Error ? err.message : String(err),
            }),
          };
        }
      },
    );
  }

  // -- Resources ----------------------------------------------------------
  for (const tmpl of resourceTemplates) {
    server.resource(
      tmpl.name,
      tmpl.uriTemplate,
      { description: tmpl.description, mimeType: tmpl.mimeType },
      async (uri: URL) => {
        const data = await tmpl.read(uri.toString(), { client });
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: tmpl.mimeType,
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      },
    );
  }

  // -- Prompts ------------------------------------------------------------
  for (const prompt of allPrompts) {
    const shape = (prompt.argsSchema as unknown as z.ZodObject<z.ZodRawShape>).shape;
    server.prompt(
      prompt.name,
      prompt.description,
      shape,
      async (args: unknown) => {
        const parsed = prompt.argsSchema.parse(args ?? {});
        return { messages: prompt.build(parsed) };
      },
    );
  }

  return server;
}
