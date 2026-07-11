#!/usr/bin/env node
/**
 * Native configuration guard for the bare, self-hosted mobile app.
 *
 * This intentionally checks static native project files so Linux CI can catch
 * accidental Expo/managed-runtime regressions even when iOS tooling is absent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(mobileRoot, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(mobileRoot, relativePath), 'utf8');
}

function readRepo(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(read(relativePath));
}

const failures = [];
const expectedLocales = [
  'ar',
  'bg',
  'cs',
  'da',
  'de',
  'el',
  'en',
  'es',
  'fi',
  'fr',
  'he',
  'hi',
  'hu',
  'id',
  'it',
  'ja',
  'ko',
  'nb',
  'nl',
  'pl',
  'pt',
  'ro',
  'ru',
  'sv',
  'th',
  'tr',
  'uk',
  'vi',
  'zh-Hans',
  'zh-Hant',
];
const expectedMobileMessageLocales = fs
  .readdirSync(path.join(mobileRoot, 'locales'))
  .filter((file) => file.endsWith('.json') && file !== 'en.json')
  .map((file) => file.replace(/\.json$/, ''))
  .sort();
const nativeFontFiles = [
  'TaskNebulaPlusJakartaSans-Regular.ttf',
  'TaskNebulaPlusJakartaSans-Medium.ttf',
  'TaskNebulaPlusJakartaSans-SemiBold.ttf',
  'TaskNebulaPlusJakartaSans-Bold.ttf',
  'TaskNebulaIBMPlexSans-Regular.ttf',
  'TaskNebulaIBMPlexSans-Medium.ttf',
  'TaskNebulaIBMPlexSans-SemiBold.ttf',
  'TaskNebulaJetBrainsMono-Regular.ttf',
  'TaskNebulaJetBrainsMono-Medium.ttf',
  'TaskNebulaIBMPlexMono-Regular.ttf',
  'TaskNebulaIBMPlexMono-Medium.ttf',
];

function assert(condition, message) {
  if (!condition) {
    failures.push(message);
  }
}

function assertIncludes(source, needle, message) {
  assert(source.includes(needle), message);
}

function assertMatches(source, pattern, message) {
  assert(pattern.test(source), message);
}

function assertFileExists(relativePath, message) {
  const filePath = path.join(mobileRoot, relativePath);
  assert(fs.existsSync(filePath) && fs.statSync(filePath).size > 1024, message);
}

function assertNonEmptyFile(relativePath, message) {
  const filePath = path.join(mobileRoot, relativePath);
  assert(fs.existsSync(filePath) && fs.statSync(filePath).size > 0, message);
}

const packageJson = readJson('package.json');
const allDependencies = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};
const expoPackages = Object.keys(allDependencies).filter(
  (name) => name === 'expo' || name.startsWith('expo-') || name.startsWith('@expo/'),
);

assert(
  packageJson.main === 'index.js',
  'mobile/package.json must use the React Native index.js entry.',
);
assert(
  allDependencies['react-native'] && !allDependencies.expo,
  'mobile/package.json must depend on react-native without expo.',
);
assert(
  expoPackages.length === 0,
  `Expo packages are not allowed in the self-hosted bare app: ${expoPackages.join(', ')}`,
);
assert(
  packageJson.scripts?.['ios:verify-bundle'] === 'node scripts/verify-ios-bundle.mjs',
  'mobile/package.json must expose ios:verify-bundle for CI iOS bundle checks.',
);
assert(
  fs.existsSync(path.join(mobileRoot, 'scripts/verify-ios-bundle.mjs')),
  'mobile/scripts/verify-ios-bundle.mjs must exist for iOS release bundle verification.',
);
const i18nCheckScript = packageJson.scripts?.['i18n:check'] ?? '';
assertIncludes(
  i18nCheckScript,
  'node scripts/i18n-check.mjs',
  'mobile/package.json i18n:check must validate locale key parity.',
);
assertIncludes(
  i18nCheckScript,
  'node scripts/sync-web-locale-translations.mjs --check',
  'mobile/package.json i18n:check must prevent mobile/web locale sync drift.',
);
assertIncludes(
  i18nCheckScript,
  'node scripts/i18n-fallback-check.mjs',
  'mobile/package.json i18n:check must enforce the reviewed fallback debt baseline.',
);
assert(
  packageJson.scripts?.['i18n:fallbacks:update'] ===
    'node scripts/i18n-fallback-check.mjs --write-baseline',
  'mobile/package.json must expose i18n:fallbacks:update for intentional fallback baseline changes.',
);
assert(
  fs.existsSync(path.join(mobileRoot, 'scripts/i18n-fallback-check.mjs')),
  'mobile/scripts/i18n-fallback-check.mjs must exist for fallback debt verification.',
);
assert(
  fs.existsSync(path.join(mobileRoot, 'scripts/sync-web-locale-translations.mjs')),
  'mobile/scripts/sync-web-locale-translations.mjs must exist for web locale sync verification.',
);
const i18nFallbackAllowlist = readJson('i18n-fallback-allowlist.json');
assert(
  Number.isInteger(i18nFallbackAllowlist.maxExactEnglishFallbacks) &&
    i18nFallbackAllowlist.maxExactEnglishFallbacks >= 0,
  'mobile/i18n-fallback-allowlist.json must pin the exact English fallback ceiling.',
);
assert(
  Number.isInteger(i18nFallbackAllowlist.maxLikelyTranslatableFallbacks) &&
    i18nFallbackAllowlist.maxLikelyTranslatableFallbacks >= 0,
  'mobile/i18n-fallback-allowlist.json must pin the likely translatable fallback ceiling.',
);
assert(
  Number.isInteger(i18nFallbackAllowlist.maxCriticalFlowFallbacks) &&
    i18nFallbackAllowlist.maxCriticalFlowFallbacks >= 0,
  'mobile/i18n-fallback-allowlist.json must pin the critical auth/setup/public-share fallback ceiling.',
);
assert(
  Array.isArray(i18nFallbackAllowlist.criticalFlowPrefixes) &&
    i18nFallbackAllowlist.criticalFlowPrefixes.includes('onboarding.') &&
    i18nFallbackAllowlist.criticalFlowPrefixes.includes('setup.') &&
    i18nFallbackAllowlist.criticalFlowPrefixes.includes('publicShare.'),
  'mobile/i18n-fallback-allowlist.json must identify guarded critical mobile flow prefixes.',
);
assert(
  Array.isArray(i18nFallbackAllowlist.criticalFlowZeroFallbackLocales) &&
    expectedMobileMessageLocales.every((locale) =>
      i18nFallbackAllowlist.criticalFlowZeroFallbackLocales.includes(locale),
    ),
  'mobile/i18n-fallback-allowlist.json must keep every non-English critical-flow locale fail-closed.',
);
assert(
  Array.isArray(i18nFallbackAllowlist.allowedLikelyTranslatableKeys),
  'mobile/i18n-fallback-allowlist.json must list reviewed translatable fallback keys.',
);

const lintScript = packageJson.scripts?.lint ?? '';
assertIncludes(
  lintScript,
  'pnpm native:verify',
  'mobile/package.json lint must run native:verify so root lint protects native/self-hosted invariants.',
);

const ciWorkflow = readRepo('.github/workflows/ci.yml');
assertIncludes(
  ciWorkflow,
  'mobile-native:',
  '.github/workflows/ci.yml must keep a dedicated mobile-native verification job.',
);
for (const command of [
  'pnpm --filter @tasknebula/mobile i18n:check',
  'pnpm --filter @tasknebula/mobile openapi:check',
  'pnpm --filter @tasknebula/mobile design:verify',
  'pnpm --filter @tasknebula/mobile native:verify',
  'pnpm --filter @tasknebula/mobile ios:verify-bundle',
  'pnpm --filter @tasknebula/mobile android:verify-build',
]) {
  assertIncludes(
    ciWorkflow,
    command,
    `.github/workflows/ci.yml mobile-native job must run ${command}.`,
  );
}

const appJson = readJson('app.json');
assert(!Object.hasOwn(appJson, 'expo'), 'mobile/app.json must not contain Expo managed config.');
assert(appJson.name === 'TaskNebulaMobile', 'mobile/app.json name must match the native module.');

const babelConfig = read('babel.config.js');
assertIncludes(
  babelConfig,
  'inlineTaskNebulaMobileEnv',
  'Babel config must inline mobile .env values for bare React Native bundles.',
);
assertIncludes(
  babelConfig,
  "path.join(__dirname, '.env')",
  'Babel config must read mobile/.env for local self-hosted defaults.',
);
assertIncludes(
  babelConfig,
  'TASKNEBULA_API_URL',
  'Babel config must expose TASKNEBULA_API_URL to the mobile app bundle.',
);

const envConfig = read('src/config/env.ts');
assertIncludes(
  envConfig,
  '__TASKNEBULA_API_URL__',
  'Mobile env config must consume the compile-time TASKNEBULA_API_URL value.',
);
assertIncludes(
  envConfig,
  'configuredApiBaseUrl',
  'Mobile env config must keep the default server URL optional.',
);
assert(
  !envConfig.includes("'http://localhost:3000'") && !envConfig.includes('"http://localhost:3000"'),
  'Mobile env config must not force localhost as the production default server.',
);

const androidManifest = read('android/app/src/main/AndroidManifest.xml');
assertIncludes(
  androidManifest,
  'android:scheme="tasknebula"',
  'Android manifest must register the tasknebula:// deep-link scheme.',
);
assertIncludes(
  androidManifest,
  'android:launchMode="singleTask"',
  'Android MainActivity must use singleTask so deep links reuse the app session.',
);
assertIncludes(
  androidManifest,
  'android:usesCleartextTraffic="${usesCleartextTraffic}"',
  'Android manifest must keep cleartext traffic controlled by the self-hosted build placeholder.',
);
assertIncludes(
  androidManifest,
  'android:localeConfig="@xml/locales_config"',
  'Android manifest must expose the 30 supported app languages through localeConfig.',
);
assertIncludes(
  androidManifest,
  'android.permission.RECORD_AUDIO',
  'Android manifest must request microphone access for LiveKit project calls.',
);
assertIncludes(
  androidManifest,
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'Android manifest must allow audio routing for LiveKit project calls.',
);

const androidLocaleConfig = read('android/app/src/main/res/xml/locales_config.xml');
for (const locale of expectedLocales) {
  assertIncludes(
    androidLocaleConfig,
    `android:name="${locale}"`,
    `Android locale_config.xml must advertise ${locale} for per-app language selection.`,
  );
}

const mainApplication = read('android/app/src/main/java/io/tasknebula/app/MainApplication.kt');
assertIncludes(
  mainApplication,
  'LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())',
  'Android MainApplication must initialize LiveKit before React Native startup.',
);

const androidBuildGradle = read('android/app/build.gradle');
assertIncludes(
  androidBuildGradle,
  'tasknebulaAllowCleartext',
  'Android build must expose tasknebulaAllowCleartext for HTTPS-only production builds.',
);
assertIncludes(
  androidBuildGradle,
  'applicationId "io.tasknebula.app"',
  'Android applicationId must stay io.tasknebula.app.',
);
assertIncludes(
  androidBuildGradle,
  'hermesCommand = hermesCompilerPath.absolutePath',
  'Android build must use the local Hermes compiler from workspace dependencies.',
);
assertIncludes(
  androidBuildGradle,
  'tasknebulaUploadStoreFile',
  'Android release signing must be configured through self-hosted Gradle properties.',
);
assertIncludes(
  androidBuildGradle,
  'tasknebulaUploadStorePassword',
  'Android release signing must require a keystore password property.',
);
assertIncludes(
  androidBuildGradle,
  'tasknebulaUploadKeyAlias',
  'Android release signing must require a key alias property.',
);
assertIncludes(
  androidBuildGradle,
  'tasknebulaUploadKeyPassword',
  'Android release signing must require a key password property.',
);
assertIncludes(
  androidBuildGradle,
  'Debug signing is never used for release.',
  'Android release builds must fail explicitly instead of falling back to debug signing.',
);
assert(
  !androidBuildGradle.includes('signingConfig signingConfigs.debug\n            minifyEnabled'),
  'Android release build must not use the debug signing config.',
);

const androidStyles = read('android/app/src/main/res/values/styles.xml');
assertIncludes(
  androidStyles,
  '<item name="android:windowBackground">@drawable/launch_screen</item>',
  'Android AppTheme must use the branded launch_screen background before React Native renders.',
);
assertIncludes(
  androidStyles,
  '<item name="android:statusBarColor">#0A0B10</item>',
  'Android AppTheme must keep the launch/status background aligned with the web dark surface.',
);

const androidLaunchScreen = read('android/app/src/main/res/drawable/launch_screen.xml');
assertIncludes(
  androidLaunchScreen,
  '@color/launch_screen_background',
  'Android launch_screen must use the checked TaskNebula launch background color.',
);
assertIncludes(
  androidLaunchScreen,
  'android:width="112dp"',
  'Android launch_screen must size the centered mark like the iOS launch logo.',
);
assertIncludes(
  androidLaunchScreen,
  'android:height="112dp"',
  'Android launch_screen must keep a square centered mark.',
);
assertIncludes(
  androidLaunchScreen,
  'android:gravity="center"',
  'Android launch_screen must center the TaskNebula mark.',
);
assertIncludes(
  androidLaunchScreen,
  '@mipmap/ic_launcher_foreground',
  'Android launch_screen must render the TaskNebula foreground mark.',
);

const androidColors = read('android/app/src/main/res/values/colors.xml');
assertIncludes(
  androidColors,
  '<color name="launch_screen_background">#0A0B10</color>',
  'Android launch_screen_background color must match the mobile/web dark launch surface.',
);

const androidV31Styles = read('android/app/src/main/res/values-v31/styles.xml');
assertIncludes(
  androidV31Styles,
  '<item name="android:windowSplashScreenBackground">@color/launch_screen_background</item>',
  'Android 12+ splash screen must use the branded TaskNebula background.',
);
assertIncludes(
  androidV31Styles,
  '<item name="android:windowSplashScreenAnimatedIcon">@mipmap/ic_launcher_foreground</item>',
  'Android 12+ splash screen must use the TaskNebula foreground mark.',
);
assertIncludes(
  androidV31Styles,
  '<item name="android:windowSplashScreenIconBackgroundColor">@color/launch_screen_background</item>',
  'Android 12+ splash icon background must stay aligned with the launch surface.',
);

const podfile = read('ios/Podfile');
assertIncludes(
  podfile,
  'react-native/scripts/react_native_pods.rb',
  'iOS Podfile must resolve React Native pods directly.',
);
assertIncludes(
  podfile,
  'use_native_modules!',
  'iOS Podfile must keep React Native autolinking enabled.',
);
assertIncludes(
  podfile,
  'use_react_native!',
  'iOS Podfile must use the React Native bare app helper.',
);
assert(!/expo/i.test(podfile), 'iOS Podfile must not reference Expo modules.');

const infoPlist = read('ios/TaskNebulaMobile/Info.plist');
assertMatches(
  infoPlist,
  /<key>CFBundleURLSchemes<\/key>[\s\S]*<string>tasknebula<\/string>/,
  'iOS Info.plist must register the tasknebula:// deep-link scheme.',
);
assertMatches(
  infoPlist,
  /<key>NSAllowsArbitraryLoads<\/key>\s*<false\/>/,
  'iOS ATS must not allow arbitrary remote HTTP loads.',
);
assertMatches(
  infoPlist,
  /<key>NSAllowsLocalNetworking<\/key>\s*<true\/>/,
  'iOS ATS must allow local-network HTTP for self-hosted development.',
);
assertMatches(
  infoPlist,
  /<key>NSMicrophoneUsageDescription<\/key>\s*<string>[^<]+<\/string>/,
  'iOS Info.plist must explain microphone access for LiveKit project calls.',
);
assertMatches(
  infoPlist,
  /<key>NSLocalNetworkUsageDescription<\/key>\s*<string>[^<]+<\/string>/,
  'iOS Info.plist must explain local-network access for self-hosted servers.',
);

assertNonEmptyFile(
  'ios/TaskNebulaMobile/PrivacyInfo.xcprivacy',
  'iOS privacy manifest must exist for App Store-ready bare native builds.',
);
const privacyManifest = read('ios/TaskNebulaMobile/PrivacyInfo.xcprivacy');
assertMatches(
  privacyManifest,
  /<key>NSPrivacyTracking<\/key>\s*<false\/>/,
  'iOS privacy manifest must declare tracking as disabled.',
);
assertMatches(
  privacyManifest,
  /<key>NSPrivacyCollectedDataTypes<\/key>\s*<array\/>/,
  'iOS privacy manifest must explicitly declare collected data types.',
);
for (const accessedApiType of [
  'NSPrivacyAccessedAPICategoryFileTimestamp',
  'NSPrivacyAccessedAPICategoryUserDefaults',
  'NSPrivacyAccessedAPICategorySystemBootTime',
]) {
  assertIncludes(
    privacyManifest,
    `<string>${accessedApiType}</string>`,
    `iOS privacy manifest must declare ${accessedApiType}.`,
  );
}

for (const fontFile of nativeFontFiles) {
  assertFileExists(`assets/fonts/${fontFile}`, `Shared mobile font asset ${fontFile} must exist.`);
  assertFileExists(
    `android/app/src/main/assets/fonts/${fontFile}`,
    `Android native font asset ${fontFile} must be bundled under app/src/main/assets/fonts.`,
  );
  assertFileExists(
    `ios/TaskNebulaMobile/Fonts/${fontFile}`,
    `iOS native font asset ${fontFile} must be present under TaskNebulaMobile/Fonts.`,
  );
  assertIncludes(
    infoPlist,
    `<string>${fontFile}</string>`,
    `iOS Info.plist UIAppFonts must register ${fontFile}.`,
  );
}

for (const locale of expectedLocales) {
  const relativePath = `ios/TaskNebulaMobile/${locale}.lproj/InfoPlist.strings`;
  let strings;
  try {
    strings = read(relativePath);
  } catch {
    assert(false, `iOS ${relativePath} must localize native permission prompts.`);
    continue;
  }

  assertMatches(
    strings,
    /"NSMicrophoneUsageDescription"\s*=\s*"[^"]+";/,
    `iOS ${relativePath} must localize NSMicrophoneUsageDescription.`,
  );
  assertMatches(
    strings,
    /"NSLocalNetworkUsageDescription"\s*=\s*"[^"]+";/,
    `iOS ${relativePath} must localize NSLocalNetworkUsageDescription.`,
  );
}

const appDelegate = read('ios/TaskNebulaMobile/AppDelegate.swift');
assertIncludes(
  appDelegate,
  'import livekit_react_native',
  'iOS AppDelegate must import the LiveKit React Native module.',
);
assertIncludes(
  appDelegate,
  'LivekitReactNative.setup()',
  'iOS AppDelegate must initialize LiveKit before React Native startup.',
);
assertIncludes(
  appDelegate,
  'withModuleName: "TaskNebulaMobile"',
  'iOS AppDelegate module name must match app.json.',
);
assertIncludes(
  appDelegate,
  'import React_RCTLinking',
  'iOS AppDelegate must import React_RCTLinking for native deep links.',
);
assertIncludes(
  appDelegate,
  'open url: URL',
  'iOS AppDelegate must forward custom scheme URLs to React Native Linking.',
);
assertIncludes(
  appDelegate,
  'RCTLinkingManager.application(app, open: url, options: options)',
  'iOS AppDelegate must pass tasknebula:// URLs into React Native Linking.',
);
assertIncludes(
  appDelegate,
  'continue userActivity: NSUserActivity',
  'iOS AppDelegate must forward universal-link user activities to React Native Linking.',
);
assertIncludes(
  appDelegate,
  'continue: userActivity',
  'iOS AppDelegate must pass user activities into React Native Linking.',
);
assertIncludes(
  appDelegate,
  'jsBundleURL(forBundleRoot: "index")',
  'iOS debug builds must load the React Native index bundle.',
);
assertIncludes(
  appDelegate,
  'Bundle.main.url(forResource: "main", withExtension: "jsbundle")',
  'iOS release builds must load the packaged main.jsbundle.',
);

const xcodeProject = read('ios/TaskNebulaMobile.xcodeproj/project.pbxproj');
assertIncludes(
  xcodeProject,
  'InfoPlist.strings in Resources',
  'iOS Xcode project must copy localized InfoPlist.strings into the app bundle.',
);
assertIncludes(
  xcodeProject,
  'PrivacyInfo.xcprivacy in Resources',
  'iOS Xcode project must copy PrivacyInfo.xcprivacy into the app bundle.',
);
assertIncludes(
  xcodeProject,
  'TaskNebulaMobile/PrivacyInfo.xcprivacy',
  'iOS Xcode project must reference the checked privacy manifest.',
);
assertIncludes(
  xcodeProject,
  'TaskNebulaMobile/Fonts',
  'iOS Xcode project must reference the native font asset group.',
);
for (const fontFile of nativeFontFiles) {
  assertIncludes(
    xcodeProject,
    `${fontFile} in Resources`,
    `iOS Xcode project must copy ${fontFile} into the app bundle.`,
  );
}
for (const locale of expectedLocales) {
  assertIncludes(
    xcodeProject,
    `${locale}.lproj/InfoPlist.strings`,
    `iOS Xcode project must reference ${locale}.lproj/InfoPlist.strings.`,
  );
}
assertIncludes(
  xcodeProject,
  'PRODUCT_BUNDLE_IDENTIFIER = "io.tasknebula.app";',
  'iOS bundle identifier must stay io.tasknebula.app.',
);
assertIncludes(
  xcodeProject,
  'INFOPLIST_FILE = TaskNebulaMobile/Info.plist;',
  'iOS target must use the checked Info.plist.',
);

if (failures.length) {
  console.error(`Native verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  'Native verification passed: bare React Native, no Expo, self-hosted links configured.',
);
