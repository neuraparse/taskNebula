'use client';

import { useEffect, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Check, HardDrive, Loader2, Mail, Radio, Save, ShieldCheck, UserPlus } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*  Shared types                                                              */
/* -------------------------------------------------------------------------- */

type SmtpResponse = {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    passwordPreview: string | null;
    emailFrom: string;
    updatedAt: string | null;
    updatedBy: string | null;
    configured: boolean;
  };
};

type LivekitResponse = {
  livekit: {
    url: string;
    apiKey: string;
    apiSecretPreview: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
    configured: boolean;
  };
};

type StorageResponse = {
  storage: {
    uploadsDir: string;
    s3Bucket: string;
    s3Region: string;
    s3AccessKey: string;
    s3SecretKeyPreview: string | null;
    updatedAt: string | null;
    updatedBy: string | null;
    configured: boolean;
  };
};

type RegistrationMode = 'allow_registration' | 'invite_only' | 'admin_created_only';

type RegistrationResponse = {
  registration: {
    mode: RegistrationMode;
    updatedAt?: string | null;
    updatedBy?: string | null;
  };
};

const REGISTRATION_OPTIONS: Array<{
  mode: RegistrationMode;
  labelKey: string;
  descriptionKey: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    mode: 'allow_registration',
    labelKey: 'systemCredentials.registration.allowRegistration',
    descriptionKey: 'systemCredentials.registration.allowRegistrationDescription',
    icon: UserPlus,
  },
  {
    mode: 'invite_only',
    labelKey: 'systemCredentials.registration.inviteOnly',
    descriptionKey: 'systemCredentials.registration.inviteOnlyDescription',
    icon: Mail,
  },
  {
    mode: 'admin_created_only',
    labelKey: 'systemCredentials.registration.adminCreatedOnly',
    descriptionKey: 'systemCredentials.registration.adminCreatedOnlyDescription',
    icon: ShieldCheck,
  },
];

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

