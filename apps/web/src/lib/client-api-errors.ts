export class ApiResponseError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.code = code;
  }
}

function readErrorField(value: unknown): { message?: string; code?: string } {
  if (typeof value === 'string') {
    return { message: value };
  }

  if (value && typeof value === 'object') {
    const body = value as { message?: unknown; code?: unknown };
    return {
      message: typeof body.message === 'string' ? body.message : undefined,
      code: typeof body.code === 'string' ? body.code : undefined,
    };
  }

  return {};
}

export async function throwApiResponseError(
  response: Response,
  fallbackMessage = `Request failed (${response.status})`
): Promise<never> {
  let message = fallbackMessage;
  let code: string | undefined;

  try {
    const body = (await response.json()) as {
      error?: unknown;
      message?: unknown;
      code?: unknown;
    };
    const parsedError = readErrorField(body.error);

    message =
      parsedError.message ||
      (typeof body.message === 'string' ? body.message : undefined) ||
      message;
    code = parsedError.code || (typeof body.code === 'string' ? body.code : undefined);
  } catch {
    // Non-JSON error body. Keep the status-derived fallback message.
  }

  throw new ApiResponseError(message, response.status, code);
}

export function isApiPermissionError(error: unknown): boolean {
  return error instanceof ApiResponseError && (error.status === 401 || error.status === 403);
}

export function isApiConflictError(error: unknown): boolean {
  return error instanceof ApiResponseError && error.status === 409;
}

export function isApiBadRequestError(error: unknown): boolean {
  return error instanceof ApiResponseError && error.status === 400;
}
