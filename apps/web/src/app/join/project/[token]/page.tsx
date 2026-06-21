import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import {
  acceptProjectInviteLink,
  ProjectInviteLinkError,
} from '@/lib/invitations/project-invite-links';

export const dynamic = 'force-dynamic';

export default async function ProjectInviteJoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/auth/signup?projectInviteToken=${encodeURIComponent(token)}`);
  }

  let projectKey: string;
  try {
    const invite = await acceptProjectInviteLink({ token, userId: session.user.id });
    projectKey = invite.projectKey;
  } catch (error) {
    const code = error instanceof ProjectInviteLinkError ? error.code : 'failed';
    redirect(`/dashboard?projectInvite=${encodeURIComponent(code)}`);
  }

  redirect(`/projects/${encodeURIComponent(projectKey)}`);
}
