'use client';

/**
 * Settings page client for SSO + SCIM.
 *
 * Two tabs:
 *   - SAML: paste/upload IdP metadata XML or provide entryPoint + cert
 *           manually, edit attribute map, toggle enabled.
 *   - SCIM: list provisioning tokens, create new ones (shown once), revoke.
 *
 * IdP metadata parsing is done in the browser via DOMParser — we only need
 * the EntityID, SSO URL, and signing certificate from a standard SAML 2.0
 * IdP descriptor.
 */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const DEFAULT_ATTRIBUTE_MAP = {
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  first_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  last_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
};

type SsoConfig = {
  id: string;
  workspaceId: string;
  provider: 'saml' | 'oidc';
  entryPointUrl: string;
  issuer: string;
  cert: string;
  audience: string;
  attributeMap: Record<string, string>;
  enabled: boolean;
  hasPrivateKey: boolean;
};

type ScimTokenRow = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function SsoSettingsClient({ organizationId }: { organizationId: string }) {
  const t = useTranslations('settingsConfig');
  return (
    <Tabs defaultValue="saml" className="space-y-6">
      <TabsList>
        <TabsTrigger value="saml">{t('sso.tab_saml')}</TabsTrigger>
        <TabsTrigger value="scim">{t('sso.tab_scim')}</TabsTrigger>
      </TabsList>
      <TabsContent value="saml">
        <SamlSection organizationId={organizationId} />
      </TabsContent>
      <TabsContent value="scim">
        <ScimSection organizationId={organizationId} />
      </TabsContent>
    </Tabs>
  );
}

function parseIdpMetadataXml(xml: string): Partial<SsoConfig> {
  if (typeof window === 'undefined') return {};
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const ed = doc.getElementsByTagNameNS('*', 'EntityDescriptor')[0];
  if (!ed) return {};
  const issuer = ed.getAttribute('entityID') ?? undefined;
  const ssoBindings = Array.from(doc.getElementsByTagNameNS('*', 'SingleSignOnService'));
  const ssoNode =
    ssoBindings.find(
      (n) => n.getAttribute('Binding') === 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect'
    ) ?? ssoBindings[0];
  const entryPointUrl = ssoNode?.getAttribute('Location') ?? undefined;
  const certNode = doc.getElementsByTagNameNS('*', 'X509Certificate')[0];
  const cert = certNode?.textContent?.trim() ?? undefined;
  return {
    issuer: issuer ?? undefined,
    entryPointUrl: entryPointUrl ?? undefined,
    cert: cert ?? undefined,
  };
}

