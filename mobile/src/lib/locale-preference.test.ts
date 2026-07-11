import { defaultLocale } from '@/i18n/resources';
import { resolveSupportedLocaleFromCandidates } from './locale-preference';

jest.mock('./device-locale', () => ({
  getDeviceLocaleCandidates: jest.fn(() => []),
}));

jest.mock('./storage', () => ({
  mmkv: {
    getString: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
  },
}));

describe('locale preference resolution', () => {
  it('canonicalizes supported locale variants case-insensitively', () => {
    expect(resolveSupportedLocaleFromCandidates(['zh-cn'])).toBe('zh-CN');
    expect(resolveSupportedLocaleFromCandidates(['ZH-tw'])).toBe('zh-TW');
  });

  it('maps Chinese script and region variants to supported catalogs', () => {
    expect(resolveSupportedLocaleFromCandidates(['zh-Hans-US'])).toBe('zh-CN');
    expect(resolveSupportedLocaleFromCandidates(['zh-Hant-HK'])).toBe('zh-TW');
    expect(resolveSupportedLocaleFromCandidates(['zh-HK'])).toBe('zh-TW');
    expect(resolveSupportedLocaleFromCandidates(['zh-SG'])).toBe('zh-CN');
  });

  it('falls back to supported base languages for regional locales', () => {
    expect(resolveSupportedLocaleFromCandidates(['pt-BR'])).toBe('pt');
    expect(resolveSupportedLocaleFromCandidates(['tr-TR'])).toBe('tr');
  });

  it('handles legacy platform language aliases', () => {
    expect(resolveSupportedLocaleFromCandidates(['iw-IL'])).toBe('he');
    expect(resolveSupportedLocaleFromCandidates(['in-ID'])).toBe('id');
    expect(resolveSupportedLocaleFromCandidates(['no-NO'])).toBe('nb');
  });

  it('respects candidate order before falling back to the default locale', () => {
    expect(resolveSupportedLocaleFromCandidates(['fr-CA', 'zh-Hant'])).toBe('fr');
    expect(resolveSupportedLocaleFromCandidates(['zz-ZZ', ''])).toBe(defaultLocale);
  });
});
