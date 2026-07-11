const mockMmkvStore = new Map<string, string>();

jest.mock('./storage', () => ({
  mmkv: {
    getString: jest.fn((key: string) => mockMmkvStore.get(key)),
    set: jest.fn((key: string, value: string) => {
      mockMmkvStore.set(key, value);
    }),
    remove: jest.fn((key: string) => {
      mockMmkvStore.delete(key);
    }),
  },
}));

import {
  DEFAULT_ESTIMATE_SCALE,
  loadProjectSchemaSettings,
  persistProjectSchemaSettings,
  sanitizeProjectSchemaSettings,
} from './project-schema-settings';

describe('project schema settings', () => {
  beforeEach(() => {
    mockMmkvStore.clear();
    jest.clearAllMocks();
  });

  it('sanitizes persisted work item types and estimate scale drafts', () => {
    const settings = sanitizeProjectSchemaSettings({
      workItemTypes: [
        {
          id: 'wit_incident',
          name: 'Incident',
          icon: 'rocket',
          color: '#10B981',
          customProperties: [
            {
              id: 'prop_impact',
              name: 'Impact',
              type: 'dropdown',
              required: true,
              options: [' High ', '', 'Low'],
            },
            {
              id: 'prop_bad',
              name: 'Bad',
              type: 'unsupported',
            },
          ],
        },
        { id: 'bad-type' },
      ],
      estimateScale: {
        kind: 'points',
        subKind: 'points-custom',
        values: ['1', ' 3 ', '', '5'],
      },
    });

    expect(settings.workItemTypes).toEqual([
      {
        id: 'wit_incident',
        name: 'Incident',
        icon: 'rocket',
        color: '#10B981',
        customProperties: [
          {
            id: 'prop_impact',
            name: 'Impact',
            type: 'dropdown',
            required: true,
            options: ['High', 'Low'],
          },
        ],
      },
    ]);
    expect(settings.estimateScale).toEqual({
      kind: 'points',
      subKind: 'points-custom',
      values: ['1', '3', '5'],
    });
  });

  it('falls back to defaults when stored JSON is unusable', () => {
    mockMmkvStore.set('project_schema_settings:project_1', '{bad json');

    const settings = loadProjectSchemaSettings('project_1');

    expect(settings.estimateScale).toEqual(DEFAULT_ESTIMATE_SCALE);
    expect(settings.workItemTypes.map((type) => type.id)).toEqual([
      'default-story',
      'default-bug',
      'default-task',
      'default-epic',
    ]);
  });

  it('persists and reloads the local project schema settings', () => {
    const settings = sanitizeProjectSchemaSettings({
      workItemTypes: [
        {
          id: 'wit_custom',
          name: 'Custom',
          icon: 'pin',
          color: '#3B82F6',
          customProperties: [],
        },
      ],
      estimateScale: {
        kind: 'time',
        subKind: 'time-custom',
        values: ['30m', '1h'],
      },
    });

    persistProjectSchemaSettings('project_1', settings);

    expect(loadProjectSchemaSettings('project_1')).toEqual(settings);
  });
});
