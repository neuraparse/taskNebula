'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  HardDrive,
  Loader2,
  Mail,
  Radio,
  Save,
  ShieldCheck,
} from 'lucide-react';

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

/* -------------------------------------------------------------------------- */
/*  Panel                                                                     */
/* -------------------------------------------------------------------------- */

export function SystemCredentialsPanel() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <p className="text-xs text-muted-foreground max-w-prose">
          Platform-wide credentials that override environment variables. Secrets are encrypted
          (AES-256-GCM) before being written to the <code>system_settings</code> table and are
          only shown as <code>••••last4</code> previews after save.
        </p>
      </div>
      <SmtpSection />
      <LivekitSection />
      <StorageSection />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SMTP                                                                      */
/* -------------------------------------------------------------------------- */

function SmtpSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SmtpResponse>({
    queryKey: ['admin', 'system', 'smtp'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/smtp');
      if (!res.ok) throw new Error('Failed to load SMTP config');
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
      const payload = await res.json().catch(() => ({ error: 'Failed to save SMTP config' }));
      if (!res.ok) throw new Error(payload.error || 'Failed to save SMTP config');
      return payload as SmtpResponse;
    },
    onSuccess: () => {
      setPassword('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'smtp'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: 'SMTP configuration saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
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
        throw new Error(payload.error || 'Failed to send test email');
      }
      return payload;
    },
    onSuccess: (result) => {
      toast({
        title: 'Test email sent',
        description: `Delivered to ${result.recipient} via ${result.source} config.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    },
  });

  const stored = data?.smtp;

  return (
    <div className="surface-card p-6 space-y-4">
      <SectionHeader
        icon={Mail}
        title="SMTP"
        description="Used for invite, notification, and verification emails."
        stored={stored?.configured ? `••••${stored.passwordPreview || 'configured'}` : null}
        updatedAt={stored?.updatedAt ?? null}
      />

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Host">
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="smtp.example.com" />
          </Field>
          <Field label="Port">
            <Input
              type="number"
              inputMode="numeric"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="587"
            />
          </Field>
          <Field label="Username">
            <Input value={user} onChange={(e) => setUser(e.target.value)} placeholder="noreply@example.com" autoComplete="off" />
          </Field>
          <Field
            label={stored?.passwordPreview ? `Password (stored: ${stored.passwordPreview})` : 'Password'}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={stored?.passwordPreview ? 'Leave blank to keep current' : 'SMTP password'}
              autoComplete="new-password"
            />
          </Field>
          <Field label="From address">
            <Input
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              placeholder="TaskNebula <noreply@example.com>"
            />
          </Field>
          <div className="flex items-center gap-3 self-end pb-2">
            <Switch id="smtp-secure" checked={secure} onCheckedChange={setSecure} />
            <Label htmlFor="smtp-secure" className="text-sm">
              TLS (secure connection)
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
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !stored?.configured}
          title={!stored?.configured ? 'Save SMTP config first' : 'Send a test email to yourself'}
        >
          {testMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Mail className="mr-1.5 h-3.5 w-3.5" />
          )}
          Send test email
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  LiveKit                                                                   */
/* -------------------------------------------------------------------------- */

function LivekitSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<LivekitResponse>({
    queryKey: ['admin', 'system', 'livekit'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/livekit');
      if (!res.ok) throw new Error('Failed to load LiveKit config');
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
      const payload = await res.json().catch(() => ({ error: 'Failed to save LiveKit config' }));
      if (!res.ok) throw new Error(payload.error || 'Failed to save LiveKit config');
      return payload as LivekitResponse;
    },
    onSuccess: () => {
      setApiSecret('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'livekit'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: 'LiveKit configuration saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
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
        throw new Error(payload.error || 'Failed to mint LiveKit token');
      }
      return payload;
    },
    onSuccess: (result) => {
      toast({
        title: 'LiveKit token minted',
        description: `Room ${result.roomName} · ${result.source} config.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: 'Test failed', description: err.message, variant: 'destructive' });
    },
  });

  const stored = data?.livekit;

  return (
    <div className="surface-card p-6 space-y-4">
      <SectionHeader
        icon={Radio}
        title="LiveKit"
        description="Realtime audio/video rooms for in-app calls."
        stored={stored?.configured ? `secret ${stored.apiSecretPreview}` : null}
        updatedAt={stored?.updatedAt ?? null}
      />

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Server URL">
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="wss://livekit.example.com"
            />
          </Field>
          <Field label="API key">
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
                ? `API secret (stored: ${stored.apiSecretPreview})`
                : 'API secret'
            }
          >
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={stored?.apiSecretPreview ? 'Leave blank to keep current' : 'LiveKit API secret'}
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
          Save
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => testMutation.mutate()}
          disabled={testMutation.isPending || !stored?.configured}
          title={!stored?.configured ? 'Save LiveKit config first' : 'Mint a room access token'}
        >
          {testMutation.isPending ? (
            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Radio className="mr-1.5 h-3.5 w-3.5" />
          )}
          Mint test token
        </Button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Storage                                                                   */
