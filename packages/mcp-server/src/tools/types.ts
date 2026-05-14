import { z, type ZodTypeAny } from 'zod';
import type { TaskNebulaClient } from '../client.js';

/**
 * Internal tool definition shared between stdio and HTTP transports.
 *
 * We deliberately keep this independent of any specific MCP SDK type so
 * that:
 *   - Tools can be unit-tested without instantiating an MCP server.
 *   - The same definitions can be reused from the Next.js HTTP route.
 */
export interface ToolDefinition<Input extends ZodTypeAny = ZodTypeAny> {
  /** Tool name, e.g. `search_issues`. Must be unique. */
  name: string;
  /** One-line, human-readable description shown to the model. */
  description: string;
  /** Zod schema for the tool input. */
  inputSchema: Input;
  /**
   * Implementation. Receives the validated input and a TaskNebula REST
   * client and returns the tool result (a JSON-serializable value).
   */
  handler: (
    input: z.infer<Input>,
    ctx: { client: TaskNebulaClient },
  ) => Promise<unknown>;
}

/**
 * Type-erased tool definition for registries. Because TypeScript
 * function parameters are contravariant, we cannot directly assign
 * `ToolDefinition<Specific>` to a wider `ToolDefinition<ZodTypeAny>`.
 * Instead the registry stores tools as `AnyToolDefinition`, whose
 * handler accepts `unknown` and is expected to parse the input itself.
 *
 * Use {@link toAnyTool} to convert a strongly-typed `ToolDefinition`
 * into this erased form.
 */
export interface AnyToolDefinition {
  name: string;
  description: string;
  inputSchema: ZodTypeAny;
  handler: (input: unknown, ctx: { client: TaskNebulaClient }) => Promise<unknown>;
}

/** Erase a strongly-typed tool into the registry-friendly form. */
export function toAnyTool<Input extends ZodTypeAny>(
  tool: ToolDefinition<Input>,
): AnyToolDefinition {
  return {
    name: tool.name,
    description: tool.description,
    inputSchema: tool.inputSchema,
    handler: (input, ctx) => tool.handler(tool.inputSchema.parse(input), ctx),
  };
}

/** Render a tool result into the MCP `content` array (text only for now). */
export function toMcpContent(value: unknown): Array<{ type: 'text'; text: string }> {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  return [{ type: 'text', text }];
}
