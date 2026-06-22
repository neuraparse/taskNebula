/**
 * Super Admin API - Single User Management
 * GET /api/admin/users/[userId] - Get user details
 * PATCH /api/admin/users/[userId] - Update user (grant/revoke super admin)
 * DELETE /api/admin/users/[userId] - Delete user
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db, users, systemAuditLogs, schema } from '@tasknebula/db';
import { and, count, eq, ne, sql } from 'drizzle-orm';
import { auth } from '@/auth';
import { isSuperAdmin } from '@/lib/auth/permissions';
import { createId } from '@paralleldrive/cuid2';

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

type UserReferenceRow = {
  schemaName: string;
  tableName: string;
  columnName: string;
  isNotNull: boolean;
  deleteAction: string;
};

// GET /api/admin/users/[userId]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { userId } = await params;

    const [user] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        image: users.image,
        status: users.status,
        isSuperAdmin: users.isSuperAdmin,
        superAdminGrantedAt: users.superAdminGrantedAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error('Failed to fetch user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}

const updateUserSchema = z.object({
  isSuperAdmin: z.boolean().optional(),
  status: z.enum(['active', 'inactive', 'invited']).optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    const body = await request.json();
    const data = updateUserSchema.parse(body);

    // Get current user
    const [currentUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent removing own super admin status
    if (userId === session.user.id && data.isSuperAdmin === false) {
      return NextResponse.json(
        { error: 'Cannot remove your own super admin status' },
        { status: 400 }
      );
    }

    // Update user
    const updateData: any = {
      ...data,
      updatedAt: new Date(),
    };

    // If granting super admin, set granted fields
    if (data.isSuperAdmin === true && !currentUser.isSuperAdmin) {
      updateData.superAdminGrantedAt = new Date();
      updateData.superAdminGrantedBy = session.user.id;
    }

    // If revoking super admin, clear granted fields
    if (data.isSuperAdmin === false && currentUser.isSuperAdmin) {
      updateData.superAdminGrantedAt = null;
      updateData.superAdminGrantedBy = null;
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update user');
    }

    // Create audit log
    const changes: Record<string, { from: any; to: any }> = {};
    if (data.isSuperAdmin !== undefined && data.isSuperAdmin !== currentUser.isSuperAdmin) {
      changes.isSuperAdmin = { from: currentUser.isSuperAdmin, to: data.isSuperAdmin };
    }
    if (data.status && data.status !== currentUser.status) {
      changes.status = { from: currentUser.status, to: data.status };
    }

    if (Object.keys(changes).length > 0) {
      await db.insert(systemAuditLogs).values({
        id: createId(),
        userId: session.user.id,
        action:
          data.isSuperAdmin === true
            ? 'user.promoted_to_super_admin'
            : data.isSuperAdmin === false
              ? 'user.revoked_super_admin'
              : 'user.updated',
        resourceType: 'user',
        resourceId: userId,
        changes,
        ipAddress:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    }

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      image: updatedUser.image,
      status: updatedUser.status,
      isSuperAdmin: updatedUser.isSuperAdmin,
      superAdminGrantedAt: updatedUser.superAdminGrantedAt,
      createdAt: updatedUser.createdAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation failed', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Failed to update user:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: 'Super admin access required' }, { status: 403 });
    }

    const { userId } = await params;
    if (userId === session.user.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    const [currentUser] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        status: users.status,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (currentUser.isSuperAdmin) {
      const [remainingSuperAdmins] = await db
        .select({ count: count() })
        .from(users)
        .where(and(eq(users.isSuperAdmin, true), ne(users.id, userId)));

      if (Number(remainingSuperAdmins?.count ?? 0) === 0) {
        return NextResponse.json({ error: 'Cannot delete the last super admin' }, { status: 400 });
      }
    }

    await db.transaction(async (tx) => {
      await detachUserReferences(tx, {
        userId,
        fallbackUserId: session.user.id,
      });

      await tx.delete(schema.users).where(eq(schema.users.id, userId));

      await tx.insert(systemAuditLogs).values({
        id: createId(),
        userId: session.user.id,
        action: 'user.deleted',
        resourceType: 'user',
        resourceId: userId,
        changes: {
          status: { from: currentUser.status, to: null },
          isSuperAdmin: { from: currentUser.isSuperAdmin, to: null },
        },
        metadata: {
          email: currentUser.email,
          name: currentUser.name,
        },
        ipAddress:
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete user:', error);
    return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 });
  }
}

async function detachUserReferences(
  tx: DbTransaction,
  { userId, fallbackUserId }: { userId: string; fallbackUserId: string }
) {
  const result = await tx.execute<UserReferenceRow>(sql`
    SELECT
      ns.nspname AS "schemaName",
      cls.relname AS "tableName",
      attr.attname AS "columnName",
      attr.attnotnull AS "isNotNull",
      constraint_row.confdeltype AS "deleteAction"
    FROM pg_constraint constraint_row
    JOIN pg_class cls ON cls.oid = constraint_row.conrelid
    JOIN pg_namespace ns ON ns.oid = cls.relnamespace
    JOIN pg_attribute attr
      ON attr.attrelid = constraint_row.conrelid
     AND attr.attnum = constraint_row.conkey[1]
    WHERE constraint_row.contype = 'f'
      AND constraint_row.confrelid = 'public.users'::regclass
      AND array_length(constraint_row.conkey, 1) = 1
  `);
  const references: UserReferenceRow[] = Array.isArray(result)
    ? result
    : ((result as { rows?: UserReferenceRow[] }).rows ?? []);

  for (const reference of references) {
    if (reference.deleteAction === 'c' || reference.deleteAction === 'n') {
      continue;
    }

    const qualifiedTable = sql.raw(
      `${quoteIdentifier(reference.schemaName)}.${quoteIdentifier(reference.tableName)}`
    );
    const column = sql.raw(quoteIdentifier(reference.columnName));

    if (reference.isNotNull) {
      await tx.execute(sql`
        UPDATE ${qualifiedTable}
        SET ${column} = ${fallbackUserId}
        WHERE ${column} = ${userId}
      `);
    } else {
      await tx.execute(sql`
        UPDATE ${qualifiedTable}
        SET ${column} = NULL
        WHERE ${column} = ${userId}
      `);
    }
  }

  await tx.delete(schema.organizationMembers).where(eq(schema.organizationMembers.userId, userId));

  await tx.delete(schema.teamMembers).where(eq(schema.teamMembers.userId, userId));

  await tx
    .update(schema.teams)
    .set({ leadId: null, updatedAt: new Date() })
    .where(eq(schema.teams.leadId, userId));

  await tx
    .update(schema.systemSettings)
    .set({ updatedBy: null, updatedAt: new Date() })
    .where(eq(schema.systemSettings.updatedBy, userId));

  await tx
    .update(schema.featureFlags)
    .set({ createdBy: null, updatedAt: new Date() })
    .where(eq(schema.featureFlags.createdBy, userId));

  await tx
    .update(schema.featureFlags)
    .set({ updatedBy: null, updatedAt: new Date() })
    .where(eq(schema.featureFlags.updatedBy, userId));

  await tx
    .update(schema.organizationInvitations)
    .set({ invitedBy: null, updatedAt: new Date() })
    .where(eq(schema.organizationInvitations.invitedBy, userId));

  await tx
    .update(schema.users)
    .set({ superAdminGrantedBy: null, updatedAt: new Date() })
    .where(eq(schema.users.superAdminGrantedBy, userId));
}

function quoteIdentifier(identifier: string) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
