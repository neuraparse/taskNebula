import { render, waitFor } from '@testing-library/react';
import {
  DeploymentReloadGuard,
  deploymentReloadInternals,
  isStaleDeploymentMessage,
} from '../deployment-reload-guard';

function mockTextResponse(body: string, status = 500): Response {
  return {
    status,
    clone: () => ({
      text: jest.fn().mockResolvedValue(body),
    }),
  } as unknown as Response;
}

describe('DeploymentReloadGuard', () => {
  const originalFetch = window.fetch;
  const originalReload = deploymentReloadInternals.reload;
  let cacheDeleteMock: jest.Mock;
  let serviceWorkerUpdateMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    window.fetch = originalFetch;
    deploymentReloadInternals.reload = originalReload;

    cacheDeleteMock = jest.fn().mockResolvedValue(true);
    Object.defineProperty(window, 'caches', {
      configurable: true,
      value: {
        keys: jest
          .fn()
          .mockResolvedValue(['tasknebula-v2', 'tasknebula-runtime', 'third-party-cache']),
        delete: cacheDeleteMock,
      },
    });

    serviceWorkerUpdateMock = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: jest.fn().mockResolvedValue([{ update: serviceWorkerUpdateMock }]),
      },
    });
  });

  afterEach(() => {
    window.fetch = originalFetch;
    deploymentReloadInternals.reload = originalReload;
    Reflect.deleteProperty(window, 'caches');
    Reflect.deleteProperty(navigator, 'serviceWorker');
  });

  it('matches stale deployment errors without matching ordinary API errors', () => {
    expect(isStaleDeploymentMessage(new Error('Failed to find Server Action "x"'))).toBe(true);
    expect(
      isStaleDeploymentMessage('This request might be from an older or newer deployment')
    ).toBe(true);
    expect(isStaleDeploymentMessage('Internal server error')).toBe(false);
  });

  it('clears TaskNebula caches and reloads once after a stale POST response', async () => {
    const originalFetchMock = jest
      .fn()
      .mockResolvedValue(mockTextResponse('Failed to find Server Action "x"'));
    const reloadMock = jest.fn();
    window.fetch = originalFetchMock as unknown as typeof fetch;
    deploymentReloadInternals.reload = reloadMock;

    render(<DeploymentReloadGuard />);

    await waitFor(() => expect(window.fetch).not.toBe(originalFetchMock));

    await window.fetch('/_actions', { method: 'POST' });
    await window.fetch('/_actions', { method: 'POST' });

    await waitFor(() => expect(reloadMock).toHaveBeenCalledTimes(1));
    expect(cacheDeleteMock).toHaveBeenCalledWith('tasknebula-v2');
    expect(cacheDeleteMock).toHaveBeenCalledWith('tasknebula-runtime');
    expect(cacheDeleteMock).not.toHaveBeenCalledWith('third-party-cache');
    expect(serviceWorkerUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('does not reload for non-stale API failures', async () => {
    const originalFetchMock = jest
      .fn()
      .mockResolvedValue(mockTextResponse('Internal server error'));
    const reloadMock = jest.fn();
    window.fetch = originalFetchMock as unknown as typeof fetch;
    deploymentReloadInternals.reload = reloadMock;

    render(<DeploymentReloadGuard />);

    await waitFor(() => expect(window.fetch).not.toBe(originalFetchMock));

    await window.fetch('/api/projects', { method: 'POST' });
    await Promise.resolve();

    expect(reloadMock).not.toHaveBeenCalled();
    expect(cacheDeleteMock).not.toHaveBeenCalled();
    expect(serviceWorkerUpdateMock).not.toHaveBeenCalled();
  });
});
