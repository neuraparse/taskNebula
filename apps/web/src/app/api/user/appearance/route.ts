/**
 * User Appearance Settings API
 *
 * GET  /api/user/appearance  - Fetch current user's appearance settings row,
 *                              or server-side defaults if no row exists yet.
 * PUT  /api/user/appearance  - Upsert a partial patch of the current user's
 *                              appearance settings.
 *
 * Schema: packages/db/src/schema/user-appearance.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db, userAppearanceSettings, eq } from '@tasknebula/db';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Enum values mirror the client Zustand store. Kept permissive with nullable
// so the client can clear a preference and fall back to its own defaults.
const themeEnum = z.enum(['light', 'dark', 'system']);
const colorThemeEnum = z.enum(['default', 'ocean', 'forest', 'sunset', 'purple', 'rose']);
const visualStyleEnum = z.enum(['modern', 'minimal', 'glass']);
const interfaceFontEnum = z.enum(['brand', 'ibm']);

const updateAppearanceSchema = z.object({
  theme: themeEnum.nullable().optional(),
  colorTheme: colorThemeEnum.nullable().optional(),
  visualStyle: visualStyleEnum.nullable().optional(),
  interfaceFont: interfaceFontEnum.nullable().optional(),
  animationsEnabled: z.boolean().optional(),
  gradientsEnabled: z.boolean().optional(),
});

// Server-side defaults — mirror the Zustand store's `defaultState` so that an
// unauthenticated first-time load and a signed-in first-time load agree.
const DEFAULT_APPEARANCE = {
  theme: 'system' as const,
  colorTheme: 'default' as const,
  visualStyle: 'modern' as const,
  interfaceFont: 'ibm' as const,
  animationsEnabled: true,
  gradientsEnabled: true,
};

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [row] = await db
      .select()
      .from(userAppearanceSettings)
      .where(eq(userAppearanceSettings.userId, session.user.id))
      .limit(1);

    if (!row) {
      return NextResponse.json({
        settings: {
          userId: session.user.id,
          ...DEFAULT_APPEARANCE,
          updatedAt: null,
        },
      });
    }

    return NextResponse.json({ settings: row });
  } catch (error) {
    console.error('Error fetching user appearance settings:', error);
    return NextResponse.json({ error: 'Failed to fetch appearance settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const patch = updateAppearanceSchema.parse(body);

    // Upsert against the user_id primary key. `set` only touches fields that
    // were actually provided so a partial PUT doesn't clobber other columns.
    const updateSet: Record<string, unknown> = { updatedAt: new Date() };
    if ('theme' in patch) updateSet.theme = patch.theme ?? null;
    if ('colorTheme' in patch) updateSet.colorTheme = patch.colorTheme ?? null;
    if ('visualStyle' in patch) updateSet.visualStyle = patch.visualStyle ?? null;
    if ('interfaceFont' in patch) updateSet.interfaceFont = patch.interfaceFont ?? null;
    if ('animationsEnabled' in patch && patch.animationsEnabled !== undefined) {
      updateSet.animationsEnabled = patch.animationsEnabled;
    }
    if ('gradientsEnabled' in patch && patch.gradientsEnabled !== undefined) {
      updateSet.gradientsEnabled = patch.gradientsEnabled;
    }

    const [result] = await db
      .insert(userAppearanceSettings)
      .values({
        userId: session.user.id,
        theme: patch.theme ?? DEFAULT_APPEARANCE.theme,
        colorTheme: patch.colorTheme ?? DEFAULT_APPEARANCE.colorTheme,
        visualStyle: patch.visualStyle ?? DEFAULT_APPEARANCE.visualStyle,
        interfaceFont: patch.interfaceFont ?? DEFAULT_APPEARANCE.interfaceFont,
        animationsEnabled: patch.animationsEnabled ?? DEFAULT_APPEARANCE.animationsEnabled,
        gradientsEnabled: patch.gradientsEnabled ?? DEFAULT_APPEARANCE.gradientsEnabled,
      })
      .onConflictDoUpdate({
        target: userAppearanceSettings.userId,
        set: updateSet,
      })
      .returning();

    return NextResponse.json({ settings: result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error updating user appearance settings:', error);
    return NextResponse.json({ error: 'Failed to update appearance settings' }, { status: 500 });
  }
}
