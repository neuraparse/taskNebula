module.exports = {
  root: true,
  extends: ['../../packages/config/eslint.nextjs.js'],
  overrides: [
    {
      // i18n gate: no hardcoded visible text in app components/pages. Every
      // user-facing string must go through next-intl (see .claude/rules/frontend.md).
      // Marketing landing is intentionally English-only; tests are exempt.
      files: ['src/**/*.tsx'],
      excludedFiles: [
        'src/components/marketing/**',
        'src/components/landing/**',
        'src/app/page.tsx', // marketing landing root (English-only by design)
        'src/app/global-error.tsx', // renders outside the next-intl provider
        'src/app/offline/**', // PWA offline fallback — no i18n runtime
        'src/**/__tests__/**',
        'src/**/*.test.tsx',
      ],
      rules: {
        'react/jsx-no-literals': [
          'error',
          {
            noStrings: false,
            ignoreProps: true,
            allowedStrings: [
              '·',
              '—',
              '–',
              '×',
              '/',
              '+',
              '-',
              ':',
              '•',
              '→',
              '←',
              '...',
              '…',
              '|',
              '@',
              '#',
              '&',
              '%',
              '*',
              '.',
              ',',
              '(',
              ')',
              '--',
              '°',
              '~',
              '=',
              '?',
              // Brand / proper nouns / formats that must never be translated.
              'TaskNebula',
              'OpenAI',
              'Anthropic',
              'Redis',
              'LiveKit',
              'JSON',
              'CSV',
            ],
          },
        ],
      },
    },
  ],
};
