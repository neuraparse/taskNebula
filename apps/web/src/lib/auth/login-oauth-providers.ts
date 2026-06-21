import {
  getClientCredentials,
  type ClientCredentials,
} from '@/lib/integrations/client-credentials';

export const LOGIN_OAUTH_PROVIDERS = ['github', 'google'] as const;

export type LoginOAuthProvider = (typeof LOGIN_OAUTH_PROVIDERS)[number];

export type LoginOAuthProviderMap<T> = Record<LoginOAuthProvider, T>;

export type LoginOAuthAvailability = LoginOAuthProviderMap<boolean>;

export function isLoginOAuthProvider(value: unknown): value is LoginOAuthProvider {
  return typeof value === 'string' && (LOGIN_OAUTH_PROVIDERS as readonly string[]).includes(value);
}

export async function getLoginOAuthCredentials(): Promise<
  LoginOAuthProviderMap<ClientCredentials | null>
> {
  const [github, google] = await Promise.all([
    getClientCredentials('github'),
    getClientCredentials('google'),
  ]);

  return { github, google };
}

export async function getLoginOAuthAvailability(): Promise<LoginOAuthAvailability> {
  const credentials = await getLoginOAuthCredentials();

  return {
    github: Boolean(credentials.github),
    google: Boolean(credentials.google),
  };
}