/* -------------------------------------------------------------------------- */

function StorageSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<StorageResponse>({
    queryKey: ['admin', 'system', 'storage'],
    queryFn: async () => {
      const res = await fetch('/api/admin/system/storage');
      if (!res.ok) throw new Error('Failed to load storage config');
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
      const payload = await res.json().catch(() => ({ error: 'Failed to save storage config' }));
      if (!res.ok) throw new Error(payload.error || 'Failed to save storage config');
      return payload as StorageResponse;
    },
    onSuccess: () => {
      setS3SecretKey('');
      queryClient.invalidateQueries({ queryKey: ['admin', 'system', 'storage'] });
      queryClient.invalidateQueries({ queryKey: ['admin-audit-logs'] });
      toast({ title: 'Storage configuration saved' });
    },
    onError: (err: Error) => {
      toast({ title: 'Save failed', description: err.message, variant: 'destructive' });
    },
  });

  const stored = data?.storage;

  return (
    <div className="surface-card p-6 space-y-4">
      <SectionHeader
        icon={HardDrive}
        title="Storage"
        description="Local uploads directory or an S3-compatible bucket for attachments."
        stored={stored?.configured ? 'saved' : null}
        updatedAt={stored?.updatedAt ?? null}
      />

      {isLoading ? (
        <SectionSkeleton />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Uploads directory (local)">
            <Input
              value={uploadsDir}
              onChange={(e) => setUploadsDir(e.target.value)}
              placeholder="/var/tasknebula/uploads"
            />
          </Field>
          <Field label="S3 bucket">
            <Input value={s3Bucket} onChange={(e) => setS3Bucket(e.target.value)} placeholder="tasknebula-prod" />
          </Field>
          <Field label="S3 region">
            <Input value={s3Region} onChange={(e) => setS3Region(e.target.value)} placeholder="us-east-1" />
          </Field>
          <Field label="S3 access key">
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
                ? `S3 secret key (stored: ${stored.s3SecretKeyPreview})`
                : 'S3 secret key'
            }
          >
            <Input
              type="password"
              value={s3SecretKey}
              onChange={(e) => setS3SecretKey(e.target.value)}
              placeholder={stored?.s3SecretKeyPreview ? 'Leave blank to keep current' : 'S3 secret'}
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
          Save
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
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <p className="text-xs text-muted-foreground max-w-prose">{description}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {stored ? (
          <span className="chip text-[11px]">
            <Check className="h-3 w-3" />
            {stored}
          </span>
        ) : (
          <span className="chip text-[11px] text-muted-foreground">Not configured</span>
        )}
        {updatedAt && (
          <span className="text-[11px] text-muted-foreground">
            Updated {new Date(updatedAt).toLocaleDateString()}
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
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      Loading…
    </div>
  );
}
