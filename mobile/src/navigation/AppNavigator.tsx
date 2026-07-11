import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  Bell,
  FolderKanban,
  Layers3,
  LayoutDashboard,
  ListTodo,
  User,
  Users,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

import { useThemeColors } from '@/design/theme-context';
import { invalidateWorkspaceIntegrationQueries, useAcceptProjectInviteLink } from '@/hooks/queries';
import {
  contentIntentFromAuthenticatedAuthIntent,
  postAuthIntentFromCallbackUrl,
} from '@/lib/deep-link-routing';
import { resolveAuthenticatedEmailVerificationNotice } from '@/lib/email-verification-routing';
import { routeIntegrationOAuthIntent } from '@/lib/integration-oauth-routing';
import {
  navigateToContentDeepLink,
  navigateToOrganizationSettings,
  navigateToProject,
} from '@/navigation/root';
import { AiTransparencyScreen } from '@/screens/AiTransparencyScreen';
import { AskAiScreen } from '@/screens/AskAiScreen';
import { ApiDocsScreen } from '@/screens/ApiDocsScreen';
import { AuditLogStreamingScreen } from '@/screens/AuditLogStreamingScreen';
import { DashboardScreen } from '@/screens/DashboardScreen';
import { DeveloperSettingsScreen } from '@/screens/DeveloperSettingsScreen';
import { DocsScreen } from '@/screens/DocsScreen';
import { DocumentDetailScreen } from '@/screens/DocumentDetailScreen';
import { DocumentEditorScreen } from '@/screens/DocumentEditorScreen';
import { DraftsScreen } from '@/screens/DraftsScreen';
import { InboxScreen } from '@/screens/InboxScreen';
import { ImportSettingsScreen } from '@/screens/ImportSettingsScreen';
import { IntakeFormsScreen } from '@/screens/IntakeFormsScreen';
import { InstanceAdminScreen } from '@/screens/InstanceAdminScreen';
import { InitiativeDetailScreen } from '@/screens/InitiativeDetailScreen';
import { InitiativesScreen } from '@/screens/InitiativesScreen';
import { IssueDetailScreen } from '@/screens/IssueDetailScreen';
import { IssuesScreen } from '@/screens/IssuesScreen';
import { LabelsSettingsScreen } from '@/screens/LabelsSettingsScreen';
import { MyIssuesScreen } from '@/screens/MyIssuesScreen';
import { NewIssueScreen } from '@/screens/NewIssueScreen';
import { NewProjectScreen } from '@/screens/NewProjectScreen';
import { OrganizationSettingsScreen } from '@/screens/OrganizationSettingsScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { ProjectAnalyticsScreen } from '@/screens/ProjectAnalyticsScreen';
import { ProjectBacklogScreen } from '@/screens/ProjectBacklogScreen';
import { ProjectChatScreen } from '@/screens/ProjectChatScreen';
import { ProjectDetailScreen } from '@/screens/ProjectDetailScreen';
import { ProjectModulesScreen } from '@/screens/ProjectModulesScreen';
import { ProjectRoadmapScreen } from '@/screens/ProjectRoadmapScreen';
import { ProjectSettingsScreen } from '@/screens/ProjectSettingsScreen';
import { ProjectSprintsScreen } from '@/screens/ProjectSprintsScreen';
import { ProjectViewsScreen } from '@/screens/ProjectViewsScreen';
import { ProjectWorkflowsScreen } from '@/screens/ProjectWorkflowsScreen';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { PublicDocumentScreen } from '@/screens/PublicDocumentScreen';
import { PublicIntakeScreen } from '@/screens/PublicIntakeScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { SsoSettingsScreen } from '@/screens/SsoSettingsScreen';
import { SprintDetailScreen } from '@/screens/SprintDetailScreen';
import { TemplatesScreen } from '@/screens/TemplatesScreen';
import { TeamScreen } from '@/screens/TeamScreen';
import { useAuthIntent } from '@/stores/auth-intent';
import { useContentLinkIntent } from '@/stores/content-link-intent';
import { useNavigationReady } from '@/stores/navigation-ready';
import { useSession } from '@/stores/session';
import type { AppStackParamList, AppTabParamList, DashboardRouteNotice } from './types';