export function SystemCredentialsPanel() {
  const t = useTranslations('adminPanels');
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="text-muted-foreground mt-0.5 h-4 w-4" />
        <p className="text-muted-foreground max-w-prose text-xs">
          {t.rich('systemCredentials.intro', {
            code: (chunks) => <code>{chunks}</code>,
          })}
        </p>
      </div>
      <RegistrationSection />
      <SmtpSection />
      <LivekitSection />
      <StorageSection />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Registration                                                              */
/* -------------------------------------------------------------------------- */

function RegistrationSection() {
  const t = useTranslations('adminPanels');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<RegistrationResponse>({
    queryKey: ['admin', 'system', 'registration'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/registration');
      if (!res.ok) throw new Error(t('systemCredentials.registration.loadError'));
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const savedMode = data?.registration.mode ?? 'allow_registration';
  const [mode, setMode] = useState<RegistrationMode>('allow_registration');

  useEffect(() => {
    if (data?.registration.mode) setMode(data.registration.mode);
  }, [data?.registration.mode]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/system/registration', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
      });
      const payload = await res
        .json()
        .catch(() => ({ error: t('systemCredentials.registration.saveError') }));
      if (!res.ok) {
        throw new Error(payload.error || t('systemCredentials.registration.saveError'));
      }
      return payload as RegistrationResponse;
    },
    onSuccess: (result) => {
      setMode(result.registration.mode);
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'registration'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({
        title: t('systemCredentials.registration.saved'),
        description: t('systemCredentials.registration.savedDescription'),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t('systemCredentials.saveFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="surface-card space-y-4 p-6">
      <SectionHeader
        icon={ShieldCheck}
        title={t('systemCredentials.registration.title')}
        description={t('systemCredentials.registration.description')}
        stored={t(registrationModeLabelKey(savedMode))}
        updatedAt={data?.registration.updatedAt ?? null}
      />

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div
          className="grid gap-3 md:grid-cols-3"
          role="radiogroup"
          aria-label={t('systemCredentials.registration.title')}
        >
          {REGISTRATION_OPTIONS.map((option) => {
            const Icon = option.icon;
            const selected = mode === option.mode;
            return (
              <button
                key={option.mode}
                type="button"
                className={cn(
                  'ease-snap focus-visible:ring-ring flex min-h-28 flex-col items-start gap-2 rounded-md border p-4 text-left text-sm transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60',
                  selected
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-card hover:border-foreground/30'
                )}
                role="radio"
                aria-checked={selected}
                disabled={saveMutation.isPending}
                onClick={() => setMode(option.mode)}
              >
                <Icon className="h-4 w-4" />
                <span className="font-medium">{t(option.labelKey)}</span>
                <span className="text-muted-foreground text-xs leading-5">
                  {t(option.descriptionKey)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          onClick={() => saveMutation.mutate()}
          disabled={isLoading || saveMutation.isPending || mode === savedMode}
        >
          {saveMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t('systemCredentials.save')}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SMTP                                                                      */
/* -------------------------------------------------------------------------- */

function SmtpSection() {
  const t = useTranslations('adminPanels');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SmtpResponse>({
    queryKey: ['admin', 'system', 'smtp'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/smtp');
      if (!res.ok) throw new Error(t('systemCredentials.smtp.loadError'));
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const [host, setHost] = useState('');
  const [port, setPort] = useState<string>('25');
  const [secure, setSecure] = useState(false);
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [emailFrom, setEmailFrom] = useState('');

  useEffect(() => {
    if (!data?.smtp) return;
    setHost(data.smtp.host);
    setPort(String(data.smtp.port || 25));
    setSecure(data.smtp.secure);
    setUser(data.smtp.user);
    setEmailFrom(data.smtp.emailFrom);
    // Password intentionally left blank — admin enters only when rotating.
  }, [data?.smtp]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = {
        host: host.trim(),
        port: parseInt(port, 10) || 25,
        secure,
        user: user.trim(),
        password: password.trim() ? password : undefined,
        emailFrom: emailFrom.trim(),
      };
      const res = await fetch('/api/admin/system/smtp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res
        .json()
        .catch(() => ({ error: t('systemCredentials.smtp.saveError') }));
      if (!res.ok) throw new Error(payload.error || t('systemCredentials.smtp.saveError'));
      return payload as SmtpResponse;
    },
    onSuccess: () => {
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'smtp'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: t('systemCredentials.smtp.saved') });
    },
    onError: (err: Error) => {
      toast({
        title: t('systemCredentials.saveFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/system/smtp/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        recipient?: string;
        source?: string;
      };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || t('systemCredentials.smtp.testError'));
      }
      return payload;
    },
    onSuccess: (result) => {
      toast({
        title: t('systemCredentials.smtp.testSent'),
        description: t('systemCredentials.smtp.testSentDescription', {
          recipient: result.recipient ?? '',
          source: result.source ?? '',
        }),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t('systemCredentials.testFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const stored = data?.smtp;

  return (
    <div className="surface-card space-y-4 p-6">
      <SectionHeader
        icon={Mail}
        title={t('systemCredentials.smtp.title')}
        description={t('systemCredentials.smtp.description')}
        stored={
          stored?.configured
            ? `••••${stored.passwordPreview || t('systemCredentials.configured')}`
            : null
        }
        updatedAt={stored?.updatedAt ?? null}
      />

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('systemCredentials.smtp.host')}>
            <Input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="smtp.example.com"
            />
          </Field>
          <Field label={t('systemCredentials.smtp.port')}>
            <Input
              type="number"
              inputMode="numeric"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="587"
            />
          </Field>
          <Field label={t('systemCredentials.smtp.username')}>
            <Input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="noreply@example.com"
              autoComplete="off"
            />
          </Field>
          <Field
            label={
              stored?.passwordPreview
                ? t('systemCredentials.smtp.passwordStored', { preview: stored.passwordPreview })
                : t('systemCredentials.smtp.password')
            }
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                stored?.passwordPreview
                  ? t('systemCredentials.leaveBlankToKeep')
                  : t('systemCredentials.smtp.passwordPlaceholder')
              }
              autoComplete="new-password"
            />
          </Field>
          <Field label={t('systemCredentials.smtp.fromAddress')}>
            <Input
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="TaskNebula <noreply@example.com>"
            />
          </Field>
          <div className="flex items-center gap-3 self-end pb-2">
            <Switch id="smtp-secure" checked={secure} onCheckedChange={setSecure} />
            <Label htmlFor="smtp-secure" className="text-sm">
              {t('systemCredentials.smtp.tls')}
            </Label>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t('systemCredentials.save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !stored?.configured}
          title={
            !stored?.configured
              ? t('systemCredentials.smtp.saveFirst')
              : t('systemCredentials.smtp.sendTestTitle')
          }
        >
          {testMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t('systemCredentials.smtp.sendTest')}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  LiveKit                                                                   */
/* -------------------------------------------------------------------------- */

function LivekitSection() {
  const t = useTranslations('adminPanels');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<LivekitResponse>({
    queryKey: ['admin', 'system', 'livekit'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/livekit');
      if (!res.ok) throw new Error(t('systemCredentials.livekit.loadError'));
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const [url, setUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');

  useEffect(() => {
    if (!data?.livekit) return;
    setUrl(data.livekit.url);
    setApiKey(data.livekit.apiKey);
  }, [data?.livekit]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/system/livekit', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim() ? apiSecret : undefined,
        }),
      });
      const payload = await res
        .json()
        .catch(() => ({ error: t('systemCredentials.livekit.saveError') }));
      if (!res.ok) throw new Error(payload.error || t('systemCredentials.livekit.saveError'));
      return payload as LivekitResponse;
    },
    onSuccess: () => {
      setApiSecret('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'livekit'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: t('systemCredentials.livekit.saved') });
    },
    onError: (err: Error) => {
      toast({
        title: t('systemCredentials.saveFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/system/livekit/test', { method: 'POST' });
      const payload = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        source?: string;
        roomName?: string;
      };
      if (!res.ok || !payload.success) {
        throw new Error(payload.error || t('systemCredentials.livekit.testError'));
      }
      return payload;
    },
    onSuccess: (result) => {
      toast({
        title: t('systemCredentials.livekit.tokenMinted'),
        description: t('systemCredentials.livekit.tokenMintedDescription', {
          roomName: result.roomName ?? '',
          source: result.source ?? '',
        }),
      });
    },
    onError: (err: Error) => {
      toast({
        title: t('systemCredentials.testFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const stored = data?.livekit;

  return (
    <div className="surface-card space-y-4 p-6">
      <SectionHeader
        icon={Radio}
        title={t('systemCredentials.livekit.title')}
        description={t('systemCredentials.livekit.description')}
        stored={
          stored?.configured
            ? t('systemCredentials.livekit.secretPreview', {
                preview: stored.apiSecretPreview ?? '',
              })
            : null
        }
        updatedAt={stored?.updatedAt ?? null}
      />

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('systemCredentials.livekit.serverUrl')}>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://livekit.example.com"
            />
          </Field>
          <Field label={t('systemCredentials.livekit.apiKey')}>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="APIxxxxxxxxxxxxxxxx"
              autoComplete="off"
            />
          </Field>
          <Field
            label={
              stored?.apiSecretPreview
                ? t('systemCredentials.livekit.apiSecretStored', {
                    preview: stored.apiSecretPreview,
                  })
                : t('systemCredentials.livekit.apiSecret')
            }
          >
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={
                stored?.apiSecretPreview
                  ? t('systemCredentials.leaveBlankToKeep')
                  : t('systemCredentials.livekit.apiSecretPlaceholder')
              }
              autoComplete="new-password"
            />
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t('systemCredentials.save')}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !stored?.configured}
          title={
            !stored?.configured
              ? t('systemCredentials.livekit.saveFirst')
              : t('systemCredentials.livekit.mintTitle')
          }
        >
          {testMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radio className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t('systemCredentials.livekit.mintTest')}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Storage                                                                   */
/* -------------------------------------------------------------------------- */

function StorageSection() {
  const t = useTranslations('adminPanels');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<StorageResponse>({
    queryKey: ['admin', 'system', 'storage'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/storage');
      if (!res.ok) throw new Error(t('systemCredentials.storage.loadError'));
      return res.json();
    },
    refetchOnWindowFocus: false,
  });

  const [uploadsDir, setUploadsDir] = useState('');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('');
  const [s3AccessKey, setS3AccessKey] = useState('');
  const [s3SecretKey, setS3SecretKey] = useState('');

  useEffect(() => {
    if (!data?.storage) return;
    setUploadsDir(data.storage.uploadsDir);
    setS3Bucket(data.storage.s3Bucket);
    setS3Region(data.storage.s3Region);
    setS3AccessKey(data.storage.s3AccessKey);
  }, [data?.storage]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/system/storage', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uploadsDir: uploadsDir.trim(),
          s3Bucket: s3Bucket.trim(),
          s3Region: s3Region.trim(),
          s3AccessKey: s3AccessKey.trim(),
          s3SecretKey: s3SecretKey.trim() ? s3SecretKey : undefined,
        }),
      });
      const payload = await res
        .json()
        .catch(() => ({ error: t('systemCredentials.storage.saveError') }));
      if (!res.ok) throw new Error(payload.error || t('systemCredentials.storage.saveError'));
      return payload as StorageResponse;
    },
    onSuccess: () => {
      setS3SecretKey('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'storage'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: t('systemCredentials.storage.saved') });
    },
    onError: (err: Error) => {
      toast({
        title: t('systemCredentials.saveFailed'),
        description: err.message,
        variant: 'destructive',
      });
    },
  });

  const stored = data?.storage;

  return (
    <div className="surface-card space-y-4 p-6">
      <SectionHeader
        icon={HardDrive}
        title={t('systemCredentials.storage.title')}
        description={t('systemCredentials.storage.description')}
        stored={stored?.configured ? t('systemCredentials.storage.savedBadge') : null}
        updatedAt={stored?.updatedAt ?? null}
      />

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t('systemCredentials.storage.uploadsDir')}>
            <Input
              value={uploadsDir}
              onChange={(e) => setUploadsDir(e.target.value)}
              placeholder="/var/tasknebula/uploads"
            />
          </Field>
          <Field label={t('systemCredentials.storage.s3Bucket')}>
            <Input
              value={s3Bucket}
              onChange={(e) => setS3Bucket(e.target.value)}
              placeholder="tasknebula-prod"
            />
          </Field>
          <Field label={t('systemCredentials.storage.s3Region')}>
            <Input
              value={s3Region}
              onChange={(e) => setS3Region(e.target.value)}
              placeholder="us-east-1"
            />
          </Field>
          <Field label={t('systemCredentials.storage.s3AccessKey')}>
            <Input
              value={s3AccessKey}
              onChange={(e) => setS3AccessKey(e.target.value)}
              placeholder="AKIA…"
              autoComplete="off"
            />
          </Field>
          <Field
            label={
              stored?.s3SecretKeyPreview
                ? t('systemCredentials.storage.s3SecretKeyStored', {
                    preview: stored.s3SecretKeyPreview,
                  })
                : t('systemCredentials.storage.s3SecretKey')
            }
          >
            <Input
              type="password"
              value={s3SecretKey}
              onChange={(e) => setS3SecretKey(e.target.value)}
              placeholder={
                stored?.s3SecretKeyPreview
                  ? t('systemCredentials.leaveBlankToKeep')
                  : t('systemCredentials.storage.s3SecretPlaceholder')
              }
              autoComplete="new-password"
            />
          </Field>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3.5 w-3.5" />
          )}
          {t('systemCredentials.save')}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  UI helpers                                                                */
/* -------------------------------------------------------------------------- */

function SectionHeader({
  icon: Icon,
  title,
  description,
  stored,
  updatedAt,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  stored: string | null;
  updatedAt: string | null;
}) {
  const t = useTranslations('adminPanels');
  const formatter = useFormatter();
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="text-muted-foreground h-4 w-4" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-muted-foreground max-w-prose text-xs">{description}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {stored ? (
          <span className="chip text-[11px]">
            <Check className="h-3 w-3" />
            {stored}
          </span>
        ) : (
          <span className="chip text-muted-foreground text-[11px]">
            {t('systemCredentials.notConfigured')}
          </span>
        )}
        {updatedAt && (
          <span className="text-muted-foreground text-[11px]">
            {t('systemCredentials.updated', {
              date: formatter.dateTime(new Date(updatedAt), { dateStyle: 'medium' }),
            })}
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SectionSkeleton() {
  const t = useTranslations('adminPanels');
  return (
    <div className="text-muted-foreground flex items-center gap-2 text-xs">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      {t('systemCredentials.loading')}
    </div>
  );
}

function registrationModeLabelKey(mode: RegistrationMode) {
  switch (mode) {
    case 'invite_only':
      return 'systemCredentials.registration.inviteOnly';
    case 'admin_created_only':
      return 'systemCredentials.registration.adminCreatedOnly';
    case 'allow_registration':
    default:
      return 'systemCredentials.registration.allowRegistration';
  }
}
