import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { errorCodes, isErrorWithCode, pick } from '@react-native-documents/picker';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from '@/components/native';
import {
  CheckCircle2,
  FileCode2,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  UploadCloud,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

import { getBaseUrl } from '@/api/client';
import type { Organization, ScimToken, SsoConfig } from '@/api/types';
import {
  Button,
  EmptyState,
  ErrorView,
  IconTile,
  Loading,
  Screen,
  ScreenHeader,
  SemanticBadge,
  SurfaceRow,
  TextField,
} from '@/components/ui';
import type { ThemeColors } from '@/design/theme';
import { useThemeColors } from '@/design/theme-context';
import {
  useCreateScimToken,
  useDeleteSsoConfig,
  useOrganizations,
  useRevokeScimToken,
  useScimTokens,
  useSsoConfig,
  useUpsertSsoConfig,
} from '@/hooks/queries';
import { formatLocalizedDateTime } from '@/lib/format';

type SsoSection = 'saml' | 'scim';
type AttributeField = 'email' | 'first_name' | 'last_name' | 'groups';
type SsoSettingsStyles = ReturnType<typeof createSsoSettingsStyles>;

function useSsoSettingsTheme(): { colors: ThemeColors; styles: SsoSettingsStyles } {
  const colors = useThemeColors();
  const styles = useMemo(() => createSsoSettingsStyles(colors), [colors]);
  return { colors, styles };
}

interface SsoFormState {
  entryPointUrl: string;
  issuer: string;
  cert: string;
  audience: string;
  attributeMap: Record<AttributeField, string>;
  enabled: boolean;
}

const SECTIONS: SsoSection[] = ['saml', 'scim'];
const ATTRIBUTE_FIELDS: AttributeField[] = ['email', 'first_name', 'last_name', 'groups'];
const SCIM_BASE_PATH = '/api/scim/v2/';
const DEFAULT_ATTRIBUTE_MAP: Record<AttributeField, string> = {
  email: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
  first_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname',
  last_name: 'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname',
  groups: 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
};

function emptyForm(audience: string): SsoFormState {
  return {
    entryPointUrl: '',
    issuer: '',
    cert: '',
    audience,
    attributeMap: DEFAULT_ATTRIBUTE_MAP,
    enabled: false,
  };
}

function formFromConfig(config: SsoConfig | null, audience: string): SsoFormState {
  if (!config) return emptyForm(audience);
  return {
    entryPointUrl: config.entryPointUrl,
    issuer: config.issuer,
    cert: config.cert,
    audience: config.audience || audience,
    attributeMap: {
      ...DEFAULT_ATTRIBUTE_MAP,
      ...config.attributeMap,
    },
    enabled: config.enabled,
  };
}

function organizationLabel(organization: Organization): string {
  return organization.name || organization.slug || organization.id;
}

function sectionLabelKey(section: SsoSection): string {
  return section === 'scim' ? 'sso.tabs.scim' : 'sso.tabs.saml';
}

function attributeLabelKey(field: AttributeField): string {
  return `sso.attribute.${field}`;
}

function buildMetadataUrl(
  baseUrl: string | null | undefined,
  organization: Organization | null,
): string {
  const slug = organization?.slug || organization?.id || 'workspace';
  const base = baseUrl ? baseUrl.replace(/\/$/, '') : '';
  return `${base}/api/auth/saml/${encodeURIComponent(slug)}/metadata.xml`;
}

function xmlAttribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1]?.trim();
}

function parseIdpMetadataXml(
  xml: string,
): Partial<Pick<SsoFormState, 'issuer' | 'entryPointUrl' | 'cert'>> {
  const entityTag = xml.match(/<[^>]*EntityDescriptor\b[^>]*>/i)?.[0] ?? '';
  const issuer = xmlAttribute(entityTag, 'entityID');
  const serviceTags = [...xml.matchAll(/<[^>]*SingleSignOnService\b[^>]*>/gi)].map(
    (match) => match[0],
  );
  const redirectService =
    serviceTags.find((tag) =>
      (xmlAttribute(tag, 'Binding') ?? '').includes(
        'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-Redirect',
      ),
    ) ?? serviceTags[0];
  const entryPointUrl = redirectService ? xmlAttribute(redirectService, 'Location') : undefined;
  const cert = xml
    .match(/<[^>]*X509Certificate[^>]*>([\s\S]*?)<\/[^>]*X509Certificate>/i)?.[1]
    ?.replace(/\s+/g, '')
    .trim();

  const parsed: Partial<Pick<SsoFormState, 'issuer' | 'entryPointUrl' | 'cert'>> = {};
  if (issuer) parsed.issuer = issuer;
  if (entryPointUrl) parsed.entryPointUrl = entryPointUrl;
  if (cert) parsed.cert = cert;
  return parsed;
}