const Stack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<AppTabParamList>();

function MainTabs() {
  const { t } = useTranslation();
  const colors = useThemeColors();

  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
      }}
    >
      <Tabs.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: t('tabs.dashboard'),
          tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Projects"
        component={ProjectsScreen}
        options={{
          title: t('tabs.projects'),
          tabBarIcon: ({ color, size }) => <FolderKanban color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Issues"
        component={MyIssuesScreen}
        options={{
          title: t('tabs.myIssues'),
          tabBarIcon: ({ color, size }) => <ListTodo color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Initiatives"
        component={InitiativesScreen}
        options={{
          title: t('tabs.initiatives'),
          tabBarIcon: ({ color, size }) => <Layers3 color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Team"
        component={TeamScreen}
        options={{
          title: t('tabs.team'),
          tabBarIcon: ({ color, size }) => <Users color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Inbox"
        component={InboxScreen}
        options={{
          title: t('tabs.inbox'),
          tabBarIcon: ({ color, size }) => <Bell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: t('tabs.profile'),
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export function AppNavigator() {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const queryClient = useQueryClient();
  const pendingAuthIntent = useAuthIntent((s) => s.pending);
  const setPendingAuthIntent = useAuthIntent((s) => s.setPending);
  const consumeAuthIntent = useAuthIntent((s) => s.consume);
  const pendingContentLink = useContentLinkIntent((s) => s.pending);
  const setPendingContentLink = useContentLinkIntent((s) => s.setPending);
  const consumeContentLink = useContentLinkIntent((s) => s.consume);
  const navigationReadyVersion = useNavigationReady((s) => s.readyVersion);
  const refreshUser = useSession((s) => s.refreshUser);
  const serverUrl = useSession((s) => s.serverUrl);
  const signInWithMobileOAuthToken = useSession((s) => s.signInWithMobileOAuthToken);
  const signInWithSamlToken = useSession((s) => s.signInWithSamlToken);
  const acceptProjectInvite = useAcceptProjectInviteLink();
  const [acceptedProjectInviteKey, setAcceptedProjectInviteKey] = useState<string | null>(null);
  const [emailVerificationNotice, setEmailVerificationNotice] =
    useState<DashboardRouteNotice | null>(null);
  const [emailVerificationIntentUrl, setEmailVerificationIntentUrl] = useState<string | null>(null);
  const [bridgeAuthIntentUrl, setBridgeAuthIntentUrl] = useState<string | null>(null);

  useEffect(() => {
    const projectInviteToken =
      pendingAuthIntent?.kind === 'signup' || pendingAuthIntent?.kind === 'signin'
        ? pendingAuthIntent.projectInviteToken
        : null;
    if (!projectInviteToken || acceptProjectInvite.isPending || acceptedProjectInviteKey) return;
    const intent = consumeAuthIntent();
    const consumedProjectInviteToken =
      intent?.kind === 'signup' || intent?.kind === 'signin' ? intent.projectInviteToken : null;
    if (!consumedProjectInviteToken) return;

    acceptProjectInvite.mutate(consumedProjectInviteToken, {
      onSuccess: (result) => {
        setAcceptedProjectInviteKey(result.invite.projectKey);
      },
    });
  }, [acceptProjectInvite, acceptedProjectInviteKey, consumeAuthIntent, pendingAuthIntent]);

  useEffect(() => {
    if (!acceptedProjectInviteKey) return;
    if (navigateToProject(acceptedProjectInviteKey)) setAcceptedProjectInviteKey(null);
  }, [acceptedProjectInviteKey, navigationReadyVersion]);

  useEffect(() => {
    if (!pendingAuthIntent) return;
    const intent = contentIntentFromAuthenticatedAuthIntent(pendingAuthIntent, serverUrl);
    if (!intent) return;
    if (navigateToContentDeepLink(intent)) consumeAuthIntent();
  }, [consumeAuthIntent, navigationReadyVersion, pendingAuthIntent, serverUrl]);

  useEffect(() => {
    if (pendingAuthIntent?.kind !== 'login-oauth' && pendingAuthIntent?.kind !== 'saml') return;
    if (bridgeAuthIntentUrl === pendingAuthIntent.rawUrl) return;

    const intent = pendingAuthIntent;
    const token = intent.status === 'authenticated' ? intent.token : null;
    if (!token) {
      if (useAuthIntent.getState().pending?.rawUrl === intent.rawUrl) consumeAuthIntent();
      return;
    }

    setBridgeAuthIntentUrl(intent.rawUrl);
    const signIn = intent.kind === 'login-oauth' ? signInWithMobileOAuthToken : signInWithSamlToken;

    void signIn(token)
      .then(() => {
        if (useAuthIntent.getState().pending?.rawUrl !== intent.rawUrl) return;
        consumeAuthIntent();

        const postAuthIntent = postAuthIntentFromCallbackUrl(intent.callbackUrl, serverUrl);
        if (postAuthIntent?.kind === 'project-invite') {
          setPendingAuthIntent(postAuthIntent.intent);
        } else if (postAuthIntent?.kind === 'content') {
          setPendingContentLink(postAuthIntent.intent);
        }
      })
      .catch(() => {
        if (useAuthIntent.getState().pending?.rawUrl === intent.rawUrl) consumeAuthIntent();
      })
      .finally(() => setBridgeAuthIntentUrl(null));
  }, [
    bridgeAuthIntentUrl,
    consumeAuthIntent,
    pendingAuthIntent,
    serverUrl,
    setPendingAuthIntent,
    setPendingContentLink,
    signInWithMobileOAuthToken,
    signInWithSamlToken,
  ]);

  useEffect(() => {
    if (pendingAuthIntent?.kind !== 'integration-oauth') return;
    routeIntegrationOAuthIntent(pendingAuthIntent, {
      consumeAuthIntent,
      invalidateWorkspaceIntegrationQueries,
      navigateToOrganizationSettings,
      queryClient,
    });
  }, [consumeAuthIntent, navigationReadyVersion, pendingAuthIntent, queryClient]);

  useEffect(() => {
    if (pendingAuthIntent?.kind !== 'verify-email') return;
    if (emailVerificationIntentUrl === pendingAuthIntent.rawUrl) return;

    const intent = pendingAuthIntent;
    setEmailVerificationIntentUrl(intent.rawUrl);
    void resolveAuthenticatedEmailVerificationNotice(intent, refreshUser)
      .then((notice) => {
        if (useAuthIntent.getState().pending?.rawUrl === intent.rawUrl) consumeAuthIntent();
        if (notice) setEmailVerificationNotice(notice);
      })
      .finally(() => setEmailVerificationIntentUrl(null));
  }, [consumeAuthIntent, emailVerificationIntentUrl, pendingAuthIntent, refreshUser]);

  useEffect(() => {
    if (!emailVerificationNotice) return;

    const navigated = navigateToContentDeepLink({
      kind: 'tab',
      rawUrl: 'tasknebula://auth/verify-email',
      tab: 'Dashboard',
      dashboardNotice: emailVerificationNotice,
    });
    if (navigated) setEmailVerificationNotice(null);
  }, [emailVerificationNotice, navigationReadyVersion]);

  useEffect(() => {
    if (!pendingContentLink) return;
    if (navigateToContentDeepLink(pendingContentLink)) consumeContentLink();
  }, [consumeContentLink, navigationReadyVersion, pendingContentLink]);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
      <Stack.Screen
        name="ProjectDetail"
        component={ProjectDetailScreen}
        options={{ title: t('projects.title') }}
      />
      <Stack.Screen
        name="ProjectSettings"
        component={ProjectSettingsScreen}
        options={{ title: t('projects.settings') }}
      />
      <Stack.Screen
        name="ProjectAnalytics"
        component={ProjectAnalyticsScreen}
        options={{ title: t('analytics.title') }}
      />
      <Stack.Screen
        name="ProjectBacklog"
        component={ProjectBacklogScreen}
        options={{ title: t('backlog.title') }}
      />
      <Stack.Screen
        name="ProjectChat"
        component={ProjectChatScreen}
        options={{ title: t('chat.title') }}
      />
      <Stack.Screen
        name="ProjectDocs"
        component={DocsScreen}
        options={{ title: t('docs.projectDoc') }}
      />
      <Stack.Screen
        name="ProjectModules"
        component={ProjectModulesScreen}
        options={{ title: t('modules.title') }}
      />
      <Stack.Screen
        name="ProjectRoadmap"
        component={ProjectRoadmapScreen}
        options={{ title: t('roadmap.title') }}
      />
      <Stack.Screen
        name="ProjectSprints"
        component={ProjectSprintsScreen}
        options={{ title: t('sprints.title') }}
      />
      <Stack.Screen
        name="ProjectViews"
        component={ProjectViewsScreen}
        options={{ title: t('projectViews.title') }}
      />
      <Stack.Screen
        name="ProjectWorkflows"
        component={ProjectWorkflowsScreen}
        options={{ title: t('settings.workflows.title') }}
      />
      <Stack.Screen
        name="SprintDetail"
        component={SprintDetailScreen}
        options={{ title: t('sprints.detailTitle') }}
      />
      <Stack.Screen
        name="IssuesList"
        component={IssuesScreen}
        options={{ title: t('issues.title') }}
      />
      <Stack.Screen
        name="IssueDetail"
        component={IssueDetailScreen}
        options={{ title: t('issues.title') }}
      />
      <Stack.Screen
        name="InitiativeDetail"
        component={InitiativeDetailScreen}
        options={{ title: t('initiatives.title') }}
      />
      <Stack.Screen
        name="ImportSettings"
        component={ImportSettingsScreen}
        options={{ title: t('importWizard.title') }}
      />
      <Stack.Screen
        name="SsoSettings"
        component={SsoSettingsScreen}
        options={{ title: t('sso.title') }}
      />
      <Stack.Screen
        name="AuditLogStreaming"
        component={AuditLogStreamingScreen}
        options={{ title: t('auditLogStreaming.title') }}
      />
      <Stack.Screen
        name="ApiDocs"
        component={ApiDocsScreen}
        options={{ title: t('apiDocs.title') }}
      />
      <Stack.Screen
        name="AiTransparency"
        component={AiTransparencyScreen}
        options={{ title: t('aiTransparency.title') }}
      />
      <Stack.Screen name="AskAi" component={AskAiScreen} options={{ title: t('askAi.title') }} />
      <Stack.Screen
        name="LabelsSettings"
        component={LabelsSettingsScreen}
        options={{ title: t('settings.labels.title') }}
      />
      <Stack.Screen
        name="OrganizationSettings"
        component={OrganizationSettingsScreen}
        options={{ title: t('organization.title') }}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: t('globalSearch.title') }}
      />
      <Stack.Screen name="Drafts" component={DraftsScreen} options={{ title: t('drafts.title') }} />
      <Stack.Screen
        name="Templates"
        component={TemplatesScreen}
        options={{ title: t('templates.title') }}
      />
      <Stack.Screen
        name="DeveloperSettings"
        component={DeveloperSettingsScreen}
        options={{ title: t('developer.title') }}
      />
      <Stack.Screen
        name="IntakeForms"
        component={IntakeFormsScreen}
        options={{ title: t('intakeForms.title') }}
      />
      <Stack.Screen
        name="PublicIntake"
        component={PublicIntakeScreen}
        options={{ title: t('intakeForms.publicKicker') }}
      />
      <Stack.Screen
        name="InstanceAdmin"
        component={InstanceAdminScreen}
        options={{ title: t('admin.title') }}
      />
      <Stack.Screen name="Docs" component={DocsScreen} options={{ title: t('docs.title') }} />
      <Stack.Screen
        name="DocumentDetail"
        component={DocumentDetailScreen}
        options={{ title: t('docs.title') }}
      />
      <Stack.Screen
        name="DocumentEditor"
        component={DocumentEditorScreen}
        options={{ title: t('docs.title') }}
      />
      <Stack.Screen
        name="PublicDocument"
        component={PublicDocumentScreen}
        options={{ title: t('publicShare.kicker') }}
      />
      <Stack.Screen
        name="NewIssue"
        component={NewIssueScreen}
        options={{ title: t('issues.new') }}
      />
      <Stack.Screen
        name="NewProject"
        component={NewProjectScreen}
        options={{ title: t('projects.new') }}
      />
    </Stack.Navigator>
  );
}
