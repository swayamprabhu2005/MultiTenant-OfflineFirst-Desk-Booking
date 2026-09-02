import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Non-Destructive Database Seeding...');

  const defaultPasswordHash = await bcrypt.hash('DeskBook#2026!AdminSec', 10);

  // 1. Idempotent Upsert of Platform Administration Organization
  const systemOrg = await prisma.organization.upsert({
    where: { subdomain: 'system' },
    update: {
      name: 'Platform Administration',
      code: 'SYSTEM',
    },
    create: {
      name: 'Platform Administration',
      code: 'SYSTEM',
      subdomain: 'system',
      themeColor: '#0f172a', // Slate 900
    },
  });

  // 2. Idempotent Upsert of Platform Administrator User
  await prisma.user.upsert({
    where: { email: 'admin@deskbooking.com' },
    update: {
      role: Role.PLATFORM_ADMIN,
    },
    create: {
      organizationId: systemOrg.id,
      name: 'Platform Administrator',
      email: 'admin@deskbooking.com',
      passwordHash: defaultPasswordHash,
      role: Role.PLATFORM_ADMIN,
      department: 'Global Operations',
      mustChangePassword: false,
    },
  });

  console.log('✅ Database Seeding Completed Successfully!');
  console.log(`🔑 Platform Administrator Login:`);
  console.log(`   - Subdomain:      system`);
  console.log(`   - Platform Admin: admin@deskbooking.com`);
  console.log(`   - Password:       DeskBook#2026!AdminSec`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
