import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, apiKeys } from '@tasknebula/db';
import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import crypto from 'crypto';
import { hasPermission } from '@/lib/auth/permissions';

export const dynamic = 'force-dynamic';

const createApiKeySchema = z.object({
  name: z.string().min(1),
  organizationId: z.string(),
  expiresAt: z.string().optional(),
});

// Generate a secure API key
function generateApiKey(): { key: string; hashedKey: string; prefix: string } {
  const randomBytes = crypto.randomBytes(32);
  const key = `sk_live_${randomBytes.toString('base64url')}`;
  const hashedKey = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.substring(0, 12); // "sk_live_xxxx"
  
  return { key, hashedKey, prefix };
}

// GET /api/api-keys?organizationId=xxx
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }

    const canView = await hasPermission(organizationId, 'api_key:view');
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Fetch API keys (excluding the actual key)
    const keys = await db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        isActive: apiKeys.isActive,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        createdAt: apiKeys.createdAt,
        revokedAt: apiKeys.revokedAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, organizationId))
      .orderBy(desc(apiKeys.createdAt));

    return NextResponse.json({ apiKeys: keys });
  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({ error: 'Failed to fetch API keys' }, { status: 500 });
  }
}

// POST /api/api-keys
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createApiKeySchema.parse(body);

    const canCreate = await hasPermission(validatedData.organizationId, 'api_key:create');
    if (!canCreate) {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Generate API key
    const { key, hashedKey, prefix } = generateApiKey();

    // Create API key record
    const [newKey] = await db
      .insert(apiKeys)
      .values({
        name: validatedData.name,
        key: hashedKey,
        keyPrefix: prefix,
        organizationId: validatedData.organizationId,
        createdBy: session.user.id,
        expiresAt: validatedData.expiresAt ? new Date(validatedData.expiresAt) : null,
      })
      .returning();

    // Return the plain key ONLY on creation (this is the only time it's visible)
    return NextResponse.json({
      apiKey: {
        ...newKey,
        key, // Plain key - show only once!
      },
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid request data', details: error.errors }, { status: 400 });
    }
    console.error('Error creating API key:', error);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }
}
