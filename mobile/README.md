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
temporary keystore.

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