function compactMeta(parts: Array<string | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join(' · ');
}

function formatDate(value: string | null | undefined, fallback: string): string {
  return formatLocalizedDateTime(value, fallback);
}

function tokenMeta(token: ScimToken, t: ReturnType<typeof useTranslation>['t']): string {
  return compactMeta([
    t('sso.tokenCreated', { date: formatDate(token.createdAt, t('sso.dateUnknown')) }),
    token.lastUsedAt
      ? t('sso.tokenLastUsed', { date: formatDate(token.lastUsedAt, t('sso.dateUnknown')) })
      : null,
    token.revokedAt ? t('sso.tokenRevoked') : null,
  ]);
}

function SectionPill({
  section,
  selected,
  onPress,
}: {
  section: SsoSection;
  selected: boolean;
  onPress: (section: SsoSection) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useSsoSettingsTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onPress(section)}
      style={[styles.segmentButton, selected ? styles.segmentButtonActive : null]}
      className="active:opacity-80"
    >
      <Text style={[styles.segmentText, selected ? styles.segmentTextActive : null]}>
        {t(sectionLabelKey(section))}
      </Text>
    </Pressable>
  );
}

function OrganizationPill({
  organization,
  selected,
  disabled,
  onPress,
}: {
  organization: Organization;
  selected: boolean;
  disabled: boolean;
  onPress: (organizationId: string) => void;
}) {
  const { styles } = useSsoSettingsTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={() => onPress(organization.id)}
      style={[
        styles.orgPill,
        selected ? styles.orgPillActive : null,
        disabled ? styles.disabled : null,
      ]}
      className="active:opacity-80"
    >
      <Text
        style={[styles.orgPillTitle, selected ? styles.orgPillTitleActive : null]}
        numberOfLines={1}
      >
        {organizationLabel(organization)}
      </Text>
      <Text
        style={[styles.orgPillMeta, selected ? styles.orgPillMetaActive : null]}
        numberOfLines={1}
      >
        {organization.slug || organization.id}
      </Text>
    </Pressable>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
  disabled,
  onToggle,
}: {
  label: string;
  description: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
}) {
  const { styles } = useSsoSettingsTheme();

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: enabled, disabled }}
      disabled={disabled}
      onPress={() => onToggle(!enabled)}
      style={[styles.toggleRow, disabled ? styles.disabled : null]}
      className="active:opacity-80"
    >
      <View className="min-w-0 flex-1 gap-1">
        <Text style={styles.panelTitle}>{label}</Text>
        <Text style={styles.panelSubtitle}>{description}</Text>
      </View>
      <View style={[styles.switchTrack, enabled ? styles.switchTrackActive : null]}>
        <View style={[styles.switchThumb, enabled ? styles.switchThumbActive : null]} />
      </View>
    </Pressable>
  );
}

function TokenRow({
  token,
  disabled,
  onRevoke,
}: {
  token: ScimToken;
  disabled: boolean;
  onRevoke: (token: ScimToken) => void;
}) {
  const { t } = useTranslation();
  const { styles } = useSsoSettingsTheme();
  return (
    <View style={styles.tokenRow}>
      <View className="min-w-0 flex-1 gap-1">
        <View style={styles.tokenTitleRow}>
          <Text style={styles.tokenName} numberOfLines={1}>
            {token.name}
          </Text>
          {token.revokedAt ? (
            <SemanticBadge label={t('sso.tokenRevoked')} tone="rose" />
          ) : (
            <SemanticBadge label={t('sso.tokenActive')} tone="emerald" />
          )}
        </View>
        <Text style={styles.panelSubtitle}>{tokenMeta(token, t)}</Text>
      </View>
      {!token.revokedAt ? (
        <Button
          title={t('sso.revoke')}
          icon={Trash2}
          variant="secondary"
          disabled={disabled}
          onPress={() => onRevoke(token)}
        />
      ) : null}
    </View>
  );
}

