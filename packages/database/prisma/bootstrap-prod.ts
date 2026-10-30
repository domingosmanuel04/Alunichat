/**
 * Production bootstrap: plans + single Super Admin.
 * Does NOT create demo tenants/data.
 *
 * Required env:
 *   DATABASE_URL
 *   BOOTSTRAP_ADMIN_EMAIL
 *   BOOTSTRAP_ADMIN_PASSWORD  (≥12 chars)
 * Optional:
 *   BOOTSTRAP_ADMIN_NAME
 */
import {
  PrismaClient,
  PlanName,
  PlatformRole,
  UserStatus,
} from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PLAN_LIMITS: Record<
  PlanName,
  {
    users: number;
    agents: number;
    channels: number;
    messagesPerMonth: number;
    contacts: number;
    automations: number;
    aiAgents: number;
    storageMb: number;
    apiRequestsPerDay: number;
    campaigns: number;
    integrations: number;
  }
> = {
  FREE: {
    users: 2,
    agents: 1,
    channels: 1,
    messagesPerMonth: 500,
    contacts: 200,
    automations: 2,
    aiAgents: 0,
    storageMb: 100,
    apiRequestsPerDay: 100,
    campaigns: 0,
    integrations: 1,
  },
  STARTER: {
    users: 5,
    agents: 3,
    channels: 3,
    messagesPerMonth: 5000,
    contacts: 2000,
    automations: 10,
    aiAgents: 1,
    storageMb: 1024,
    apiRequestsPerDay: 2000,
    campaigns: 3,
    integrations: 5,
  },
  PRO: {
    users: 20,
    agents: 15,
    channels: 10,
    messagesPerMonth: 50000,
    contacts: 20000,
    automations: 50,
    aiAgents: 5,
    storageMb: 10240,
    apiRequestsPerDay: 20000,
    campaigns: 20,
    integrations: 20,
  },
  BUSINESS: {
    users: 100,
    agents: 80,
    channels: 50,
    messagesPerMonth: 500000,
    contacts: 200000,
    automations: 200,
    aiAgents: 20,
    storageMb: 102400,
    apiRequestsPerDay: 100000,
    campaigns: 100,
    integrations: 50,
  },
  ENTERPRISE: {
    users: -1,
    agents: -1,
    channels: -1,
    messagesPerMonth: -1,
    contacts: -1,
    automations: -1,
    aiAgents: -1,
    storageMb: -1,
    apiRequestsPerDay: -1,
    campaigns: -1,
    integrations: -1,
  },
};

const PLAN_FEATURES: Record<PlanName, Record<string, boolean>> = {
  FREE: {
    inbox: true,
    crm: true,
    aiAgents: false,
    automations: true,
    campaigns: false,
    apiAccess: false,
    customDomain: false,
    sso: false,
  },
  STARTER: {
    inbox: true,
    crm: true,
    aiAgents: true,
    automations: true,
    campaigns: true,
    apiAccess: true,
    customDomain: false,
    sso: false,
  },
  PRO: {
    inbox: true,
    crm: true,
    aiAgents: true,
    automations: true,
    campaigns: true,
    apiAccess: true,
    customDomain: true,
    sso: false,
  },
  BUSINESS: {
    inbox: true,
    crm: true,
    aiAgents: true,
    automations: true,
    campaigns: true,
    apiAccess: true,
    customDomain: true,
    sso: true,
  },
  ENTERPRISE: {
    inbox: true,
    crm: true,
    aiAgents: true,
    automations: true,
    campaigns: true,
    apiAccess: true,
    customDomain: true,
    sso: true,
  },
};

const PLAN_PRICES: Record<PlanName, string> = {
  FREE: '0',
  STARTER: '97',
  PRO: '297',
  BUSINESS: '797',
  ENTERPRISE: '0',
};

const PLAN_DISPLAY: Record<PlanName, string> = {
  FREE: 'Free',
  STARTER: 'Starter',
  PRO: 'Pro',
  BUSINESS: 'Business',
  ENTERPRISE: 'Enterprise',
};

async function main() {
  const email = (process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || '';
  const name = (process.env.BOOTSTRAP_ADMIN_NAME || 'Super Admin').trim();

  if (!email || !email.includes('@')) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL is required');
  }
  if (password.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters');
  }

  console.log('Bootstrapping production database (plans + super admin)...');

  for (const planName of Object.values(PlanName)) {
    await prisma.plan.upsert({
      where: { name: planName },
      update: {
        displayName: PLAN_DISPLAY[planName],
        priceMonthly: PLAN_PRICES[planName],
        limits: PLAN_LIMITS[planName],
        features: PLAN_FEATURES[planName],
        active: true,
      },
      create: {
        name: planName,
        displayName: PLAN_DISPLAY[planName],
        priceMonthly: PLAN_PRICES[planName],
        limits: PLAN_LIMITS[planName],
        features: PLAN_FEATURES[planName],
        active: true,
      },
    });
  }
  console.log('✓ Plans');

  await prisma.platformConfig.upsert({
    where: { key: 'app.name' },
    update: { value: { name: 'ALURICHAT' } },
    create: { key: 'app.name', value: { name: 'ALURICHAT' } },
  });

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      name,
      platformRole: PlatformRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email,
      passwordHash,
      name,
      platformRole: PlatformRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✓ Super admin: ${email}`);
  console.log('Bootstrap complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
