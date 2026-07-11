import openApiSpec from '@/api/openapi.json';

export const API_DOC_METHODS = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
] as const;

export type ApiDocMethod = (typeof API_DOC_METHODS)[number];

export interface ApiDocParameter {
  name: string;
  in: string;
  required: boolean;
}

export interface ApiDocResponse {
  status: string;
  description: string | null;
}

export interface ApiDocOperation {
  id: string;
  method: ApiDocMethod;
  path: string;
  summary: string | null;
  description: string | null;
  tags: string[];
  parameters: ApiDocParameter[];
  hasRequestBody: boolean;
  requestBodyRequired: boolean;
  responses: ApiDocResponse[];
  requiresAuth: boolean;
}

interface OpenApiParameter {
  name?: string;
  in?: string;
  required?: boolean;
}

interface OpenApiResponse {
  description?: string;
}

interface OpenApiRequestBody {
  required?: boolean;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenApiParameter[];
  requestBody?: OpenApiRequestBody;
  responses?: Record<string, OpenApiResponse>;
  security?: Array<Record<string, unknown[]>>;
}

interface OpenApiPathItem {
  parameters?: OpenApiParameter[];
  get?: OpenApiOperation;
  post?: OpenApiOperation;
  put?: OpenApiOperation;
  patch?: OpenApiOperation;
  delete?: OpenApiOperation;
  options?: OpenApiOperation;
  head?: OpenApiOperation;
  trace?: OpenApiOperation;
}

export interface OpenApiDocument {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, OpenApiPathItem>;
  security?: Array<Record<string, unknown[]>>;
}

const METHOD_ORDER = new Map<ApiDocMethod, number>(
  API_DOC_METHODS.map((method, index) => [method, index]),
);

export function getApiDocsSpec(): OpenApiDocument {
  return openApiSpec as OpenApiDocument;
}

export function listApiDocOperations(spec: OpenApiDocument = getApiDocsSpec()): ApiDocOperation[] {
  const operations: ApiDocOperation[] = [];

  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of API_DOC_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;

      const parameters = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])]
        .filter((parameter) => parameter.name && parameter.in)
        .map((parameter) => ({
          name: parameter.name ?? '',
          in: parameter.in ?? '',
          required: parameter.required === true,
        }));

      const responses = Object.entries(operation.responses ?? {}).map(([status, response]) => ({
        status,
        description: response.description ?? null,
      }));

      const security = operation.security ?? spec.security ?? [];

      operations.push({
        id: `${method.toUpperCase()} ${path}`,
        method,
        path,
        summary: operation.summary ?? null,
        description: operation.description ?? null,
        tags: operation.tags ?? [],
        parameters,
        hasRequestBody: Boolean(operation.requestBody),
        requestBodyRequired: operation.requestBody?.required === true,
        responses,
        requiresAuth: security.length > 0,
      });
    }
  }

  return operations.sort((left, right) => {
    const pathSort = left.path.localeCompare(right.path);
    if (pathSort !== 0) return pathSort;
    return (METHOD_ORDER.get(left.method) ?? 99) - (METHOD_ORDER.get(right.method) ?? 99);
  });
}

export function listApiDocTags(operations: ApiDocOperation[]): string[] {
  return [...new Set(operations.flatMap((operation) => operation.tags))].sort((left, right) =>
    left.localeCompare(right),
  );
}

export function filterApiDocOperations(
  operations: ApiDocOperation[],
  query: string,
  tag: string | null,
): ApiDocOperation[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return operations.filter((operation) => {
    if (tag && !operation.tags.includes(tag)) return false;
    if (!normalizedQuery) return true;

    const haystack = [
      operation.method,
      operation.path,
      operation.summary,
      operation.description,
      ...operation.tags,
      ...operation.parameters.map((parameter) => parameter.name),
      ...operation.responses.map((response) => response.status),
    ]
      .filter((part): part is string => Boolean(part))
      .join(' ')
      .toLocaleLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