export function SsoSettingsScreen() {
  const { t } = useTranslation();
  const { colors, styles } = useSsoSettingsTheme();
  const organizationsQ = useOrganizations();
  const organizations = useMemo(
    () => organizationsQ.data?.organizations ?? [],
    [organizationsQ.data?.organizations],
  );
  const [section, setSection] = useState<SsoSection>('saml');
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === organizationId) ?? null,
    [organizationId, organizations],
  );
  const metadataUrl = useMemo(
    () => buildMetadataUrl(getBaseUrl(), selectedOrganization),
    [selectedOrganization],
  );
  const ssoQ = useSsoConfig(organizationId);
  const scimQ = useScimTokens(organizationId);
  const upsertSso = useUpsertSsoConfig(organizationId);
  const deleteSso = useDeleteSsoConfig(organizationId);
  const createToken = useCreateScimToken(organizationId);
  const revokeToken = useRevokeScimToken(organizationId);
  const [form, setForm] = useState<SsoFormState>(() => emptyForm(''));
  const [metadataXml, setMetadataXml] = useState('');
  const [tokenName, setTokenName] = useState('');
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isBusy =
    upsertSso.isPending || deleteSso.isPending || createToken.isPending || revokeToken.isPending;
  const ssoConfig = ssoQ.data?.ssoConfig ?? null;
  const scimTokens = scimQ.data?.tokens ?? [];

  useEffect(() => {
    if (organizationId && organizations.some((organization) => organization.id === organizationId))
      return;
    setOrganizationId(organizations[0]?.id ?? null);
  }, [organizationId, organizations]);

  useEffect(() => {
    setForm(formFromConfig(ssoConfig, metadataUrl));
  }, [metadataUrl, ssoConfig]);

  const updateAttribute = (field: AttributeField, value: string) => {
    setForm((current) => ({
      ...current,
      attributeMap: {
        ...current.attributeMap,
        [field]: value,
      },
    }));
  };

  const applyMetadata = (xml: string) => {
    const parsed = parseIdpMetadataXml(xml);
    if (!parsed.issuer && !parsed.entryPointUrl && !parsed.cert) {
      setError(t('sso.metadataParseFailed'));
      return;
    }
    setForm((current) => ({
      ...current,
      issuer: parsed.issuer ?? current.issuer,
      entryPointUrl: parsed.entryPointUrl ?? current.entryPointUrl,
      cert: parsed.cert ?? current.cert,
    }));
    setError(null);
    setNotice(t('sso.metadataParsed'));
  };

  const pickMetadataFile = async () => {
    setError(null);
    setNotice(null);
    try {
      const [file] = await pick({
        type: ['application/xml', 'text/xml', 'text/plain'],
      });
      if (file.error) {
        setError(t('sso.metadataReadFailed'));
        return;
      }
      const response = await fetch(file.uri);
      const xml = await response.text();
      setMetadataXml(xml);
      applyMetadata(xml);
    } catch (err: unknown) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) return;
      setError(err instanceof Error ? err.message : t('sso.metadataReadFailed'));
    }
  };

  const validateSsoForm = (): string | null => {
    if (!organizationId) return t('sso.errorOrganizationRequired');
    if (!form.issuer.trim()) return t('sso.errorIssuerRequired');
    if (!form.entryPointUrl.trim()) return t('sso.errorEntryPointRequired');
    if (!form.cert.trim()) return t('sso.errorCertRequired');
    if (!form.audience.trim()) return t('sso.errorAudienceRequired');
    return null;
  };

  const saveSsoConfig = async () => {
    const validation = validateSsoForm();
    if (validation) {
      setError(validation);
      return;
    }
    setError(null);
    setNotice(null);
    try {
      await upsertSso.mutateAsync({
        organizationId: organizationId ?? '',
        provider: 'saml',
        entryPointUrl: form.entryPointUrl.trim(),
        issuer: form.issuer.trim(),
        cert: form.cert.trim(),
        audience: form.audience.trim(),
        attributeMap: form.attributeMap,
        enabled: form.enabled,
      });
      setNotice(t('sso.configSaved'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('sso.configSaveFailed'));
    }
  };

  const confirmDeleteConfig = () => {
    Alert.alert(t('sso.deleteTitle'), t('sso.deleteDescription'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sso.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          void deleteConfig();
        },
      },
    ]);
  };

  const deleteConfig = async () => {
    if (!organizationId) return;
    setError(null);
    setNotice(null);
    try {
      await deleteSso.mutateAsync();
      setNotice(t('sso.configDeleted'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('sso.configDeleteFailed'));
    }
  };

  const createScimToken = async () => {
    if (!organizationId) {
      setError(t('sso.errorOrganizationRequired'));
      return;
    }
    const name = tokenName.trim();
    if (!name) {
      setError(t('sso.errorTokenNameRequired'));
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const result = await createToken.mutateAsync({ organizationId, name });
      setCreatedToken(result.token);
      setTokenName('');
      setNotice(t('sso.tokenCreatedNotice'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('sso.tokenCreateFailed'));
    }
  };

  const confirmRevokeToken = (token: ScimToken) => {
    Alert.alert(t('sso.revokeTitle'), t('sso.revokeDescription', { name: token.name }), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('sso.revoke'),
        style: 'destructive',
        onPress: () => {
          void revokeScimToken(token.id);
        },
      },
    ]);
  };

  const revokeScimToken = async (tokenId: string) => {
    setError(null);
    setNotice(null);
    try {
      await revokeToken.mutateAsync(tokenId);
      setNotice(t('sso.tokenRevokedNotice'));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('sso.tokenRevokeFailed'));
    }
  };

  if (organizationsQ.isLoading) {
    return <Loading label={t('sso.loadingOrganizations')} />;
  }

  if (organizationsQ.isError) {
    return (
      <Screen>
        <ScreenHeader
          kicker={t('sso.kicker')}
          title={t('sso.title')}
          subtitle={t('sso.subtitle')}
        />
        <ErrorView
          message={t('sso.organizationsLoadFailed')}
          onRetry={() => void organizationsQ.refetch()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        kicker={t('sso.kicker')}
        title={t('sso.title')}
        subtitle={t('sso.subtitle')}
        meta={
          <SemanticBadge
            label={form.enabled ? t('sso.enabledBadge') : t('sso.disabledBadge')}
            tone={form.enabled ? 'emerald' : 'neutral'}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {organizations.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title={t('sso.emptyTitle')}
            description={t('sso.emptyDescription')}
          />
        ) : (
          <>
            <SurfaceRow className="gap-3">
              <View style={styles.sectionHeader}>
                <IconTile icon={ShieldCheck} tone="indigo" />
                <View className="min-w-0 flex-1 gap-1">
                  <Text style={styles.panelTitle}>{t('sso.organizationTitle')}</Text>
                  <Text style={styles.panelSubtitle}>{t('sso.organizationSubtitle')}</Text>
                </View>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.pillWrap}
              >
                {organizations.map((organization) => (
                  <OrganizationPill
                    key={organization.id}
                    organization={organization}
                    selected={organizationId === organization.id}
                    disabled={isBusy}
                    onPress={(nextOrganizationId) => {
                      setOrganizationId(nextOrganizationId);
                      setCreatedToken(null);
                      setNotice(null);
                      setError(null);
                    }}
                  />
                ))}
              </ScrollView>
              <View style={styles.segmentRow}>
                {SECTIONS.map((item) => (
                  <SectionPill
                    key={item}
                    section={item}
                    selected={section === item}
                    onPress={setSection}
                  />
                ))}
              </View>
            </SurfaceRow>

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
            {error ? <Text style={styles.errorText}>{error}</Text> : null}

            {section === 'saml' ? (
              <SurfaceRow className="gap-3">
                <View style={styles.sectionHeader}>
                  <IconTile icon={FileCode2} tone="cyan" />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text style={styles.panelTitle}>{t('sso.samlTitle')}</Text>
                    <Text style={styles.panelSubtitle}>{t('sso.samlSubtitle')}</Text>
                  </View>
                </View>

                {ssoQ.isLoading ? <Loading label={t('sso.loadingConfig')} /> : null}
                {ssoQ.isError ? (
                  <ErrorView
                    message={
                      ssoQ.error instanceof Error ? ssoQ.error.message : t('sso.configLoadFailed')
                    }
                    onRetry={() => void ssoQ.refetch()}
                  />
                ) : null}

                <View style={styles.metadataBox}>
                  <Text style={styles.sectionLabel}>{t('sso.spMetadata')}</Text>
                  <Text style={styles.codeText}>{metadataUrl}</Text>
                  <Text style={styles.panelSubtitle}>{t('sso.spMetadataDescription')}</Text>
                </View>

                <View style={styles.formBlock}>
                  <Text style={styles.sectionLabel}>{t('sso.idpMetadata')}</Text>
                  <Button
                    title={t('sso.pickMetadata')}
                    icon={UploadCloud}
                    variant="secondary"
                    disabled={isBusy}
                    onPress={() => void pickMetadataFile()}
                  />
                  <TextInput
                    value={metadataXml}
                    editable={!isBusy}
                    multiline
                    placeholder={t('sso.metadataPlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    onChangeText={setMetadataXml}
                    style={styles.multilineInput}
                  />
                  <Button
                    title={t('sso.parseMetadata')}
                    icon={RefreshCw}
                    variant="secondary"
                    disabled={isBusy || !metadataXml.trim()}
                    onPress={() => applyMetadata(metadataXml)}
                  />
                </View>

                <TextField
                  label={t('sso.issuer')}
                  value={form.issuer}
                  editable={!isBusy}
                  autoCapitalize="none"
                  onChangeText={(value) => setForm((current) => ({ ...current, issuer: value }))}
                />
                <TextField
                  label={t('sso.entryPointUrl')}
                  value={form.entryPointUrl}
                  editable={!isBusy}
                  autoCapitalize="none"
                  keyboardType="url"
                  onChangeText={(value) =>
                    setForm((current) => ({ ...current, entryPointUrl: value }))
                  }
                />
                <View style={styles.formBlock}>
                  <Text style={styles.sectionLabel}>{t('sso.cert')}</Text>
                  <TextInput
                    value={form.cert}
                    editable={!isBusy}
                    multiline
                    placeholder={t('sso.certPlaceholder')}
                    placeholderTextColor={colors.mutedForeground}
                    onChangeText={(value) => setForm((current) => ({ ...current, cert: value }))}
                    style={styles.certInput}
                  />
                </View>
                <TextField
                  label={t('sso.audience')}
                  value={form.audience}
                  editable={!isBusy}
                  autoCapitalize="none"
                  onChangeText={(value) => setForm((current) => ({ ...current, audience: value }))}
                />

                <View style={styles.attributeBox}>
                  <Text style={styles.panelTitle}>{t('sso.attributeMapping')}</Text>
                  {ATTRIBUTE_FIELDS.map((field) => (
                    <TextField
                      key={field}
                      label={t(attributeLabelKey(field))}
                      value={form.attributeMap[field]}
                      editable={!isBusy}
                      autoCapitalize="none"
                      onChangeText={(value) => updateAttribute(field, value)}
                    />
                  ))}
                </View>

                <ToggleRow
                  label={t('sso.enableSaml')}
                  description={t('sso.enableSamlDescription')}
                  enabled={form.enabled}
                  disabled={isBusy}
                  onToggle={(enabled) => setForm((current) => ({ ...current, enabled }))}
                />

                <View style={styles.actionRow}>
                  <Button
                    title={t('sso.saveConfig')}
                    icon={Save}
                    loading={upsertSso.isPending}
                    disabled={isBusy}
                    onPress={() => void saveSsoConfig()}
                  />
                  <Button
                    title={t('sso.deleteConfig')}
                    icon={Trash2}
                    variant="destructive"
                    loading={deleteSso.isPending}
                    disabled={isBusy || !ssoConfig}
                    onPress={confirmDeleteConfig}
                  />
                </View>
              </SurfaceRow>
            ) : (
              <SurfaceRow className="gap-3">
                <View style={styles.sectionHeader}>
                  <IconTile icon={KeyRound} tone="violet" />
                  <View className="min-w-0 flex-1 gap-1">
                    <Text style={styles.panelTitle}>{t('sso.scimTitle')}</Text>
                    <Text style={styles.panelSubtitle}>
                      {t('sso.scimDescription', { path: SCIM_BASE_PATH })}
                    </Text>
                  </View>
                </View>

                <View style={styles.formBlock}>
                  <TextField
                    label={t('sso.tokenName')}
                    placeholder={t('sso.tokenNamePlaceholder')}
                    value={tokenName}
                    editable={!isBusy}
                    onChangeText={setTokenName}
                  />
                  <Button
                    title={t('sso.generateToken')}
                    icon={KeyRound}
                    loading={createToken.isPending}
                    disabled={isBusy || !tokenName.trim()}
                    onPress={() => void createScimToken()}
                  />
                </View>

                {createdToken ? (
                  <View style={styles.createdTokenBox}>
                    <View style={styles.sectionHeader}>
                      <CheckCircle2 size={18} color={colors.accentAmber} />
                      <View className="min-w-0 flex-1 gap-1">
                        <Text style={styles.panelTitle}>{t('sso.copyTokenTitle')}</Text>
                        <Text style={styles.panelSubtitle}>{t('sso.copyTokenDescription')}</Text>
                      </View>
                    </View>
                    <Text style={styles.tokenSecret}>{createdToken}</Text>
                    <Button
                      title={t('sso.tokenCopied')}
                      variant="secondary"
                      onPress={() => setCreatedToken(null)}
                    />
                  </View>
                ) : null}

                {scimQ.isLoading ? (
                  <Loading label={t('sso.loadingTokens')} />
                ) : scimQ.isError ? (
                  <ErrorView
                    message={
                      scimQ.error instanceof Error ? scimQ.error.message : t('sso.tokensLoadFailed')
                    }
                    onRetry={() => void scimQ.refetch()}
                  />
                ) : scimTokens.length === 0 ? (
                  <EmptyState
                    icon={KeyRound}
                    title={t('sso.noTokensTitle')}
                    description={t('sso.noTokensDescription')}
                  />
                ) : (
                  <View style={styles.tokenList}>
                    {scimTokens.map((token) => (
                      <TokenRow
                        key={token.id}
                        token={token}
                        disabled={isBusy}
                        onRevoke={confirmRevokeToken}
                      />
                    ))}
                  </View>
                )}
              </SurfaceRow>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function createSsoSettingsStyles(colors: ThemeColors) {
  return StyleSheet.create({
    content: {
      gap: 12,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    sectionHeader: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    panelTitle: {
      color: colors.foreground,
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 20,
    },
    panelSubtitle: {
      color: colors.mutedForeground,
      fontSize: 13,
      lineHeight: 18,
    },
    sectionLabel: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    pillWrap: {
      flexDirection: 'row',
      gap: 8,
    },
    orgPill: {
      minWidth: 140,
      maxWidth: 220,
      gap: 2,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    orgPillActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    orgPillTitle: {
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    orgPillTitleActive: {
      color: colors.primaryForeground,
    },
    orgPillMeta: {
      color: colors.mutedForeground,
      fontSize: 12,
      lineHeight: 16,
    },
    orgPillMetaActive: {
      color: colors.primaryForeground,
    },
    segmentRow: {
      flexDirection: 'row',
      gap: 8,
    },
    segmentButton: {
      flex: 1,
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      backgroundColor: colors.card,
      paddingVertical: 9,
    },
    segmentButtonActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    segmentText: {
      color: colors.mutedForeground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    segmentTextActive: {
      color: colors.primaryForeground,
    },
    metadataBox: {
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.muted,
      padding: 12,
    },
    codeText: {
      color: colors.foreground,
      fontSize: 12,
      fontFamily: 'monospace',
      lineHeight: 17,
    },
    formBlock: {
      gap: 10,
    },
    attributeBox: {
      gap: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: 12,
    },
    multilineInput: {
      minHeight: 120,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      color: colors.foreground,
      padding: 12,
      textAlignVertical: 'top',
    },
    certInput: {
      minHeight: 140,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      backgroundColor: colors.card,
      color: colors.foreground,
      padding: 12,
      textAlignVertical: 'top',
    },
    toggleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 6,
      padding: 12,
    },
    switchTrack: {
      width: 48,
      height: 28,
      justifyContent: 'center',
      borderRadius: 14,
      backgroundColor: colors.muted,
      padding: 3,
    },
    switchTrackActive: {
      backgroundColor: colors.primary,
    },
    switchThumb: {
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.background,
    },
    switchThumbActive: {
      transform: [{ translateX: 20 }],
    },
    actionRow: {
      gap: 8,
    },
    createdTokenBox: {
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.accentAmber,
      borderRadius: 6,
      backgroundColor: `${colors.accentAmber}12`,
      padding: 12,
    },
    tokenSecret: {
      color: colors.foreground,
      fontSize: 12,
      fontFamily: 'monospace',
      lineHeight: 17,
    },
    tokenList: {
      gap: 8,
    },
    tokenRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      borderRadius: 4,
      padding: 10,
    },
    tokenTitleRow: {
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    tokenName: {
      flex: 1,
      color: colors.foreground,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    noticeText: {
      color: colors.accentEmerald,
      fontSize: 13,
      lineHeight: 18,
    },
    errorText: {
      color: colors.destructive,
      fontSize: 13,
      lineHeight: 18,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}
