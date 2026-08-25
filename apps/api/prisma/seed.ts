import { PrismaClient, Role, ResourceType, ResourceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Database Seeding...');

  const defaultPasswordHash = await bcrypt.hash('Password123!', 10);

  // 1. Create Acme Corp Organization
  const acme = await prisma.organization.upsert({
    where: { subdomain: 'acme' },
    update: {
      themeColor: '#16a34a',
    },
    create: {
      name: 'Acme Corporation',
      code: 'ACME',
      subdomain: 'acme',
      themeColor: '#16a34a', // Emerald green
      logoUrl: 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?auto=format&fit=crop&w=120&q=80',
    },
  });

  // 2. Create TechGlobe Organization
  const techglobe = await prisma.organization.upsert({
    where: { subdomain: 'techglobe' },
    update: {},
    create: {
      name: 'TechGlobe Systems',
      code: 'TECHGLOBE',
      subdomain: 'techglobe',
      themeColor: '#0284c7', // Sky Blue
    },
  });

  // 3. Create Buildings for Acme Corp
  const hqBuilding = await prisma.building.upsert({
    where: {
      organizationId_code: {
        organizationId: acme.id,
        code: 'HQ',
      },
    },
    update: {},
    create: {
      organizationId: acme.id,
      name: 'Acme HQ Tower',
      code: 'HQ',
      address: '100 Enterprise Way, Suite 500, San Francisco CA',
    },
  });

  // 4. Create Floors for HQ Building
  const floor1 = await prisma.floor.upsert({
    where: {
      buildingId_floorNumber: {
        buildingId: hqBuilding.id,
        floorNumber: 1,
      },
    },
    update: {},
    create: {
      buildingId: hqBuilding.id,
      floorNumber: 1,
      name: 'Floor 1 - Engineering & Design',
    },
  });

  const floor2 = await prisma.floor.upsert({
    where: {
      buildingId_floorNumber: {
        buildingId: hqBuilding.id,
        floorNumber: 2,
      },
    },
    update: {},
    create: {
      buildingId: hqBuilding.id,
      floorNumber: 2,
      name: 'Floor 2 - Executive & Sales',
    },
  });

  // 5. Create Resources (Cubicles, Desks, Boardrooms)
  const cubiclesF1 = [
    { code: 'CUB-101', name: 'Cubicle 101 (Dual Monitor)', features: ['Dual Monitor', 'Quiet Zone', 'Standing Desk'] },
    { code: 'CUB-102', name: 'Cubicle 102 (Window View)', features: ['Window View', 'Power Outlet', 'Ethernet'] },
    { code: 'CUB-103', name: 'Cubicle 103 (Quiet Zone)', features: ['Quiet Zone', 'Ergonomic Chair'] },
    { code: 'CUB-104', name: 'Cubicle 104 (Standard)', features: ['Power Outlet', 'Ethernet'] },
    { code: 'CUB-105', name: 'Cubicle 105 (Standard)', features: ['Power Outlet'] },
    { code: 'DSK-106', name: 'Hot Desk 106', features: ['USB-C Dock', 'Power Outlet'], type: ResourceType.DESK },
    { code: 'MTG-107', name: 'Meeting Room Alpha', features: ['TV Screen', 'Video Conf', 'Whiteboard'], type: ResourceType.MEETING_ROOM, capacity: 6 },
  ];

  for (const c of cubiclesF1) {
    await prisma.resource.upsert({
      where: {
        floorId_code: {
          floorId: floor1.id,
          code: c.code,
        },
      },
      update: {},
      create: {
        floorId: floor1.id,
        code: c.code,
        name: c.name,
        type: c.type || ResourceType.CUBICLE,
        capacity: c.capacity || 1,
        features: c.features,
      },
    });
  }

  const cubiclesF2 = [
    { code: 'CUB-201', name: 'Cubicle 201 (Executive)', features: ['Standing Desk', 'Dual Monitor', 'Private Office'] },
    { code: 'CUB-202', name: 'Cubicle 202 (Sales Hub)', features: ['Phone Pod', 'Dual Monitor'] },
    { code: 'CUB-203', name: 'Cubicle 203 (Sales Hub)', features: ['Dual Monitor'] },
    { code: 'BRD-204', name: 'Boardroom Board-A', features: ['4K Projector', 'Polycom Conference', 'Catering Table'], type: ResourceType.BOARD_ROOM, capacity: 16 },
  ];

  for (const c of cubiclesF2) {
    await prisma.resource.upsert({
      where: {
        floorId_code: {
          floorId: floor2.id,
          code: c.code,
        },
      },
      update: {},
      create: {
        floorId: floor2.id,
        code: c.code,
        name: c.name,
        type: c.type || ResourceType.CUBICLE,
        capacity: c.capacity || 1,
        features: c.features,
      },
    });
  }

  // 6. Create Users for Acme Corp
  const platformAdmin = await prisma.user.upsert({
    where: { email: 'admin@deskbooking.com' },
    update: {},
    create: {
      organizationId: acme.id,
      name: 'Platform Administrator',
      email: 'admin@deskbooking.com',
      passwordHash: defaultPasswordHash,
      role: Role.PLATFORM_ADMIN,
      department: 'IT Infrastructure',
    },
  });

  const orgAdmin = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: {},
    create: {
      organizationId: acme.id,
      name: 'Acme Org Admin',
      email: 'admin@acme.com',
      passwordHash: defaultPasswordHash,
      role: Role.ORGANIZATION_ADMIN,
      department: 'Facilities Management',
      baseBuildingId: hqBuilding.id,
    },
  });

  const supervisor = await prisma.user.upsert({
    where: { email: 'supervisor@acme.com' },
    update: {},
    create: {
      organizationId: acme.id,
      name: 'Sarah Connor (Supervisor)',
      email: 'supervisor@acme.com',
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      department: 'Engineering Lead',
      baseBuildingId: hqBuilding.id,
    },
  });

  const employee = await prisma.user.upsert({
    where: { email: 'employee@acme.com' },
    update: {},
    create: {
      organizationId: acme.id,
      name: 'John Doe (Employee)',
      email: 'employee@acme.com',
      passwordHash: defaultPasswordHash,
      role: Role.EMPLOYEE,
      department: 'Software Engineering',
      baseBuildingId: hqBuilding.id,
    },
  });

  console.log('✅ Database Seeding Completed Successfully!');
  console.log(`🏢 Seeded Acme Corp (${acme.id}) and TechGlobe (${techglobe.id})`);
  console.log(`🔑 Demo User Logins (Password for all: Password123!):`);
  console.log(`   - Platform Admin: admin@deskbooking.com`);
  console.log(`   - Org Admin:      admin@acme.com`);
  console.log(`   - Supervisor:     supervisor@acme.com`);
  console.log(`   - Employee:       employee@acme.com`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
