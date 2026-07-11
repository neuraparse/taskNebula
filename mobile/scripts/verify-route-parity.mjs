#!/usr/bin/env node
/**
 * Static route parity guard for the native mobile app.
 *
 * The mobile app is not a browser shell, so a few web routes intentionally map
 * to native tabs, stacked screens, or root auth gates instead of 1:1 paths.
 * This script keeps that mapping explicit and fails when authenticated web
 * pages or core auth/content routes are added without a mobile counterpart.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileRoot, '..');
const failures = [];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function walkFiles(directory, predicate, out = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walkFiles(entryPath, predicate, out);
    } else if (predicate(entryPath)) {
      out.push(entryPath);
    }
  }
  return out;
}

function pageRoutes(relativeBasePath, prefix) {
  const basePath = path.join(repoRoot, relativeBasePath);
  if (!fs.existsSync(basePath)) return [];

  return walkFiles(basePath, (file) => path.basename(file) === 'page.tsx')
    .map((file) => {
      const relative = path.relative(basePath, file).replaceAll(path.sep, '/');
      const route = relative.replace(/\/page\.tsx$/, '').replace(/^page\.tsx$/, '');
      return `${prefix}:${route || '/'}`;
    })
    .sort();
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function assertRouteSource(route, sourceName, source, needles) {
  for (const needle of needles) {
    assert(
      source.includes(needle),
      `${route} must be backed by ${sourceName} containing ${JSON.stringify(needle)}.`,
    );
  }
}

function sampleRouteKeys(source) {
  return new Set(
    [...source.matchAll(/^\s*'([^']+)':\s*\{/gm)].map((match) => match[1]).filter(Boolean),
  );
}

function quotedValues(source) {
  return [...source.matchAll(/'([^']+)'/g)].map((match) => match[1]).filter(Boolean);
}

function arrayLiteralValues(source, name) {
  const pattern = new RegExp(
    `${name}[^=]*=\\s*(?:new\\s+Set(?:<[^>]+>)?\\s*\\()?\\s*\\[([\\s\\S]*?)\\]`,
  );
  const match = source.match(pattern);
  return match ? quotedValues(match[1]) : [];
}

function typeUnionValues(source, name) {
  const pattern = new RegExp(`export type ${name}\\s*=\\s*([^;]+);`);
  const match = source.match(pattern);
  return match ? quotedValues(match[1]) : [];
}

function assertSameSet(label, left, right) {
  const missing = [...left].filter((value) => !right.has(value));
  const extra = [...right].filter((value) => !left.has(value));
  assert(
    missing.length === 0 && extra.length === 0,
    `${label} mismatch. Missing: ${missing.join(', ') || 'none'}; extra: ${
      extra.join(', ') || 'none'
    }.`,
  );
}

const sources = {
  app: read('mobile/App.tsx'),
  apiEndpoints: read('mobile/src/api/endpoints.ts'),
  apiTypes: read('mobile/src/api/types.ts'),
  deepLinks: read('mobile/src/lib/deep-links.ts'),
  login: read('mobile/src/screens/LoginScreen.tsx'),
  navigator: read('mobile/src/navigation/AppNavigator.tsx'),
  rootNavigation: read('mobile/src/navigation/root.ts'),
  samples: read('mobile/src/lib/web-route-samples.ts'),
  types: read('mobile/src/navigation/types.ts'),
  webMobileIntegrationAuthorize: read(
    'apps/web/src/app/api/integrations/mobile/authorize/route.ts',
  ),
  webMobileIntegrationOauth: read('apps/web/src/lib/integrations/mobile-oauth.ts'),
};

const discoveredRoutes = new Set([
  ...pageRoutes('apps/web/src/app/[locale]/(app)', 'app'),
  ...pageRoutes('apps/web/src/app/auth', 'auth'),
  ...pageRoutes('apps/web/src/app/(public)', 'public'),
  ...(exists('apps/web/src/app/join/project/[token]/page.tsx')
    ? ['root:join/project/[token]']
    : []),
  ...(exists('apps/web/src/app/setup/page.tsx') ? ['root:setup'] : []),
  ...(exists('apps/web/src/app/share/[token]/page.tsx') ? ['root:share/[token]'] : []),
]);

const routeChecks = new Map([
  [
    'app:admin',
    () => {
      assertRouteSource('app:admin', 'AppStackParamList', sources.types, ['InstanceAdmin']);
      assertRouteSource('app:admin', 'AppNavigator', sources.navigator, [
        'InstanceAdminScreen',
        'name="InstanceAdmin"',
      ]);
    },
  ],
  [
    'app:api-docs',
    () => {
      assertRouteSource('app:api-docs', 'AppStackParamList', sources.types, ['ApiDocs']);
      assertRouteSource('app:api-docs', 'AppNavigator', sources.navigator, [
        'ApiDocsScreen',
        'name="ApiDocs"',
      ]);
    },
  ],
  [
    'app:dashboard',
    () => assertRouteSource('app:dashboard', 'AppTabParamList', sources.types, ['Dashboard']),
  ],
  [
    'app:docs',
    () => {
      assertRouteSource('app:docs', 'AppStackParamList', sources.types, ['Docs', 'DocumentDetail']);
      assertRouteSource('app:docs', 'root navigation', sources.rootNavigation, [
        "intent.kind === 'document'",
        "navigationRef.navigate('Docs'",
      ]);
    },
  ],
  [
    'app:drafts',
    () => assertRouteSource('app:drafts', 'AppNavigator', sources.navigator, ['DraftsScreen']),
  ],
  ['app:inbox', () => assertRouteSource('app:inbox', 'AppTabParamList', sources.types, ['Inbox'])],
  [
    'app:issues',
    () =>
      assertRouteSource('app:issues', 'root navigation', sources.rootNavigation, [
        "intent.screen === 'IssuesList'",
        'navigationRef.navigate(',
        "'IssuesList'",
      ]),
  ],
  [
    'app:initiatives',
    () => assertRouteSource('app:initiatives', 'AppTabParamList', sources.types, ['Initiatives']),
  ],
  [
    'app:initiatives/[id]',
    () =>
      assertRouteSource('app:initiatives/[id]', 'root navigation', sources.rootNavigation, [
        "intent.kind === 'initiative'",
        "navigationRef.navigate('InitiativeDetail'",
      ]),
  ],
  [
    'app:issues/[issueId]',
    () =>
      assertRouteSource('app:issues/[issueId]', 'root navigation', sources.rootNavigation, [
        "intent.kind === 'issue'",
        "navigationRef.navigate('IssueDetail'",
      ]),
  ],
  [
    'app:my-issues',
    () => assertRouteSource('app:my-issues', 'AppTabParamList', sources.types, ['Issues']),
  ],
  [
    'app:projects',
    () => assertRouteSource('app:projects', 'AppTabParamList', sources.types, ['Projects']),
  ],
  [
    'app:projects/[projectId]',
    () =>
      assertRouteSource('app:projects/[projectId]', 'root navigation', sources.rootNavigation, [
        "intent.kind === 'project'",
        "navigationRef.navigate('ProjectDetail'",
      ]),
  ],
  [
    'app:projects/[projectId]/analytics',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/analytics',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'analytics'", "navigationRef.navigate('ProjectAnalytics'"],
      ),
  ],
  [
    'app:projects/[projectId]/backlog',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/backlog',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'backlog'", "navigationRef.navigate('ProjectBacklog'"],
      ),
  ],
  [
    'app:projects/[projectId]/board',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/board',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'board'", "viewMode: 'board'"],
      ),
  ],
  [
    'app:projects/[projectId]/chat',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/chat',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'chat'", "navigationRef.navigate('ProjectChat'"],
      ),
  ],
  [
    'app:projects/[projectId]/docs',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/docs',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'docs'", "navigationRef.navigate('ProjectDocs'"],
      ),
  ],
  [
    'app:projects/[projectId]/modules',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/modules',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'modules'", "navigationRef.navigate('ProjectModules'"],
      ),
  ],
  [
    'app:projects/[projectId]/roadmap',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/roadmap',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'roadmap'", "navigationRef.navigate('ProjectRoadmap'"],
      ),
  ],
  [
    'app:projects/[projectId]/settings',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/settings',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'settings'", "navigationRef.navigate('ProjectSettings'"],
      ),
  ],
  [
    'app:projects/[projectId]/settings/components',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/settings/components',
        'ProjectSettingsSection',
        sources.types,
        ["'components'"],
      ),
  ],
  [
    'app:projects/[projectId]/settings/versions',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/settings/versions',
        'ProjectSettingsSection',
        sources.types,
        ["'versions'"],
      ),
  ],
  [
    'app:projects/[projectId]/settings/workflows',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/settings/workflows',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'workflows'", "navigationRef.navigate('ProjectWorkflows'"],
      ),
  ],
  [
    'app:projects/[projectId]/sprints',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/sprints',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'sprints'", "navigationRef.navigate('ProjectSprints'"],
      ),
  ],
  [
    'app:projects/[projectId]/sprints/[sprintId]',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/sprints/[sprintId]',
        'root navigation',
        sources.rootNavigation,
        ["intent.kind === 'sprint'", "navigationRef.navigate('SprintDetail'"],
      ),
  ],
  [
    'app:projects/[projectId]/views',
    () =>
      assertRouteSource(
        'app:projects/[projectId]/views',
        'root navigation',
        sources.rootNavigation,
        ["intent.section === 'views'", "navigationRef.navigate('ProjectViews'"],
      ),
  ],
  [
    'app:settings',
    () => {
      assertRouteSource(
        'app:settings',
        'Profile settings hub',
        read('mobile/src/screens/ProfileScreen.tsx'),
        [
          "navigation.navigate('DeveloperSettings'",
          "navigation.navigate('OrganizationSettings'",
          "navigation.navigate('LabelsSettings'",
          "navigation.navigate('AiTransparency'",
        ],
      );
      assertRouteSource('app:settings', 'ProfileRouteFocus', sources.types, [
        "'notifications'",
        "'appearance'",
      ]);
    },
  ],
  [
    'app:settings/ai-transparency',
    () =>
      assertRouteSource('app:settings/ai-transparency', 'AppNavigator', sources.navigator, [
        'AiTransparencyScreen',
        'name="AiTransparency"',
      ]),
  ],
  [
    'app:settings/billing',
    () =>
      assertRouteSource(
        'app:settings/billing',
        'Organization settings plan surface',
        read('mobile/src/screens/OrganizationSettingsScreen.tsx'),
        ['planLabel', 'organization.plan'],
      ),
  ],
  [
    'app:settings/import',
    () =>
      assertRouteSource('app:settings/import', 'AppNavigator', sources.navigator, [
        'ImportSettingsScreen',
      ]),
  ],
  [
    'app:settings/intake-forms',
    () =>
      assertRouteSource('app:settings/intake-forms', 'AppNavigator', sources.navigator, [
        'IntakeFormsScreen',
      ]),
  ],
  [
    'app:settings/intake-forms/[id]/edit',
    () =>
      assertRouteSource('app:settings/intake-forms/[id]/edit', 'AppStackParamList', sources.types, [
        'IntakeForms',
        'formId',
      ]),
  ],
  [
    'app:settings/integrations',
    () =>
      assertRouteSource('app:settings/integrations', 'OrganizationSettingsSection', sources.types, [
        "'integrations'",
      ]),
  ],
  [
    'app:settings/labels',
    () =>
      assertRouteSource('app:settings/labels', 'AppNavigator', sources.navigator, [
        'LabelsSettingsScreen',
      ]),
  ],
  [
    'app:settings/members',
    () => assertRouteSource('app:settings/members', 'AppTabParamList', sources.types, ['Team']),
  ],
  [
    'app:settings/organization',
    () =>
      assertRouteSource('app:settings/organization', 'AppNavigator', sources.navigator, [
        'OrganizationSettingsScreen',
        'name="OrganizationSettings"',
      ]),
  ],
  [
    'app:settings/security/audit-log-streaming',
    () =>
      assertRouteSource(
        'app:settings/security/audit-log-streaming',
        'AppNavigator',
        sources.navigator,
        ['AuditLogStreamingScreen', 'name="AuditLogStreaming"'],
      ),
  ],
  [
    'app:settings/sso',
    () =>
      assertRouteSource('app:settings/sso', 'AppNavigator', sources.navigator, [
        'SsoSettingsScreen',
      ]),
  ],
  ['app:team', () => assertRouteSource('app:team', 'AppTabParamList', sources.types, ['Team'])],
  [
    'app:templates',
    () =>
      assertRouteSource('app:templates', 'AppNavigator', sources.navigator, ['TemplatesScreen']),
  ],
  [
    'auth:error',
    () =>
      assertRouteSource('auth:error', 'LoginScreen auth intent notices', sources.login, [
        'signinError',
      ]),
  ],
  [
    'auth:forgot-password',
    () =>
      assertRouteSource('auth:forgot-password', 'LoginScreen', sources.login, [
        "'forgot'",
        'requestPasswordReset',
      ]),
  ],
  [
    'auth:reset-password',
    () =>
      assertRouteSource('auth:reset-password', 'LoginScreen', sources.login, [
        "'reset'",
        'resetPassword',
      ]),
  ],
  [
    'auth:signin',
    () => assertRouteSource('auth:signin', 'LoginScreen', sources.login, ["'signin'", 'signIn']),
  ],
  [
    'auth:signup',
    () =>
      assertRouteSource('auth:signup', 'LoginScreen', sources.login, ["'signup'", 'signupAccount']),
  ],
  [
    'auth:verify-email',
    () =>
      assertRouteSource('auth:verify-email', 'LoginScreen', sources.login, [
        "'verify'",
        'verifyEmail',
      ]),
  ],
  [
    'auth:verify-request',
    () =>
      assertRouteSource('auth:verify-request', 'LoginScreen', sources.login, [
        'requestEmailVerification',
      ]),
  ],
  [
    'root:join/project/[token]',
    () => {
      assertRouteSource('root:join/project/[token]', 'deep link parser', sources.deepLinks, [
        'projectInviteMatch',
        "kind: 'signup'",
        'projectInviteToken',
      ]);
      assertRouteSource('root:join/project/[token]', 'LoginScreen invite form', sources.login, [
        'projectInviteToken',
        'signupAccount',
      ]);
      assertRouteSource(
        'root:join/project/[token]',
        'post-auth invite acceptance',
        sources.navigator,
        ['useAcceptProjectInviteLink', 'acceptProjectInvite'],
      );
    },
  ],
  [
    'root:setup',
    () =>
      assertRouteSource('root:setup', 'SessionGate', sources.app, [
        "'setup-required'",
        'SetupScreen',
      ]),
  ],
  [
    'root:share/[token]',
    () =>
      assertRouteSource('root:share/[token]', 'public document flow', sources.app, [
        'PublicDocumentScreen',
        "pendingContentLink?.kind === 'public-document'",
      ]),
  ],
  [
    'public:ai-model-cards',
    () => {
      assertRouteSource('public:ai-model-cards', 'deep link parser', sources.deepLinks, [
        "first === 'ai-model-cards'",
        "aiTransparencyFocus: 'modelCards'",
      ]);
      assertRouteSource('public:ai-model-cards', 'root navigation', sources.rootNavigation, [
        "intent.screen === 'AiTransparency'",
        'intent.aiTransparencyFocus',
      ]);
    },
  ],
  [
    'public:intake/[slug]',
    () =>
      assertRouteSource('public:intake/[slug]', 'public intake flow', sources.app, [
        'PublicIntakeScreen',
        "pendingContentLink?.kind === 'public-intake'",
      ]),
  ],
  [
    'public:trust',
    () => {
      assertRouteSource('public:trust', 'deep link parser', sources.deepLinks, [
        "first === 'trust'",
        "screen: 'AiTransparency'",
      ]);
      assertRouteSource('public:trust', 'root navigation', sources.rootNavigation, [
        "intent.screen === 'AiTransparency'",
      ]);
    },
  ],
]);

for (const route of discoveredRoutes) {
  const check = routeChecks.get(route);
  if (!check) {
    failures.push(`No mobile route parity mapping for web route ${route}.`);
    continue;
  }
  check();
}

for (const route of routeChecks.keys()) {
  assert(discoveredRoutes.has(route), `Mobile parity mapping ${route} no longer has a web page.`);
}

const parserSampleRoutes = sampleRouteKeys(sources.samples);
for (const route of discoveredRoutes) {
  assert(
    parserSampleRoutes.has(route),
    `No mobile parser sample for web route ${route} in mobile/src/lib/web-route-samples.ts.`,
  );
}

for (const route of parserSampleRoutes) {
  assert(
    discoveredRoutes.has(route),
    `Mobile parser sample ${route} no longer has a discovered web page.`,
  );
}

const mobileIntegrationProviders = new Set(
  arrayLiteralValues(sources.apiEndpoints, 'WORKSPACE_INTEGRATION_PROVIDERS'),
);
const mobileIntegrationProviderType = new Set(
  typeUnionValues(sources.apiTypes, 'WorkspaceIntegrationProvider'),
);
const webIntegrationProviderType = new Set(
  typeUnionValues(sources.webMobileIntegrationOauth, 'IntegrationOAuthProvider'),
);
const webIntegrationAuthorizeProviders = new Set(
  arrayLiteralValues(sources.webMobileIntegrationAuthorize, 'PROVIDERS'),
);

assert(
  mobileIntegrationProviders.size > 0,
  'Mobile integration provider list must stay explicit in mobile/src/api/endpoints.ts.',
);
assertSameSet(
  'Mobile integration endpoint/provider type parity',
  mobileIntegrationProviders,
  mobileIntegrationProviderType,
);
assertSameSet(
  'Mobile/web integration OAuth provider parity',
  mobileIntegrationProviders,
  webIntegrationProviderType,
);
assertSameSet(
  'Mobile/web integration authorize route provider parity',
  mobileIntegrationProviders,
  webIntegrationAuthorizeProviders,
);
assertRouteSource(
  'app:settings/integrations OAuth callback',
  'deep link parser',
  sources.deepLinks,
  ["kind: 'integration-oauth'", "path === '/integrations/oauth'"],
);
assertRouteSource('app:settings/integrations OAuth callback', 'AppNavigator', sources.navigator, [
  "pendingAuthIntent?.kind !== 'integration-oauth'",
  'invalidateWorkspaceIntegrationQueries',
]);

if (failures.length) {
  console.error(`Route parity verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Route parity verification passed: ${discoveredRoutes.size} web auth/app/content routes have mobile coverage.`,
);
