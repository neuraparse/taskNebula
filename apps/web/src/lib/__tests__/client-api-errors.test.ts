/**
 * @jest-environment node
 */

import {
  ApiResponseError,
  isApiBadRequestError,
  isApiConflictError,
  isApiPermissionError,
  throwApiResponseError,
} from '@/lib/client-api-errors';

function jsonResponse(body: unknown, status: number): Response {
  return {
    status,
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Response;
}

async function captureError(response: Response): Promise<ApiResponseError> {
  try {
    await throwApiResponseError(response);
  } catch (error) {
    return error as ApiResponseError;
  }

  throw new Error('Expected throwApiResponseError to throw');
}

describe('client API error helpers', () => {
  it('reads standard API envelopes and preserves status/code', async () => {
    const error = await captureError(
      jsonResponse({ error: { code: 'FORBIDDEN', message: 'Forbidden' } }, 403)
    );

    expect(error).toBeInstanceOf(ApiResponseError);
    expect(error.status).toBe(403);
    expect(error.code).toBe('FORBIDDEN');
    expect(error.message).toBe('Forbidden');
    expect(isApiPermissionError(error)).toBe(true);
  });

  it('supports legacy string error bodies', async () => {
    const error = await captureError(jsonResponse({ error: 'Duplicate name' }, 409));

    expect(error.message).toBe('Duplicate name');
    expect(isApiConflictError(error)).toBe(true);
  });

  it('classifies bad requests separately from permission and conflict errors', async () => {
    const error = await captureError(jsonResponse({ message: 'Invalid lead' }, 400));

    expect(isApiBadRequestError(error)).toBe(true);
    expect(isApiPermissionError(error)).toBe(false);
    expect(isApiConflictError(error)).toBe(false);
  });

  it('falls back to status text when the body is not JSON', async () => {
    const response = {
      status: 500,
      json: jest.fn().mockRejectedValue(new Error('not json')),
    } as unknown as Response;

    const error = await captureError(response);

    expect(error.message).toBe('Request failed (500)');
    expect(error.status).toBe(500);
  });
});
