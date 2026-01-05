import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

// In-memory store for presence (in production, use Redis)
const presenceStore = new Map<
  string,
  Map<string, { userId: string; userName: string; userEmail: string; lastSeen: number }>
>();

const PRESENCE_TIMEOUT = 60000; // 60 seconds

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    // Get active users for this issue
    const issuePresence = presenceStore.get(issueId);
    if (!issuePresence) {
      return NextResponse.json({ users: [] });
    }

    // Clean up stale presence
    const now = Date.now();
    const activeUsers = Array.from(issuePresence.values()).filter((user) => {
      if (now - user.lastSeen > PRESENCE_TIMEOUT) {
        issuePresence.delete(user.userId);
        return false;
      }
      return true;
    });

    return NextResponse.json({ users: activeUsers });
  } catch (error) {
    console.error('Error fetching presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    // Get or create presence map for this issue
    let issuePresence = presenceStore.get(issueId);
    if (!issuePresence) {
      issuePresence = new Map();
      presenceStore.set(issueId, issuePresence);
    }

    // Update user presence
    issuePresence.set(session.user.id, {
      userId: session.user.id,
      userName: session.user.name || session.user.email || 'Unknown',
      userEmail: session.user.email || 'unknown@example.com',
      lastSeen: Date.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { issueId } = await params;

    // Remove user from presence
    const issuePresence = presenceStore.get(issueId);
    if (issuePresence) {
      issuePresence.delete(session.user.id);
      
      // Clean up empty maps
      if (issuePresence.size === 0) {
        presenceStore.delete(issueId);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing presence:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

