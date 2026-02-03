import { NextResponse } from 'next/server';
import { getAllProfiles } from '@/lib/agents/profiles';
import { auth } from '@/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profiles = getAllProfiles();

    // Filter out profiles with missing API keys
    const availableProfiles = profiles.map((profile) => ({
      executor: profile.executor,
      variant: profile.variant,
      displayName: profile.displayName,
      description: profile.description,
      available: checkAvailability(profile),
    }));

    return NextResponse.json({ profiles: availableProfiles });
  } catch (error) {
    console.error('[API] Get profiles failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profiles' },
      { status: 500 }
    );
  }
}

function checkAvailability(profile: any): boolean {
  // Check if required API keys are present
  if (profile.executor === 'CLAUDE_CODE') {
    return !!process.env.ANTHROPIC_API_KEY;
  }
  if (profile.executor === 'OPENAI') {
    return !!process.env.OPENAI_API_KEY;
  }
  if (profile.executor === 'GITHUB_COPILOT') {
    return !!process.env.GITHUB_TOKEN;
  }
  return true;
}
