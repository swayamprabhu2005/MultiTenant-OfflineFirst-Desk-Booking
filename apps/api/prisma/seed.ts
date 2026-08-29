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

  // 3. Create Branches
  const acmeBranch = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: acme.id,
        code: 'HQ-LOC',
      },
    },
    update: {},
    create: {
      organizationId: acme.id,
      name: 'Acme HQ Location',
      code: 'HQ-LOC',
      address: 'Silicon Valley Branch, San Jose CA',
    },
  });

  const techglobeBranch = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: techglobe.id,
        code: 'TG-MB',
      },
    },
    update: {},
    create: {
      organizationId: techglobe.id,
      name: 'TechGlobe Main Branch',
      code: 'TG-MB',
      address: 'Main St, Boston MA',
    },
  });

  // 4. Create Buildings related to Branches
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
      branchId: acmeBranch.id,
      name: 'Acme HQ Tower',
      code: 'HQ',
      address: '100 Enterprise Way, Suite 500, San Francisco CA',
    },
  });

  // 5. Create Floors
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

  // 6. Create Sections under Floors
  const section1 = await prisma.section.upsert({
    where: {
      floorId_code: {
        floorId: floor1.id,
        code: 'ES', // Engineering South
      },
    },
    update: {},
    create: {
      floorId: floor1.id,
      name: 'Engineering South',
      code: 'ES',
      columns: 4,
    },
  });

  const section2 = await prisma.section.upsert({
    where: {
      floorId_code: {
        floorId: floor2.id,
        code: 'EN', // Executive North
      },
    },
    update: {},
    create: {
      floorId: floor2.id,
      name: 'Executive North',
      code: 'EN',
      columns: 3,
    },
  });

  // 7. Create Resources related to Sections
  const cubiclesF1 = [
    { code: 'ES-01', name: 'Desk ES-01', type: ResourceType.CUBICLE, hasPC: true },
    { code: 'ES-02', name: 'Desk ES-02', type: ResourceType.CUBICLE, hasPC: false },
    { code: 'ES-03', name: 'Desk ES-03', type: ResourceType.CUBICLE, hasPC: true },
    { code: 'ES-04', name: 'Desk ES-04', type: ResourceType.CUBICLE, hasPC: false },
    { code: 'ES-05', name: 'Desk ES-05', type: ResourceType.CUBICLE, hasPC: false },
    { code: 'ES-06', name: 'Desk ES-06', type: ResourceType.DESK, hasPC: true },
    { code: 'ES-07', name: 'Meeting Room Alpha', type: ResourceType.MEETING_ROOM, capacity: 6, hasPC: false },
  ];

  for (const c of cubiclesF1) {
    await prisma.resource.upsert({
      where: {
        sectionId_code: {
          sectionId: section1.id,
          code: c.code,
        },
      },
      update: {},
      create: {
        sectionId: section1.id,
        code: c.code,
        name: c.name,
        type: c.type || ResourceType.CUBICLE,
        capacity: c.capacity || 1,
        hasPC: c.hasPC,
        features: '[]',
      },
    });
  }

  const cubiclesF2 = [
    { code: 'EN-01', name: 'Desk EN-01', type: ResourceType.CUBICLE, hasPC: true },
    { code: 'EN-02', name: 'Desk EN-02', type: ResourceType.CUBICLE, hasPC: false },
    { code: 'EN-03', name: 'Desk EN-03', type: ResourceType.CUBICLE, hasPC: true },
    { code: 'EN-04', name: 'Boardroom Board-A', type: ResourceType.BOARD_ROOM, capacity: 16, columnSpan: 2, hasPC: true },
  ];

  for (const c of cubiclesF2) {
    await prisma.resource.upsert({
      where: {
        sectionId_code: {
          sectionId: section2.id,
          code: c.code,
        },
      },
      update: {},
      create: {
        sectionId: section2.id,
        code: c.code,
        name: c.name,
        type: c.type || ResourceType.CUBICLE,
        capacity: c.capacity || 1,
        columnSpan: c.columnSpan || 1,
        hasPC: c.hasPC,
        features: '[]',
      },
    });
  }

  // 8. Create Users for Acme Corp
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
      mustChangePassword: false,
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
      baseBranchId: acmeBranch.id,
      baseBuildingId: hqBuilding.id,
      mustChangePassword: false,
    },
  });

  const techLead = await prisma.user.upsert({
    where: { email: 'supervisor@acme.com' },
    update: {},
    create: {
      organizationId: acme.id,
      name: 'Sarah Connor (Tech Lead)',
      email: 'supervisor@acme.com',
      passwordHash: defaultPasswordHash,
      role: Role.TECH_LEAD,
      department: 'Engineering Lead',
      baseBranchId: acmeBranch.id,
      baseBuildingId: hqBuilding.id,
      mustChangePassword: true,
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
      baseBranchId: acmeBranch.id,
      baseBuildingId: hqBuilding.id,
      teamLeadId: techLead.id,
      mustChangePassword: true,
    },
  });

  console.log('✅ Database Seeding Completed Successfully!');
  console.log(`🏢 Seeded Acme Corp (${acme.id}) and TechGlobe (${techglobe.id})`);
  console.log(`🔑 Demo User Logins (Password for all: Password123!):`);
  console.log(`   - Platform Admin: admin@deskbooking.com`);
  console.log(`   - Org Admin:      admin@acme.com`);
  console.log(`   - Tech Lead:      supervisor@acme.com`);
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
