import packageJson from '../../package.json';

declare const __TASKNEBULA_API_URL__: string | null;

const envApiBaseUrl =
  typeof __TASKNEBULA_API_URL__ === 'string' ? __TASKNEBULA_API_URL__ : undefined;

function configuredApiBaseUrl(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.replace(/\/+$/, '') : null;
}

export const config = {
  appVersion: packageJson.version,
  apiBaseUrl: configuredApiBaseUrl(envApiBaseUrl),
};
