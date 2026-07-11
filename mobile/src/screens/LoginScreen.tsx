import { useCallback, useEffect, useState } from 'react';
import { Linking } from 'react-native';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from '@/components/native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Github,
  Globe2,
  KeyRound,
  LogIn,
  MailCheck,
  UserPlus,
  type LucideIcon,
} from 'lucide-react-native';
import { Trans, useTranslation } from 'react-i18next';
import { z } from 'zod';

import {
  getLoginOAuthAvailability,
  mobileOAuthAuthorizeUrl,
  mobileSamlAuthorizeUrl,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  signup as signupAccount,
  type LoginOAuthAvailability,
  type LoginOAuthProvider,
  verifyEmail,
} from '@/api/auth';
import { ApiError } from '@/api/client';
import { Button, Screen, TextField } from '@/components/ui';
import { useThemeColors } from '@/design/theme-context';
import { extractAuthTokenInput, parseSignupInviteInput } from '@/lib/auth-links';
import { postAuthIntentFromCallbackUrl } from '@/lib/deep-link-routing';
import { useContentLinkIntent } from '@/stores/content-link-intent';
import { useAuthIntent } from '@/stores/auth-intent';
import { useSession } from '@/stores/session';

const loginSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(1, 'passwordRequired'),
});

const signupSchema = z.object({
  name: z.string().min(1, 'nameRequired'),
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
  password: z.string().min(8, 'passwordMinLength'),
  inviteToken: z.string(),
  projectInviteToken: z.string(),
});

const resetSchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
});

const completeResetSchema = z.object({
  token: z.string().min(1, 'tokenRequired'),
  newPassword: z.string().min(8, 'passwordMinLength'),
  confirmPassword: z.string().min(8, 'passwordMinLength'),
});

const verifySchema = z.object({
  email: z.string().min(1, 'emailRequired').email('emailInvalid'),
});

type LoginValues = z.infer<typeof loginSchema>;
type SignupValues = z.infer<typeof signupSchema>;
type ResetValues = z.infer<typeof resetSchema>;
type CompleteResetValues = z.infer<typeof completeResetSchema>;
type VerifyValues = z.infer<typeof verifySchema>;
type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset' | 'verify';
type Notice = { tone: 'success' | 'error'; message: string } | null;

function emailVerificationErrorKey(reason?: string): string {
  if (reason === 'expired') return 'errors.emailVerificationExpired';
  if (reason === 'already_used') return 'errors.emailVerificationAlreadyUsed';
  if (reason === 'server_error') return 'errors.verificationEmailFailed';
  return 'errors.emailVerificationInvalid';
}

function alpha(hex: string, opacity: string): string {
  return `${hex}${opacity}`;
}

const MODE_ICON: Record<AuthMode, LucideIcon> = {
  signin: LogIn,
  signup: UserPlus,
  forgot: KeyRound,
  reset: KeyRound,
  verify: MailCheck,
};

function AuthModeButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const colors = useThemeColors();

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={[styles.modeButton, active ? { backgroundColor: colors.primary } : null]}
      className="active:opacity-80"
    >
      <Text
        style={[
          styles.modeButtonText,
          { color: active ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function AuthNotice({ notice }: { notice: Notice }) {
  const colors = useThemeColors();
  if (!notice) return null;

  const isSuccess = notice.tone === 'success';
  const color = isSuccess ? colors.success : colors.destructive;

  return (
    <View
      style={[
        styles.notice,
        {
          borderColor: alpha(color, '55'),
          backgroundColor: alpha(color, '14'),
        },
      ]}
    >
      {isSuccess ? <MailCheck size={16} color={color} /> : <KeyRound size={16} color={color} />}
      <Text style={[styles.noticeText, { color }]}>{notice.message}</Text>
    </View>
  );
}

export function LoginScreen() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const signIn = useSession((s) => s.signIn);
  const signInWithMobileOAuthToken = useSession((s) => s.signInWithMobileOAuthToken);
  const signInWithSamlToken = useSession((s) => s.signInWithSamlToken);
  const forgetServer = useSession((s) => s.forgetServer);
  const serverUrl = useSession((s) => s.serverUrl);
  const pendingAuthIntent = useAuthIntent((s) => s.pending);
  const consumeAuthIntent = useAuthIntent((s) => s.consume);
  const setPendingAuthIntent = useAuthIntent((s) => s.setPending);
  const setPendingContentLink = useContentLinkIntent((s) => s.setPending);

  const [mode, setMode] = useState<AuthMode>('signin');
  const [submitting, setSubmitting] = useState<AuthMode | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [signInProjectInviteToken, setSignInProjectInviteToken] = useState<string | null>(null);
  const [signInCallbackUrl, setSignInCallbackUrl] = useState<string | null>(null);
  const [signInIntentRawUrl, setSignInIntentRawUrl] = useState<string | null>(null);
  const [ssoWorkspaceSlug, setSsoWorkspaceSlug] = useState('');
  const [ssoOpening, setSsoOpening] = useState(false);
  const [oauthProviders, setOauthProviders] = useState<LoginOAuthAvailability>({
    github: false,
    google: false,
  });
  const [oauthOpening, setOauthOpening] = useState<LoginOAuthProvider | null>(null);

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const signupForm = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      inviteToken: '',
      projectInviteToken: '',
    },
  });

  const resetForm = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: '' },
  });

  const completeResetForm = useForm<CompleteResetValues>({
    resolver: zodResolver(completeResetSchema),
    defaultValues: { token: '', newPassword: '', confirmPassword: '' },
  });

  const verifyForm = useForm<VerifyValues>({
    resolver: zodResolver(verifySchema),
    defaultValues: { email: '' },
  });

  const queueCallbackContentLink = useCallback(
    (callbackUrl?: string | null): void => {
      const postAuthIntent = postAuthIntentFromCallbackUrl(callbackUrl, serverUrl);
      if (postAuthIntent?.kind === 'project-invite') setPendingAuthIntent(postAuthIntent.intent);
      else if (postAuthIntent?.kind === 'content') setPendingContentLink(postAuthIntent.intent);
    },
    [serverUrl, setPendingAuthIntent, setPendingContentLink],
  );

  const queueProjectDestination = useCallback(
    (projectKey?: string | null): void => {
      const cleanProjectKey = projectKey?.trim();
      if (!cleanProjectKey) return;

      setPendingContentLink({
        kind: 'project',
        rawUrl: serverUrl
          ? `${serverUrl}/projects/${encodeURIComponent(cleanProjectKey)}`
          : `tasknebula://projects/${encodeURIComponent(cleanProjectKey)}`,
        ...(serverUrl ? { serverUrl } : {}),
        projectId: cleanProjectKey,
        section: 'views',
      });
    },
    [serverUrl, setPendingContentLink],
  );

  const signupProjectInviteTokenInput = signupForm.watch('projectInviteToken');
  const signupProjectInviteToken =
    parseSignupInviteInput(signupProjectInviteTokenInput).projectInviteToken ??
    signupProjectInviteTokenInput.trim();
  const signInPostAuthCallbackUrl = signInProjectInviteToken
    ? `/join/project/${encodeURIComponent(signInProjectInviteToken)}`
    : signInCallbackUrl;
  const signupPostAuthCallbackUrl = signupProjectInviteToken
    ? `/join/project/${encodeURIComponent(signupProjectInviteToken)}`
    : null;

  useEffect(() => {
    if (!serverUrl) {
      setOauthProviders({ github: false, google: false });
      return undefined;
    }

    let mounted = true;
    void getLoginOAuthAvailability()
      .then((providers) => {
        if (mounted) setOauthProviders(providers);
      })
      .catch(() => {
        if (mounted) setOauthProviders({ github: false, google: false });
      });

    return () => {
      mounted = false;
    };
  }, [serverUrl]);

  useEffect(() => {
    if (!pendingAuthIntent) return;
    if (pendingAuthIntent.kind === 'integration-oauth') return;
    const intent = consumeAuthIntent();
    if (!intent) return;

    setNotice(null);
    setSignInProjectInviteToken(null);
    setSignInCallbackUrl(null);
    setSignInIntentRawUrl(null);
    if (intent.kind === 'signin') {
      setMode('signin');
      if (intent.email) loginForm.setValue('email', intent.email, { shouldValidate: true });
      setSignInProjectInviteToken(intent.projectInviteToken ?? null);
      setSignInCallbackUrl(intent.callbackUrl ?? null);
      setSignInIntentRawUrl(intent.rawUrl);
      if (intent.signinStatus === 'verified') {
        setNotice({ tone: 'success', message: t('onboarding.emailVerified') });
      } else if (intent.signinStatus === 'reset') {
        setNotice({ tone: 'success', message: t('onboarding.passwordResetComplete') });
      } else if (intent.signinError === 'CredentialsSignin') {
        setNotice({ tone: 'error', message: t('onboarding.invalidCredentials') });
      } else if (intent.signinError === 'Verification') {
        setNotice({ tone: 'error', message: t('errors.emailVerificationInvalid') });
      } else if (intent.signinError) {
        setNotice({ tone: 'error', message: t('errors.oauthSignInFailed') });
      }
      return;
    }

    if (intent.kind === 'signup') {
      setMode('signup');
      if (intent.email) signupForm.setValue('email', intent.email, { shouldValidate: true });
      if (intent.inviteToken) {
        signupForm.setValue('inviteToken', intent.inviteToken, { shouldValidate: true });
      }
      if (intent.projectInviteToken) {
        signupForm.setValue('projectInviteToken', intent.projectInviteToken, {
          shouldValidate: true,
        });
      }
      return;
    }

    if (intent.kind === 'reset-password') {
      setMode('reset');
      completeResetForm.setValue('token', intent.token, { shouldValidate: true });
      return;
    }

    if (intent.kind === 'forgot-password') {
      setMode('forgot');
      if (intent.email) resetForm.setValue('email', intent.email, { shouldValidate: true });
      return;
    }

    if (intent.kind === 'login-oauth') {
      setMode('signin');
      if (intent.status === 'error' || !intent.token) {
        setNotice({ tone: 'error', message: t('errors.oauthSignInFailed') });
        return;
      }

      setSubmitting('signin');
      void signInWithMobileOAuthToken(intent.token)
        .then(() => {
          queueCallbackContentLink(intent.callbackUrl);
        })
        .catch(() => {
          setNotice({ tone: 'error', message: t('errors.oauthSignInFailed') });
        })
        .finally(() => setSubmitting(null));
      return;
    }

    if (intent.kind === 'saml') {
      setMode('signin');
      if (intent.workspace) setSsoWorkspaceSlug(intent.workspace);
      if (intent.status === 'error' || !intent.token) {
        setNotice({ tone: 'error', message: t('errors.samlSignInFailed') });
        return;
      }

      setSubmitting('signin');
      void signInWithSamlToken(intent.token)
        .then(() => {
          queueCallbackContentLink(intent.callbackUrl);
        })
        .catch(() => {
          setNotice({ tone: 'error', message: t('errors.samlSignInFailed') });
        })
        .finally(() => setSubmitting(null));
      return;
    }

    if (intent.kind === 'verify-email') {
      setMode('verify');
      if (intent.email) verifyForm.setValue('email', intent.email, { shouldValidate: true });
      if (intent.verifyError && !intent.token) {
        setNotice({ tone: 'error', message: t(emailVerificationErrorKey(intent.verifyError)) });
        return;
      }
      if (intent.token) {
        setSubmitting('verify');
        void verifyEmail(intent.token)
          .then((result) => {
            if (result.verified) {
              setMode('signin');
              setNotice({ tone: 'success', message: t('onboarding.emailVerified') });
              return;
            }
            setNotice({ tone: 'error', message: t('errors.emailVerificationInvalid') });
          })
          .catch((err: unknown) => {
            const message =
              err instanceof ApiError
                ? t(emailVerificationErrorKey(err.message))
                : t('errors.emailVerificationInvalid');
            setNotice({
              tone: 'error',
              message,
            });
          })
          .finally(() => setSubmitting(null));
      }
    }
  }, [
    completeResetForm,
    consumeAuthIntent,
    loginForm,
    pendingAuthIntent,
    queueCallbackContentLink,
    resetForm,
    signInWithMobileOAuthToken,
    signInWithSamlToken,
    signupForm,
    t,
    verifyForm,
  ]);

  const fieldError = (code?: string): string | undefined => {
    if (!code) return undefined;
    if (code === 'emailInvalid') return t('validation.emailInvalid');
    if (code === 'emailRequired') return t('validation.emailRequired');
    if (code === 'nameRequired') return t('validation.nameRequired');
    if (code === 'passwordRequired') return t('validation.passwordRequired');
    if (code === 'passwordMinLength') return t('validation.passwordMinLength');
    if (code === 'tokenRequired') return t('validation.tokenRequired');
    return t('validation.invalidField');
  };

  const authError = (err: unknown, fallback: string): string => {
    if (err instanceof ApiError) {
      if (err.status === 401) return t('onboarding.invalidCredentials');
      if (err.status === 429) return t('errors.tooManyRequests');
      if (err.message === 'REGISTRATION_INVITE_REQUIRED') {
        return t('errors.registrationInviteRequired');
      }
      if (err.message === 'REGISTRATION_ADMIN_ONLY') {
        return t('errors.registrationAdminOnly');
      }
      if (err.message === 'INVALID_PROJECT_INVITE') {
        return t('errors.projectInviteInvalid');
      }
      if (err.message === 'expired') return t('errors.emailVerificationExpired');
      if (err.message === 'already_used') return t('errors.emailVerificationAlreadyUsed');
      if (err.message === 'invalid') return t('errors.emailVerificationInvalid');
      if (err.message === 'user_missing') return t('errors.emailVerificationInvalid');
      if (err.message === 'server_error') return t('errors.verificationEmailFailed');
    }
    return fallback;
  };

  const switchMode = (nextMode: AuthMode): void => {
    setMode(nextMode);
    setNotice(null);
  };

  const applySignupInviteInput = (
    value: string,
    target: 'inviteToken' | 'projectInviteToken',
    onChange: (value: string) => void,
  ): void => {
    const parsed = parseSignupInviteInput(value);
    if (parsed.email && !signupForm.getValues('email').trim()) {
      signupForm.setValue('email', parsed.email, { shouldValidate: true });
    }

    if (target === 'inviteToken') {
      if (parsed.inviteToken) {
        onChange(parsed.inviteToken);
        return;
      }
      if (parsed.projectInviteToken) {
        signupForm.setValue('projectInviteToken', parsed.projectInviteToken, {
          shouldValidate: true,
        });
        onChange('');
        return;
      }
    }

    if (parsed.projectInviteToken) {
      onChange(parsed.projectInviteToken);
      return;
    }
    if (parsed.inviteToken) {
      signupForm.setValue('inviteToken', parsed.inviteToken, { shouldValidate: true });
      onChange('');
      return;
    }

    onChange(value);
  };

  const onSignIn = async (values: LoginValues): Promise<void> => {
    setNotice(null);
    setSubmitting('signin');
    try {
      await signIn(values.email, values.password);
      if (signInProjectInviteToken) {
        setPendingAuthIntent({
          kind: 'signin',
          rawUrl: signInIntentRawUrl ?? 'tasknebula://auth/signin',
          ...(serverUrl ? { serverUrl } : {}),
          projectInviteToken: signInProjectInviteToken,
        });
        return;
      }
      queueCallbackContentLink(signInCallbackUrl);
    } catch (err: unknown) {
      setNotice({ tone: 'error', message: authError(err, t('onboarding.invalidCredentials')) });
    } finally {
      setSubmitting(null);
    }
  };

  const onStartOAuth = async (
    provider: LoginOAuthProvider,
    callbackUrl: string | null,
  ): Promise<void> => {
    setNotice(null);
    setOauthOpening(provider);
    try {
      await Linking.openURL(mobileOAuthAuthorizeUrl(provider, callbackUrl));
    } catch {
      setNotice({ tone: 'error', message: t('errors.oauthSignInFailed') });
    } finally {
      setOauthOpening(null);
    }
  };

  const onStartSso = async (): Promise<void> => {
    const slug = ssoWorkspaceSlug.trim();
    if (!slug) {
      setNotice({ tone: 'error', message: t('validation.required') });
      return;
    }

    setNotice(null);
    setSsoOpening(true);
    try {
      await Linking.openURL(mobileSamlAuthorizeUrl(slug, signInPostAuthCallbackUrl));
    } catch {
      setNotice({ tone: 'error', message: t('errors.samlSignInFailed') });
    } finally {
      setSsoOpening(false);
    }
  };

  const onSignup = async (values: SignupValues): Promise<void> => {
    setNotice(null);
    setSubmitting('signup');
    const normalizedEmail = values.email.trim().toLowerCase();
    const inviteInput = parseSignupInviteInput(values.inviteToken);
    const projectInput = parseSignupInviteInput(values.projectInviteToken);
    const inviteToken =
      inviteInput.inviteToken ??
      (!inviteInput.projectInviteToken ? values.inviteToken.trim() || undefined : undefined);
    const projectInviteToken =
      projectInput.projectInviteToken ??
      inviteInput.projectInviteToken ??
      (values.projectInviteToken.trim() || undefined);
    try {
      const result = await signupAccount({
        name: values.name.trim(),
        email: normalizedEmail,
        password: values.password,
        ...(inviteToken ? { inviteToken } : {}),
        ...(projectInviteToken ? { projectInviteToken } : {}),
      });

      try {
        await signIn(normalizedEmail, values.password);
        queueProjectDestination(result.projectInvite?.projectKey);
      } catch {
        loginForm.setValue('email', normalizedEmail);
        verifyForm.setValue('email', normalizedEmail);
        setMode('verify');
        setNotice({ tone: 'success', message: t('onboarding.signupSubmitted') });
      }
    } catch (err: unknown) {
      setNotice({ tone: 'error', message: authError(err, t('errors.signupFailed')) });
    } finally {
      setSubmitting(null);
    }
  };

  const onPasswordReset = async (values: ResetValues): Promise<void> => {
    setNotice(null);
    setSubmitting('forgot');
    try {
      await requestPasswordReset(values.email);
      resetForm.reset({ email: values.email });
      setNotice({ tone: 'success', message: t('onboarding.resetLinkSent') });
    } catch (err: unknown) {
      setNotice({ tone: 'error', message: authError(err, t('errors.passwordResetFailed')) });
    } finally {
      setSubmitting(null);
    }
  };

  const onCompletePasswordReset = async (values: CompleteResetValues): Promise<void> => {
    setNotice(null);
    if (values.newPassword !== values.confirmPassword) {
      setNotice({ tone: 'error', message: t('validation.passwordsNoMatch') });
      return;
    }
    const token = extractAuthTokenInput(values.token, ['token']);
    setSubmitting('reset');
    try {
      await resetPassword(token, values.newPassword);
      completeResetForm.reset({ token: '', newPassword: '', confirmPassword: '' });
      setMode('signin');
      setNotice({ tone: 'success', message: t('onboarding.passwordResetComplete') });
    } catch (err: unknown) {
      setNotice({ tone: 'error', message: authError(err, t('errors.passwordResetFailed')) });
    } finally {
      setSubmitting(null);
    }
  };

  const onResendVerification = async (values: VerifyValues): Promise<void> => {
    setNotice(null);
    setSubmitting('verify');
    try {
      await requestEmailVerification(values.email);
      verifyForm.reset({ email: values.email });
      setNotice({ tone: 'success', message: t('onboarding.verificationLinkSent') });
    } catch (err: unknown) {
      setNotice({ tone: 'error', message: authError(err, t('errors.verificationEmailFailed')) });
    } finally {
      setSubmitting(null);
    }
  };

  const openLegalPath = async (path: '/terms' | '/privacy'): Promise<void> => {
    if (!serverUrl) {
      setNotice({ tone: 'error', message: t('errors.noServerConfigured') });
      return;
    }

    try {
      await Linking.openURL(`${serverUrl.replace(/\/$/, '')}${path}`);
    } catch {
      setNotice({ tone: 'error', message: t('errors.openLinkFailed') });
    }
  };

  const Icon = MODE_ICON[mode];
  const isBusy = submitting !== null || oauthOpening !== null || ssoOpening;
  const hasOAuthProviders = oauthProviders.github || oauthProviders.google;
  const loginErrors = loginForm.formState.errors;
  const signupErrors = signupForm.formState.errors;
  const resetErrors = resetForm.formState.errors;
  const completeResetErrors = completeResetForm.formState.errors;
  const verifyErrors = verifyForm.formState.errors;

  const renderOAuthButtons = (callbackUrl: string | null) =>
    hasOAuthProviders ? (
      <View className="gap-3">
        {oauthProviders.github ? (
          <Button
            title={t('onboarding.continueWithGithub')}
            icon={Github}
            variant="secondary"
            loading={oauthOpening === 'github'}
            disabled={isBusy}
            onPress={() => {
              void onStartOAuth('github', callbackUrl);
            }}
          />
        ) : null}
        {oauthProviders.google ? (
          <Button
            title={t('onboarding.continueWithGoogle')}
            icon={Globe2}
            variant="secondary"
            loading={oauthOpening === 'google'}
            disabled={isBusy}
            onPress={() => {
              void onStartOAuth('google', callbackUrl);
            }}
          />
        ) : null}
        <View style={styles.oauthDivider}>
          <View style={[styles.oauthDividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.oauthDividerText, { color: colors.mutedForeground }]}>
            {t('onboarding.orContinueWithEmail')}
          </Text>
          <View style={[styles.oauthDividerLine, { backgroundColor: colors.border }]} />
        </View>
      </View>
    ) : null;

  const authTitle =
    mode === 'signup'
      ? t('onboarding.signupTitle')
      : mode === 'forgot'
        ? t('onboarding.forgotTitle')
        : mode === 'reset'
          ? t('onboarding.resetPasswordTitle')
          : mode === 'verify'
            ? t('onboarding.verifyTitle')
            : t('onboarding.loginTitle');
  const authSubtitle =
    mode === 'signup'
      ? t('onboarding.signupSubtitle')
      : mode === 'forgot'
        ? t('onboarding.forgotSubtitle')
        : mode === 'reset'
          ? t('onboarding.resetPasswordSubtitle')
          : mode === 'verify'
            ? t('onboarding.verifySubtitle')
            : t('onboarding.loginSubtitle');

  const renderSignInForm = () => (
    <View className="gap-4">
      {renderOAuthButtons(signInPostAuthCallbackUrl)}

      <View style={[styles.ssoBox, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Text className="text-foreground text-sm font-semibold">
          {t('onboarding.continueWithSso')}
        </Text>
        <TextField
          label={t('onboarding.ssoWorkspaceSlug')}
          placeholder={t('onboarding.ssoWorkspaceSlugPlaceholder')}
          value={ssoWorkspaceSlug}
          onChangeText={(value: string) => setSsoWorkspaceSlug(value.trim().toLowerCase())}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isBusy}
          returnKeyType="go"
          onSubmitEditing={() => {
            void onStartSso();
          }}
        />
        <Button
          title={t('onboarding.continueWithSso')}
          icon={Globe2}
          variant="secondary"
          loading={ssoOpening}
          disabled={isBusy || !ssoWorkspaceSlug.trim()}
          onPress={() => {
            void onStartSso();
          }}
        />
      </View>

      <Controller
        control={loginForm.control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.email')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isBusy}
            error={fieldError(loginErrors.email?.message)}
          />
        )}
      />

      <Controller
        control={loginForm.control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.password')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="password"
            editable={!isBusy}
            returnKeyType="go"
            onSubmitEditing={loginForm.handleSubmit(onSignIn)}
            error={fieldError(loginErrors.password?.message)}
          />
        )}
      />

      <AuthNotice notice={notice} />

      <Button
        title={t('onboarding.signIn')}
        icon={LogIn}
        loading={submitting === 'signin'}
        disabled={isBusy}
        onPress={loginForm.handleSubmit(onSignIn)}
      />
      <Button
        title={t('onboarding.forgotPassword')}
        variant="ghost"
        disabled={isBusy}
        onPress={() => switchMode('forgot')}
      />
    </View>
  );

  const renderSignupForm = () => (
    <View className="gap-4">
      {renderOAuthButtons(signupPostAuthCallbackUrl)}

      <Controller
        control={signupForm.control}
        name="name"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.name')}
            placeholder={t('onboarding.namePlaceholder')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="words"
            autoCorrect={false}
            textContentType="name"
            editable={!isBusy}
            error={fieldError(signupErrors.name?.message)}
          />
        )}
      />

      <Controller
        control={signupForm.control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.email')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isBusy}
            error={fieldError(signupErrors.email?.message)}
          />
        )}
      />

      <Controller
        control={signupForm.control}
        name="password"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.password')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            editable={!isBusy}
            returnKeyType="go"
            onSubmitEditing={signupForm.handleSubmit(onSignup)}
            error={fieldError(signupErrors.password?.message)}
          />
        )}
      />
      <Text className="text-muted-foreground px-1 text-xs">{t('onboarding.passwordHint')}</Text>

      <Controller
        control={signupForm.control}
        name="inviteToken"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.inviteToken')}
            placeholder={t('onboarding.inviteTokenPlaceholder')}
            value={value}
            onChangeText={(text: string) => applySignupInviteInput(text, 'inviteToken', onChange)}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
          />
        )}
      />

      <Controller
        control={signupForm.control}
        name="projectInviteToken"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.projectInviteToken')}
            placeholder={t('onboarding.projectInviteTokenPlaceholder')}
            value={value}
            onChangeText={(text: string) =>
              applySignupInviteInput(text, 'projectInviteToken', onChange)
            }
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
          />
        )}
      />
      <Text className="text-muted-foreground px-1 text-xs">{t('onboarding.inviteTokenHint')}</Text>

      <AuthNotice notice={notice} />

      <Button
        title={t('onboarding.createAccount')}
        icon={UserPlus}
        loading={submitting === 'signup'}
        disabled={isBusy}
        onPress={signupForm.handleSubmit(onSignup)}
      />
      <Text style={[styles.termsText, { color: colors.mutedForeground }]}>
        <Trans
          i18nKey="onboarding.termsAgreement"
          components={{
            terms: (
              <Text
                accessibilityRole="link"
                style={[styles.termsLink, { color: colors.primary }]}
                onPress={() => {
                  void openLegalPath('/terms');
                }}
              />
            ),
            privacy: (
              <Text
                accessibilityRole="link"
                style={[styles.termsLink, { color: colors.primary }]}
                onPress={() => {
                  void openLegalPath('/privacy');
                }}
              />
            ),
          }}
        />
      </Text>
      <Button
        title={t('onboarding.haveAccount')}
        variant="ghost"
        disabled={isBusy}
        onPress={() => switchMode('signin')}
      />
    </View>
  );

  const renderForgotForm = () => (
    <View className="gap-4">
      <Controller
        control={resetForm.control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.email')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isBusy}
            returnKeyType="send"
            onSubmitEditing={resetForm.handleSubmit(onPasswordReset)}
            error={fieldError(resetErrors.email?.message)}
          />
        )}
      />

      <AuthNotice notice={notice} />

      <Button
        title={t('onboarding.sendResetLink')}
        icon={MailCheck}
        loading={submitting === 'forgot'}
        disabled={isBusy}
        onPress={resetForm.handleSubmit(onPasswordReset)}
      />
      <Button
        title={t('onboarding.backToSignIn')}
        variant="ghost"
        disabled={isBusy}
        onPress={() => switchMode('signin')}
      />
      <Button
        title={t('onboarding.haveResetToken')}
        variant="ghost"
        disabled={isBusy}
        onPress={() => switchMode('reset')}
      />
      <Button
        title={t('onboarding.resendVerification')}
        variant="ghost"
        disabled={isBusy}
        onPress={() => switchMode('verify')}
      />
    </View>
  );

  const renderCompleteResetForm = () => (
    <View className="gap-4">
      <Controller
        control={completeResetForm.control}
        name="token"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.resetToken')}
            placeholder={t('onboarding.resetTokenPlaceholder')}
            value={value}
            onChangeText={(text: string) => onChange(extractAuthTokenInput(text, ['token']))}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!isBusy}
            error={fieldError(completeResetErrors.token?.message)}
          />
        )}
      />

      <Controller
        control={completeResetForm.control}
        name="newPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.newPassword')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            editable={!isBusy}
            error={fieldError(completeResetErrors.newPassword?.message)}
          />
        )}
      />

      <Controller
        control={completeResetForm.control}
        name="confirmPassword"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.confirmPassword')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="newPassword"
            editable={!isBusy}
            returnKeyType="go"
            onSubmitEditing={completeResetForm.handleSubmit(onCompletePasswordReset)}
            error={fieldError(completeResetErrors.confirmPassword?.message)}
          />
        )}
      />

      <AuthNotice notice={notice} />

      <Button
        title={t('onboarding.resetPassword')}
        icon={KeyRound}
        loading={submitting === 'reset'}
        disabled={isBusy}
        onPress={completeResetForm.handleSubmit(onCompletePasswordReset)}
      />
      <Button
        title={t('onboarding.backToSignIn')}
        variant="ghost"
        disabled={isBusy}
        onPress={() => switchMode('signin')}
      />
    </View>
  );

  const renderVerifyForm = () => (
    <View className="gap-4">
      <Controller
        control={verifyForm.control}
        name="email"
        render={({ field: { onChange, onBlur, value } }) => (
          <TextField
            label={t('onboarding.email')}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            editable={!isBusy}
            returnKeyType="send"
            onSubmitEditing={verifyForm.handleSubmit(onResendVerification)}
            error={fieldError(verifyErrors.email?.message)}
          />
        )}
      />

      <AuthNotice notice={notice} />

      <Button
        title={t('onboarding.resendVerification')}
        icon={MailCheck}
        loading={submitting === 'verify'}
        disabled={isBusy}
        onPress={verifyForm.handleSubmit(onResendVerification)}
      />
      <Button
        title={t('onboarding.backToSignIn')}
        variant="ghost"
        disabled={isBusy}
        onPress={() => switchMode('signin')}
      />
    </View>
  );

  const renderActiveForm = () => {
    if (mode === 'signup') return renderSignupForm();
    if (mode === 'forgot') return renderForgotForm();
    if (mode === 'reset') return renderCompleteResetForm();
    if (mode === 'verify') return renderVerifyForm();
    return renderSignInForm();
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={styles.centeredContent}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-8 items-center">
            <View className="bg-primary mb-5 h-16 w-16 items-center justify-center rounded-lg">
              <Icon size={30} color={colors.primaryForeground} />
            </View>
            <Text className="text-foreground text-center text-2xl font-bold">{authTitle}</Text>
            <Text className="text-muted-foreground mt-2 px-4 text-center text-base">
              {authSubtitle}
            </Text>
          </View>

          <View
            style={[styles.modeTabs, { borderColor: colors.border, backgroundColor: colors.card }]}
          >
            <AuthModeButton
              label={t('onboarding.signIn')}
              active={mode === 'signin'}
              onPress={() => switchMode('signin')}
            />
            <AuthModeButton
              label={t('onboarding.createAccount')}
              active={mode === 'signup'}
              onPress={() => switchMode('signup')}
            />
          </View>

          {renderActiveForm()}

          <View className="mt-8 items-center">
            {serverUrl ? (
              <Text className="text-muted-foreground mb-1 text-xs" numberOfLines={1}>
                {serverUrl}
              </Text>
            ) : null}
            <Button
              title={t('onboarding.changeServer')}
              variant="ghost"
              disabled={isBusy}
              onPress={() => {
                void forgetServer();
              }}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centeredContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  modeTabs: {
    flexDirection: 'row',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 4,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  oauthDivider: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 2,
  },
  oauthDividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  oauthDividerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  ssoBox: {
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    padding: 12,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  termsText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  termsLink: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
});
