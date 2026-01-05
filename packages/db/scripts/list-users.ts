/**
 * Script to list all users
 * Usage: pnpm tsx scripts/list-users.ts
 */

import { db, users } from '../src';

async function listUsers() {
  try {
    const allUsers = await db.select().from(users);

    console.log(`\n📋 Total users: ${allUsers.length}\n`);

    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   ID: ${user.id}`);
      console.log(`   Status: ${user.status}`);
      console.log(`   Super Admin: ${user.isSuperAdmin ? '✅ YES' : '❌ NO'}`);
      console.log(`   Created: ${user.createdAt}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('Failed to list users:', error);
    process.exit(1);
  }
}

listUsers();

