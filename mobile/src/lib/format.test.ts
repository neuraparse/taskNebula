import i18next from 'i18next';
import { formatLocalizedDate, formatLocalizedDateTime } from './format';

describe('localized format helpers', () => {
  beforeEach(() => {
    i18next.language = 'tr';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('formats date and time values with the selected i18n language', () => {
    const spy = jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('localized time');

    expect(
      formatLocalizedDateTime('2026-06-29T10:30:00.000Z', '', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }),
    ).toBe('localized time');

    expect(spy).toHaveBeenCalledWith('tr', { dateStyle: 'medium', timeStyle: 'short' });
  });

  it('formats date values with the selected i18n language', () => {
    const spy = jest.spyOn(Date.prototype, 'toLocaleDateString').mockReturnValue('localized date');

    expect(formatLocalizedDate('2026-06-29T10:30:00.000Z')).toBe('localized date');

    expect(spy).toHaveBeenCalledWith('tr', undefined);
  });

  it('returns the fallback for missing or invalid dates', () => {
    const spy = jest.spyOn(Date.prototype, 'toLocaleString');

    expect(formatLocalizedDateTime(null, 'unknown')).toBe('unknown');
    expect(formatLocalizedDateTime('not-a-date', 'unknown')).toBe('unknown');

    expect(spy).not.toHaveBeenCalled();
  });
});
