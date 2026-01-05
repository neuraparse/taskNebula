/**
 * Script to create a super admin user
 * Usage: pnpm tsx scripts/create-super-admin.ts <email>
 */

import { db, users } from '../src';
import { eq } from 'drizzle-orm';

async function createSuperAdmin() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: pnpm tsx scripts/create-super-admin.ts <email>');
    process.exit(1);
  }

  try {
    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    // Update user to super admin
    const [updatedUser] = await db
      .update(users)
      .set({
        isSuperAdmin: true,
        superAdminGrantedAt: new Date(),
        superAdminGrantedBy: 'system',
      })
      .where(eq(users.id, user.id))
      .returning();

    console.log('✅ Super admin created successfully!');
    console.log('User:', {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      isSuperAdmin: updatedUser.isSuperAdmin,
    });

    process.exit(0);
  } catch (error) {
    console.error('Failed to create super admin:', error);
    process.exit(1);
  }
}

createSuperAdmin();

