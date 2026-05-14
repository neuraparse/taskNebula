/**
 * Commitlint configuration for TaskNebula.
 *
 * Extends @commitlint/config-conventional and customizes the type-enum
 * to include repo-specific types (`infra`, `ai`, `integrations`) used
 * across the monorepo (see CONTRIBUTING.md and recent git history).
 */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        // Conventional commits standard types
        'feat',
        'fix',
        'docs',
        'style',
        'refactor',
        'perf',
        'test',
        'build',
        'ci',
        'chore',
        'revert',
        // TaskNebula-specific types
        'infra',
        'ai',
        'integrations',
      ],
    ],
    // Be lenient on subject case to allow PascalCase product names
    'subject-case': [0],
    // Allow longer headers/bodies for detailed commits
    'header-max-length': [2, 'always', 120],
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
