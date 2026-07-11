#!/usr/bin/env node
/**
 * End-to-end Android build guard for the bare, self-hosted mobile app.
 *
 * This intentionally builds real APKs instead of only inspecting source files:
 * - debug APK must assemble
 * - unsigned release builds must fail closed
 * - signed release APK must assemble with explicit signing properties
 * - release APK signature must verify with Android SDK apksigner
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const androidRoot = path.join(mobileRoot, 'android');
const gradlew = process.platform === 'win32' ? 'gradlew.bat' : './gradlew';
const signingPassword = 'tasknebula-test';
// A representative ABI keeps this end-to-end guard deterministic on clean CI
// runners. Production builds can still use the full architecture list from
// android/gradle.properties, or override this check when all ABIs are needed.
const verificationArchitectures =
  process.env.TASKNEBULA_ANDROID_VERIFY_ARCHITECTURES?.trim() || 'arm64-v8a';
const architectureArgs = [`-PreactNativeArchitectures=${verificationArchitectures}`];
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

const debugApk = path.join(androidRoot, 'app/build/outputs/apk/debug/app-debug.apk');
const releaseApk = path.join(androidRoot, 'app/build/outputs/apk/release/app-release.apk');
let tempDir;

function commandEnv() {
  const env = { ...process.env, NO_COLOR: '1' };
  delete env.FORCE_COLOR;
  return env;
}

function fail(message) {
  console.error(`Android build verification failed: ${message}`);
  process.exit(1);
}

function run(label, command, args, options = {}) {
  console.log(`\n[android-build] ${label}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? androidRoot,
    encoding: 'utf8',
    env: commandEnv(),
    stdio: options.capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });

  if (result.error) {
    fail(`${command} could not start: ${result.error.message}`);
  }

  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (options.expectFailure) {
    if (result.status === 0) {
      fail(`${label} unexpectedly succeeded.`);
    }
    if (options.mustContain && !output.includes(options.mustContain)) {
      fail(`${label} failed for an unexpected reason:\n${output}`);
    }
    console.log(`[android-build] expected failure confirmed`);
    return output;
  }

  if (result.status !== 0) {
    if (options.capture && output.trim()) console.error(output);
    fail(`${label} exited with status ${result.status}.`);
  }

  return output;
}

function assertFile(label, filePath, minBytes = 1) {
  if (!fs.existsSync(filePath)) fail(`${label} was not created at ${filePath}.`);
  const size = fs.statSync(filePath).size;
  if (size < minBytes) fail(`${label} is unexpectedly small (${size} bytes).`);
  console.log(`[android-build] ${label}: ${filePath} (${size} bytes)`);
}

function readAndroidSdkDir() {
  const localProperties = path.join(androidRoot, 'local.properties');
  if (!fs.existsSync(localProperties)) return null;
  const match = fs.readFileSync(localProperties, 'utf8').match(/^sdk\.dir=(.+)$/m);
  return match?.[1]?.trim() || null;
}

function findApksigner() {
  const executable = process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
  const sdkRoots = [
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    readAndroidSdkDir(),
    '/opt/android-sdk',
  ].filter(Boolean);

  for (const sdkRoot of sdkRoots) {
    const buildTools = path.join(sdkRoot, 'build-tools');
    if (!fs.existsSync(buildTools)) continue;
    const versions = fs
      .readdirSync(buildTools)
      .filter((entry) => fs.statSync(path.join(buildTools, entry)).isDirectory())
      .sort()
      .reverse();
    for (const version of versions) {
      const candidate = path.join(buildTools, version, executable);
      if (fs.existsSync(candidate)) return candidate;
    }
  }

  return null;
}

function createTemporaryKeystore() {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tasknebula-android-signing-'));
  const keystore = path.join(tempDir, 'upload-test.jks');
  run(
    'create temporary release keystore',
    'keytool',
    [
      '-genkeypair',
      '-noprompt',
      '-storetype',
      'PKCS12',
      '-keystore',
      keystore,
      '-storepass',
      signingPassword,
      '-alias',
      'tasknebula-test',
      '-keypass',
      signingPassword,
      '-keyalg',
      'RSA',
      '-keysize',
      '2048',
      '-validity',
      '1',
      '-dname',
      'CN=TaskNebula Test,O=TaskNebula,C=US',
    ],
    { cwd: mobileRoot },
  );
  return keystore;
}

try {
  console.log(`[android-build] verification architectures: ${verificationArchitectures}`);
  run('assemble debug APK', gradlew, [':app:assembleDebug', ...architectureArgs]);
  assertFile('debug APK', debugApk, 1024 * 1024);

  run(
    'verify release signing fails closed without signing properties',
    gradlew,
    [
      ':app:assembleRelease',
      ...architectureArgs,
      '-PtasknebulaUploadStoreFile=',
      '-PtasknebulaUploadStorePassword=',
      '-PtasknebulaUploadKeyAlias=',
      '-PtasknebulaUploadKeyPassword=',
    ],
    {
      capture: true,
      expectFailure: true,
      mustContain: 'Android release builds require tasknebulaUploadStoreFile',
    },
  );

  const keystore = createTemporaryKeystore();
  run('assemble signed release APK', gradlew, [
    ':app:assembleRelease',
    ...architectureArgs,
    `-PtasknebulaUploadStoreFile=${keystore}`,
    `-PtasknebulaUploadStorePassword=${signingPassword}`,
    '-PtasknebulaUploadKeyAlias=tasknebula-test',
    `-PtasknebulaUploadKeyPassword=${signingPassword}`,
  ]);
  assertFile('signed release APK', releaseApk, 1024 * 1024);

  const apksigner = findApksigner();
  if (!apksigner) fail('Android SDK apksigner was not found.');
  const signatureOutput = run(
    'verify signed release APK',
    apksigner,
    ['verify', '--verbose', releaseApk],
    {
      capture: true,
      cwd: mobileRoot,
    },
  );
  if (!signatureOutput.includes('Verifies')) {
    fail(`apksigner did not verify the release APK:\n${signatureOutput}`);
  }

  const apkEntries = run('list signed release APK contents', 'jar', ['tf', releaseApk], {
    capture: true,
    cwd: mobileRoot,
  });
  for (const fontFile of nativeFontFiles) {
    const apkPath = `assets/fonts/${fontFile}`;
    if (!apkEntries.includes(apkPath)) {
      fail(`signed release APK does not contain native font asset ${apkPath}.`);
    }
  }

  console.log('\nAndroid build verification passed.');
} finally {
  if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true });
}
