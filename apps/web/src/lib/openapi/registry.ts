/**
 * OpenAPI registry
 *
 * Central place where Zod schemas and route metadata are registered.
 * Routes are added by side-effect when `./routes/index.ts` is imported.
 *
 * To register a new route, see `src/lib/openapi/README.md`.
 */

import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
  extendZodWithOpenApi,
} from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Add `.openapi()` to all zod schemas (idempotent).
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Default tag set — referenced by registered routes.
export const TAGS = {
  Issues: 'Issues',
  Comments: 'Comments',
  Transitions: 'Transitions',
  Projects: 'Projects',
  Cycles: 'Cycles',
  Users: 'Users',
  Search: 'Search',
  Health: 'Health',
} as const;

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

// Subset of @asteasolutions/zod-to-openapi RouteConfig that callers need to
// provide. We accept loose typing for `request`/`responses` to avoid coupling
// route definitions to the library's internal types — the underlying call still
// validates the shape.
export interface RegisterRouteInput {
  method: HttpMethod;
  path: string;
  summary: string;
  description?: string;
  tags?: string[];
  request?: {
    params?: z.ZodTypeAny;
    query?: z.ZodTypeAny;
    body?: {
      description?: string;
      required?: boolean;
      content: { 'application/json': { schema: z.ZodTypeAny } };
    };
  };
  responses: Record<string, {
    description: string;
    content?: { 'application/json': { schema: z.ZodTypeAny } };
  }>;
  security?: Array<Record<string, string[]>>;
}

/**
 * Register an HTTP route with the OpenAPI registry.
 *
 * The default security requirement is `cookieAuth` (NextAuth session cookie).
 * Pass `security: []` to mark a route as public.
 */
export function registerRoute(input: RegisterRouteInput) {
  registry.registerPath({
    method: input.method,
    path: input.path,
    summary: input.summary,
    description: input.description,
    tags: input.tags,
    request: input.request as any,
    responses: input.responses as any,
    security: input.security ?? [{ cookieAuth: [] }],
  });
}

/**
 * Build the OpenAPI 3.1 document from the populated registry.
 *
 * IMPORTANT: callers must have already imported `./routes` so that route
 * registrations have run as a side-effect.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildOpenApiDocument(opts?: { version?: string }): any {
  // Register the session cookie auth scheme once. registerComponent is
  // idempotent on identical inputs across hot reloads in dev.
  try {
    registry.registerComponent('securitySchemes', 'cookieAuth', {
      type: 'apiKey',
      in: 'cookie',
      // Both prod (`__Secure-`) and dev (`authjs.session-token`) NextAuth
      // cookies map to the same conceptual scheme. We document the prod name.
      name: '__Secure-authjs.session-token',
      description:
        'NextAuth session cookie. In dev the cookie is named `authjs.session-token`.',
    });
  } catch {
    // already registered — ignore
  }

  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'TaskNebula API',
      version: opts?.version ?? process.env.npm_package_version ?? '0.0.0',
      description:
        'OpenAPI documentation for the TaskNebula HTTP API. Only the public, stable surface is documented; internal/admin routes are intentionally omitted.',
    },
    servers: [
      {
        url: '/',
        description: 'Current host',
      },
    ],
  });
}
