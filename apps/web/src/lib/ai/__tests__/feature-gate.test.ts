/**
 * @jest-environment node
 */

describe('isAiFeatureEnabled (DB-backed)', () => {
  async function load(systemReturn: unknown | Error) {
    jest.resetModules();
    jest.doMock('@/lib/agents/system', () => ({
      getSystemAgentControlSettingsFromDb: jest.fn().mockImplementation(() =>
        systemReturn instanceof Error
          ? Promise.reject(systemReturn)
          : Promise.resolve(systemReturn)
      ),
    }));
    return (await import('../feature-gate')) as typeof import('../feature-gate');
  }

  it('returns false when systemSettings.globalEnabled is false (default OFF)', async () => {
    const { isAiFeatureEnabled } = await load({ globalEnabled: false });
    expect(await isAiFeatureEnabled()).toBe(false);
  });

  it('returns true only when systemSettings.globalEnabled is explicitly true', async () => {
    const { isAiFeatureEnabled } = await load({ globalEnabled: true });
    expect(await isAiFeatureEnabled()).toBe(true);
  });

  it('fails closed (false) when the DB read throws', async () => {
    const { isAiFeatureEnabled } = await load(new Error('db down'));
    expect(await isAiFeatureEnabled()).toBe(false);
  });

  it('caches the result — second call does not hit the DB again within TTL', async () => {
    const systemMock = { globalEnabled: true };
    const { isAiFeatureEnabled, invalidateAiFeatureCache } = await load(systemMock);
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { getSystemAgentControlSettingsFromDb } = require('@/lib/agents/system');

    invalidateAiFeatureCache();
    await isAiFeatureEnabled();
    await isAiFeatureEnabled();
    await isAiFeatureEnabled();
    expect(getSystemAgentControlSettingsFromDb).toHaveBeenCalledTimes(1);
  });

  it('invalidateAiFeatureCache forces the next call to re-query', async () => {
    const { isAiFeatureEnabled, invalidateAiFeatureCache } = await load({
      globalEnabled: true,
    });
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const { getSystemAgentControlSettingsFromDb } = require('@/lib/agents/system');

    await isAiFeatureEnabled();
    invalidateAiFeatureCache();
    await isAiFeatureEnabled();
    expect(getSystemAgentControlSettingsFromDb).toHaveBeenCalledTimes(2);
  });

  it('aiDisabledResponse returns a 404 JSON response', async () => {
    const { aiDisabledResponse } = await load({ globalEnabled: false });
    const res = aiDisabledResponse();
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toEqual({ error: 'Not found' });
  });
});
