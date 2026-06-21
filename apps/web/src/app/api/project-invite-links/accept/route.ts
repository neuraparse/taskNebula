import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  acceptProjectInviteLink,
  ProjectInviteLinkError,
} from '@/lib/invitations/project-invite-links';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const invite = await acceptProjectInviteLink({
      token: body.projectInviteToken ?? body.token,
      userId: session.user.id,
    });

    return NextResponse.json({
      invite,
      redirectTo: `/projects/${encodeURIComponent(invite.projectKey)}`,
    });
  } catch (error) {
    if (error instanceof ProjectInviteLinkError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 });
    }

    console.error('Error accepting project invite link:', error);
    return NextResponse.json({ error: 'Failed to accept invite link' }, { status: 500 });
  }
}
