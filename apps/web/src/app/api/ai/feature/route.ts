import { NextResponse } from 'next/server';
import { getSystemAgentControlSettingsFromDb } from '@/lib/agents/system';

export const dynamic = 'force-dynamic';

/**
 * Legacy endpoint kept for backward compatibility with older clients.
 * Prefer /api/ai/capability, which also exposes org toggle + credential.
 */
export async function GET() {
  try {
    const system = await getSystemAgentControlSettingsFromDb();
    return NextResponse.json({ enabled: system.globalEnabled === true });
  } catch {
    return NextResponse.json({ enabled: false });
  }
}