function SamlSection({ organizationId }: { organizationId: string }) {
  const t = useTranslations('settingsConfig');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['sso-config', organizationId],
    queryFn: async () => {
      const r = await fetch(`/api/sso/configs?organizationId=${organizationId}`);
      if (!r.ok) throw new Error(t('sso.load_config_failed'));
      return (await r.json()) as { ssoConfig: SsoConfig | null };
    },
  });

  const [form, setForm] = useState<SsoConfig>({
    id: '',
    workspaceId: organizationId,
    provider: 'saml',
    entryPointUrl: '',
    issuer: '',
    cert: '',
    audience: '',
    attributeMap: DEFAULT_ATTRIBUTE_MAP,
    enabled: false,
    hasPrivateKey: false,
  });
  const [metadataUrl, setMetadataUrl] = useState('');

  useEffect(() => {
    if (data?.ssoConfig) setForm(data.ssoConfig);
  }, [data]);

  useEffect(() => {
    setMetadataUrl(`${window.location.origin}/api/auth/saml/${'<workspace-slug>'}/metadata.xml`);
  }, []);

  const save = useMutation({
    mutationFn: async () => {
      const r = await fetch('/api/sso/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId,
          provider: form.provider,
          entryPointUrl: form.entryPointUrl,
          issuer: form.issuer,
          cert: form.cert,
          audience: form.audience,
          attributeMap: form.attributeMap,
          enabled: form.enabled,
        }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? t('sso.save_failed'));
      }
    },
    onSuccess: () => {
      toast({ title: t('sso.config_saved') });
      queryClient.invalidateQueries({ queryKey: ['sso-config', organizationId] });
    },
    onError: (err: Error) =>
      toast({
        title: t('sso.config_save_failed'),
        description: err.message,
        variant: 'destructive',
      }),
  });

  return (
    <div className="border-border bg-card space-y-6 rounded-md border p-6">
      <div>
        <h2 className="text-lg font-semibold">{t('sso.saml_heading')}</h2>
        <div className="text-muted-foreground text-sm">
          <p>{t('sso.saml_metadata_prefix')}</p>
          {metadataUrl ? (
            <code className="bg-muted mt-1 block max-w-full break-all rounded-sm px-1.5 py-1 font-mono text-[0.85em] leading-relaxed">
              {metadataUrl}
            </code>
          ) : null}
          <p className="mt-1">{t('sso.saml_metadata_suffix')}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="metadata-upload">{t('sso.idp_metadata_label')}</Label>
        <Textarea
          id="metadata-upload"
          rows={4}
          placeholder="<EntityDescriptor xmlns='urn:oasis:names:tc:SAML:2.0:metadata' ..."
          onBlur={(e) => {
            const parsed = parseIdpMetadataXml(e.currentTarget.value);
            if (parsed.issuer || parsed.entryPointUrl || parsed.cert) {
              setForm((prev) => ({
                ...prev,
                issuer: parsed.issuer ?? prev.issuer,
                entryPointUrl: parsed.entryPointUrl ?? prev.entryPointUrl,
                cert: parsed.cert ?? prev.cert,
              }));
              toast({ title: t('sso.parsed_metadata') });
            }
          }}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="issuer">{t('sso.entity_id_label')}</Label>
          <Input
            id="issuer"
            value={form.issuer}
            onChange={(e) => setForm({ ...form, issuer: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry">{t('sso.sso_url_label')}</Label>
          <Input
            id="entry"
            value={form.entryPointUrl}
            onChange={(e) => setForm({ ...form, entryPointUrl: e.target.value })}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="cert">{t('sso.cert_label')}</Label>
          <Textarea
            id="cert"
            rows={6}
            value={form.cert}
            onChange={(e) => setForm({ ...form, cert: e.target.value })}
            placeholder="-----BEGIN CERTIFICATE-----..."
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="audience">{t('sso.audience_label')}</Label>
          <Input
            id="audience"
            value={form.audience}
            onChange={(e) => setForm({ ...form, audience: e.target.value })}
          />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold">{t('sso.attribute_mapping')}</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['email', 'first_name', 'last_name', 'groups'] as const).map((k) => (
            <div key={k} className="space-y-1">
              <Label htmlFor={`attr-${k}`} className="text-xs">
                {k}
              </Label>
              <Input
                id={`attr-${k}`}
                value={form.attributeMap[k] ?? ''}
                onChange={(e) =>
                  setForm({
                    ...form,
                    attributeMap: {
                      ...form.attributeMap,
                      [k]: e.target.value,
                    },
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>

      <div className="border-border flex items-center justify-between gap-4 border-t pt-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={form.enabled}
            onCheckedChange={(checked) => setForm({ ...form, enabled: checked })}
          />
          <span className="text-muted-foreground text-sm">{t('sso.enable_label')}</span>
        </div>
        <Button onClick={() => save.mutate()} disabled={save.isPending}>
          {t('sso.save_config')}
        </Button>
      </div>
    </div>
  );
}

function ScimSection({ organizationId }: { organizationId: string }) {
  const tr = useTranslations('settingsConfig');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ['scim-tokens', organizationId],
    queryFn: async () => {
      const r = await fetch(`/api/sso/tokens?organizationId=${organizationId}`);
      if (!r.ok) throw new Error(tr('sso.load_tokens_failed'));
      return (await r.json()) as { tokens: ScimTokenRow[] };
    },
  });
  const [name, setName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async (n: string) => {
      const r = await fetch('/api/sso/tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, name: n }),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.error ?? tr('sso.token_create_failed'));
      }
      return (await r.json()) as { token: string };
    },
    onSuccess: (resp) => {
      setCreatedToken(resp.token);
      setName('');
      queryClient.invalidateQueries({
        queryKey: ['scim-tokens', organizationId],
      });
    },
    onError: (err: Error) =>
      toast({
        title: tr('sso.token_create_failed'),
        description: err.message,
        variant: 'destructive',
      }),
  });

  const revoke = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/sso/tokens/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(tr('sso.token_revoke_failed'));
    },
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: ['scim-tokens', organizationId],
      }),
  });

  return (
    <div className="border-border bg-card space-y-6 rounded-md border p-6">
      <div>
        <h2 className="text-lg font-semibold">{tr('sso.scim_heading')}</h2>
        <p className="text-muted-foreground text-sm">
          {tr('sso.scim_desc_prefix')} <code>{'/api/scim/v2/'}</code>
          {tr('sso.scim_desc_suffix')}
        </p>
      </div>

      <div className="flex items-end gap-3">
        <div className="flex-1 space-y-1">
          <Label htmlFor="token-name">{tr('sso.token_name_label')}</Label>
          <Input
            id="token-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={tr('sso.token_name_placeholder')}
          />
        </div>
        <Button onClick={() => name && create.mutate(name)} disabled={!name || create.isPending}>
          {tr('sso.generate_token')}
        </Button>
      </div>

      {createdToken && (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium">{tr('sso.token_copy_warning')}</p>
          <code className="bg-background mt-2 block break-all rounded px-2 py-1 text-xs">
            {createdToken}
          </code>
          <Button
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setCreatedToken(null)}
          >
            {tr('sso.token_copied')}
          </Button>
        </div>
      )}

      <ul className="divide-border border-border divide-y rounded-md border">
        {(data?.tokens ?? []).length === 0 && (
          <li className="text-muted-foreground px-4 py-4 text-sm">{tr('sso.no_tokens')}</li>
        )}
        {(data?.tokens ?? []).map((t) => (
          <li key={t.id} className="flex items-center justify-between px-4 py-3 text-sm">
            <div>
              <div className="font-medium">{t.name}</div>
              <div className="text-muted-foreground text-xs">
                {tr('sso.token_created', { date: new Date(t.createdAt).toLocaleString() })}
                {t.lastUsedAt
                  ? ` · ${tr('sso.token_last_used', { date: new Date(t.lastUsedAt).toLocaleString() })}`
                  : ''}
                {t.revokedAt ? ` · ${tr('sso.token_revoked')}` : ''}
              </div>
            </div>
            {!t.revokedAt && (
              <Button variant="outline" size="sm" onClick={() => revoke.mutate(t.id)}>
                {tr('sso.revoke')}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
