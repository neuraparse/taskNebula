# TaskNebula Mobile

Bare React Native mobile app for TaskNebula.

The app is part of the root pnpm/Turbo workspace as `@tasknebula/mobile`.
Run commands from the repository root unless you are using the native platform
tooling directly.

```bash
pnpm install
pnpm --filter @tasknebula/mobile dev
```

Focused checks:

```bash
pnpm --filter @tasknebula/mobile build
pnpm --filter @tasknebula/mobile i18n:check
pnpm --filter @tasknebula/mobile openapi:check
pnpm --filter @tasknebula/mobile native:verify
pnpm --filter @tasknebula/mobile ios:verify-bundle
pnpm --filter @tasknebula/mobile android:verify-build
pnpm --filter @tasknebula/mobile test
pnpm --filter @tasknebula/mobile type-check
pnpm --filter @tasknebula/mobile lint
```

`build` is the platform-SDK-light packageability check used by the monorepo
build: it verifies the bare native project shape and creates a React Native iOS
release JS bundle. Android APK signing/build verification remains in
`android:verify-build` because it requires a full Android SDK.

Native builds run through the React Native Community CLI:

```bash
pnpm --filter @tasknebula/mobile android
pnpm --filter @tasknebula/mobile ios
```

The iOS target uses automatic signing and reads `TASKNEBULA_DEVELOPMENT_TEAM`
when a device or archive build is requested. Set it to the real Apple Team ID;
Xcode then creates or selects the provisioning profile for the bundle identifier
`io.tasknebula.app`. For CI/manual profiles, override `CODE_SIGN_STYLE` and
`PROVISIONING_PROFILE_SPECIFIER` in the `xcodebuild archive` command. No Apple
team or provisioning profile is stored in source control.

For example, CI can pass the real team without changing the project file:

```bash
xcodebuild -project mobile/ios/TaskNebulaMobile.xcodeproj \
  -scheme TaskNebulaMobile -configuration Release archive \
  TASKNEBULA_DEVELOPMENT_TEAM="$TASKNEBULA_DEVELOPMENT_TEAM" \
  -archivePath "$PWD/build/TaskNebulaMobile.xcarchive"
```

Android `local.properties` is machine-specific and intentionally ignored. On
macOS, point Gradle at the installed SDK with
`export ANDROID_HOME="$HOME/Library/Android/sdk"` (or let Android Studio create
`android/local.properties` with that path); never keep an `/opt/android-sdk`
path copied from another machine.

Android release builds are never debug-signed. Provide signing properties from
CI secrets or your local Gradle user properties:

```bash
cd mobile/android
./gradlew :app:bundleRelease \
  -PtasknebulaUploadStoreFile=/absolute/path/tasknebula-release.keystore \
  -PtasknebulaUploadStorePassword="$TASKNEBULA_UPLOAD_STORE_PASSWORD" \
  -PtasknebulaUploadKeyAlias="$TASKNEBULA_UPLOAD_KEY_ALIAS" \
  -PtasknebulaUploadKeyPassword="$TASKNEBULA_UPLOAD_KEY_PASSWORD"
```

For CI-grade Android build verification on Linux, run:

```bash
pnpm --filter @tasknebula/mobile android:verify-build
```

The verifier assembles a debug APK, confirms unsigned release builds fail
closed, creates a temporary local test keystore, assembles a signed release
APK, verifies the APK signature with Android SDK `apksigner`, and removes the
temporary keystore. The resulting `CN=TaskNebula Test` APK is verification-only
and must never be uploaded; production release builds require the real upload
keystore properties shown above.

Set `TASKNEBULA_API_URL` in `mobile/.env` only when you want a local default
for development. The app is designed for self-hosted TaskNebula installs and
asks the user for the server URL on first launch.

If the connected server has an empty database, the app detects `/api/setup`
and opens the first-run admin setup screen before normal sign-in.

Local self-hosted URLs:

- iOS simulator can use `http://localhost:3000`.
- Android emulator should use `http://10.0.2.2:3000`.
- Physical devices need the LAN IP or HTTPS hostname of the server.
- Android cleartext HTTP is enabled by default for self-hosted/LAN testing.
  Build with `-PtasknebulaAllowCleartext=false` when you require HTTPS-only.
- iOS allows local-network HTTP via ATS local networking; public remote HTTP
  should use HTTPS.
- Native auth links can use the `tasknebula://` scheme, for example
  `tasknebula://connect?server=https%3A%2F%2Ftasks.example.com` or
  `tasknebula://auth/reset-password?server=https%3A%2F%2Ftasks.example.com&token=...`.
- If GitHub or Google login OAuth is configured on the self-hosted server,
  mobile sign-in opens the system browser and returns through
  `tasknebula://auth/oauth` with a short-lived exchange token.
- SAML SSO works from mobile by entering the workspace slug on the sign-in
  screen; the browser returns through `tasknebula://auth/saml` after the IdP
  approves the user.
- Use `pnpm --filter @tasknebula/mobile native:verify` on Linux/CI to guard
  the bare native project shape when iOS build tooling is not available.
- Use `pnpm --filter @tasknebula/mobile ios:verify-bundle` on Linux/CI to prove
  the iOS release JavaScript bundle and assets are packageable without Expo or
  Xcode.

The app uses React Native 0.86, React 19.2, React Navigation, TanStack Query,
MMKV, Keychain-backed secret storage, a local React Native style mapper, 30
device-detected i18n catalogs, and the existing TaskNebula REST/OpenAPI
surface. It has no Expo dependency, managed mobile runtime, cloud build
service, or hosted mobile service requirement.
