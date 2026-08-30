import { PrismaClient, Role, ResourceType, ResourceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding...');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Purge existing data
  console.log('🧹 Purging existing data...');
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.section.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // 2. Create Platform Administration Organization
  const systemOrg = await prisma.organization.create({
    data: {
      name: 'Platform Administration',
      code: 'SYSTEM',
      subdomain: 'system',
      themeColor: '#0f172a', // Slate 900
    },
  });

  // 3. Create Platform Administrator User
  const platformAdmin = await prisma.user.create({
    data: {
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
  console.log(`🔑 Demo User Login:`);
  console.log(`   - Subdomain:      system`);
  console.log(`   - Platform Admin: admin@deskbooking.com`);
  console.log(`   - Password:       Password123!`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
