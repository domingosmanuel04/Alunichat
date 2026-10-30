import {
  PrismaClient,
  PlanName,
  TenantStatus,
  TenantRole,
  MembershipStatus,
  ChannelType,
  ChannelProvider,
  ChannelStatus,
  ConversationStatus,
  ConversationPriority,
  MessageDirection,
  MessageType,
  MessageStatus,
  DealStatus,
  AIAgentType,
  WorkflowStatus,
  ParticipantRole,
  LeadTemperature,
  PipelineType,
  UserStatus,
  PlatformRole,
  SubscriptionStatus,
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
  if (
    (process.env.NODE_ENV || '').toLowerCase() === 'production' &&
    process.env.ALLOW_PROD_SEED !== 'true'
  ) {
    throw new Error(
      'Refusing to run demo seed in production. Use: pnpm db:bootstrap (plans + super admin only).',
    );
  }

  console.log('Seeding ALURICHAT database...');

  // Plans
  const plans: Record<PlanName, { id: string }> = {} as Record<PlanName, { id: string }>;
  for (const name of Object.values(PlanName)) {
    const plan = await prisma.plan.upsert({
      where: { name },
      update: {
        displayName: PLAN_DISPLAY[name],
        priceMonthly: PLAN_PRICES[name],
        limits: PLAN_LIMITS[name],
        features: PLAN_FEATURES[name],
        active: true,
      },
      create: {
        name,
        displayName: PLAN_DISPLAY[name],
        priceMonthly: PLAN_PRICES[name],
        limits: PLAN_LIMITS[name],
        features: PLAN_FEATURES[name],
        active: true,
      },
    });
    plans[name] = plan;
  }
  console.log('✓ Plans');

  // Platform config
  await prisma.platformConfig.upsert({
    where: { key: 'app.name' },
    update: { value: { name: 'ALURICHAT' } },
    create: { key: 'app.name', value: { name: 'ALURICHAT' } },
  });

  // Super admin (única conta de acesso da plataforma)
  const SUPER_ADMIN_EMAIL = 'dpmanuel95@gmail.com';
  const SUPER_ADMIN_PASSWORD = 'Manuel@121@';
  const superAdminHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  const superAdmin = await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {
      passwordHash: superAdminHash,
      name: 'Domingos Paulo Manuel',
      platformRole: PlatformRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
    create: {
      email: SUPER_ADMIN_EMAIL,
      passwordHash: superAdminHash,
      name: 'Domingos Paulo Manuel',
      platformRole: PlatformRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // Remove contas demo antigas
  await prisma.user.deleteMany({
    where: {
      email: {
        in: [
          'superadmin@alurichat.com',
          'owner@demo.alurichat.com',
          'agent@demo.alurichat.com',
        ],
      },
    },
  });
  console.log('✓ Super admin');

  // Demo tenant (dados de exemplo; acesso só via Super Admin / owners criados)
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {
      name: 'Demo Empresa',
      status: TenantStatus.ACTIVE,
      planId: plans.PRO.id,
      primaryColor: '#0F766E',
      settings: { timezone: 'America/Sao_Paulo', locale: 'pt-BR' },
      featureFlags: { aiInbox: true, campaigns: true },
    },
    create: {
      slug: 'demo',
      name: 'Demo Empresa',
      status: TenantStatus.ACTIVE,
      planId: plans.PRO.id,
      primaryColor: '#0F766E',
      settings: { timezone: 'America/Sao_Paulo', locale: 'pt-BR' },
      featureFlags: { aiInbox: true, campaigns: true },
    },
  });
  console.log('✓ Demo tenant');

  // Seed usa o Super Admin para relações de dados (sem contas demo separadas)
  const owner = superAdmin;
  const agent = superAdmin;
  console.log('✓ Seed actors (super admin)');

  // Default workspace
  let workspace = await prisma.workspace.findFirst({
    where: { tenantId: tenant.id, slug: 'default' },
  });
  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        tenantId: tenant.id,
        name: 'Principal',
        slug: 'default',
        isDefault: true,
      },
    });
  }

  // Memberships
  const ownerMembership = await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: owner.id } },
    update: {
      role: TenantRole.OWNER,
      status: MembershipStatus.ACTIVE,
      workspaceId: workspace.id,
      permissions: ['*'],
    },
    create: {
      tenantId: tenant.id,
      userId: owner.id,
      workspaceId: workspace.id,
      role: TenantRole.OWNER,
      status: MembershipStatus.ACTIVE,
      permissions: ['*'],
    },
  });

  const agentMembership = await prisma.membership.upsert({
    where: { tenantId_userId: { tenantId: tenant.id, userId: agent.id } },
    update: {
      role: TenantRole.AGENT,
      status: MembershipStatus.ACTIVE,
      workspaceId: workspace.id,
      permissions: ['conversation.read', 'conversation.write', 'contact.read', 'contact.write'],
    },
    create: {
      tenantId: tenant.id,
      userId: agent.id,
      workspaceId: workspace.id,
      role: TenantRole.AGENT,
      status: MembershipStatus.ACTIVE,
      permissions: ['conversation.read', 'conversation.write', 'contact.read', 'contact.write'],
    },
  });
  console.log('✓ Workspace & memberships');

  // Sales team
  let team = await prisma.team.findFirst({
    where: { tenantId: tenant.id, name: 'Sales' },
  });
  if (!team) {
    team = await prisma.team.create({
      data: {
        tenantId: tenant.id,
        name: 'Sales',
        description: 'Equipe comercial',
      },
    });
  }

  await prisma.teamMember.upsert({
    where: {
      teamId_membershipId: { teamId: team.id, membershipId: ownerMembership.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      teamId: team.id,
      membershipId: ownerMembership.id,
    },
  });

  await prisma.teamMember.upsert({
    where: {
      teamId_membershipId: { teamId: team.id, membershipId: agentMembership.id },
    },
    update: {},
    create: {
      tenantId: tenant.id,
      teamId: team.id,
      membershipId: agentMembership.id,
    },
  });

  // Support department
  let department = await prisma.department.findFirst({
    where: { tenantId: tenant.id, name: 'Support' },
  });
  if (!department) {
    department = await prisma.department.create({
      data: {
        tenantId: tenant.id,
        name: 'Support',
        description: 'Suporte ao cliente',
      },
    });
  }
  console.log('✓ Team & department');

  // Sales pipeline
  let pipeline = await prisma.pipeline.findFirst({
    where: { tenantId: tenant.id, name: 'Vendas', isDefault: true },
  });
  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        tenantId: tenant.id,
        name: 'Vendas',
        isDefault: true,
        type: PipelineType.SALES,
      },
    });
  }

  const stageDefs = [
    { name: 'Novo', position: 0, color: '#94A3B8', probability: 10, isWon: false, isLost: false },
    { name: 'Qualificado', position: 1, color: '#38BDF8', probability: 25, isWon: false, isLost: false },
    { name: 'Proposta', position: 2, color: '#A78BFA', probability: 50, isWon: false, isLost: false },
    { name: 'Negociação', position: 3, color: '#FBBF24', probability: 75, isWon: false, isLost: false },
    { name: 'Ganho', position: 4, color: '#34D399', probability: 100, isWon: true, isLost: false },
    { name: 'Perdido', position: 5, color: '#F87171', probability: 0, isWon: false, isLost: true },
  ];

  const stages: Record<string, { id: string }> = {};
  for (const def of stageDefs) {
    let stage = await prisma.pipelineStage.findFirst({
      where: { tenantId: tenant.id, pipelineId: pipeline.id, name: def.name },
    });
    if (!stage) {
      stage = await prisma.pipelineStage.create({
        data: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          ...def,
        },
      });
    }
    stages[def.name] = stage;
  }
  console.log('✓ Sales pipeline');

  // Mock WhatsApp channel
  let channel = await prisma.channel.findFirst({
    where: { tenantId: tenant.id, name: 'WhatsApp Demo' },
  });
  if (!channel) {
    channel = await prisma.channel.create({
      data: {
        tenantId: tenant.id,
        workspaceId: workspace.id,
        name: 'WhatsApp Demo',
        type: ChannelType.WHATSAPP,
        provider: ChannelProvider.MOCK,
        status: ChannelStatus.CONNECTED,
        phoneNumber: '+5511999990000',
        config: { mock: true },
      },
    });
  }
  console.log('✓ Mock WhatsApp channel');

  // Tags
  const tagDefs = [
    { name: 'vip', color: '#F59E0B' },
    { name: 'lead', color: '#3B82F6' },
    { name: 'suporte', color: '#10B981' },
  ];
  const tags: Record<string, { id: string }> = {};
  for (const def of tagDefs) {
    const tag = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: def.name } },
      update: { color: def.color },
      create: { tenantId: tenant.id, name: def.name, color: def.color },
    });
    tags[def.name] = tag;
  }
  console.log('✓ Tags');

  // Contacts
  const contactDefs = [
    {
      name: 'Ana Silva',
      firstName: 'Ana',
      lastName: 'Silva',
      phone: '+5511988776655',
      email: 'ana.silva@example.com',
      temperature: LeadTemperature.HOT,
      score: 80,
      source: 'whatsapp',
      tags: ['vip', 'lead'],
    },
    {
      name: 'Bruno Costa',
      firstName: 'Bruno',
      lastName: 'Costa',
      phone: '+5511977665544',
      email: 'bruno.costa@example.com',
      temperature: LeadTemperature.WARM,
      score: 55,
      source: 'webchat',
      tags: ['lead'],
    },
    {
      name: 'Carla Mendes',
      firstName: 'Carla',
      lastName: 'Mendes',
      phone: '+5511966554433',
      email: 'carla.mendes@example.com',
      temperature: LeadTemperature.VERY_HOT,
      score: 95,
      source: 'instagram',
      tags: ['vip'],
    },
    {
      name: 'Diego Santos',
      firstName: 'Diego',
      lastName: 'Santos',
      phone: '+5511955443322',
      email: 'diego.santos@example.com',
      temperature: LeadTemperature.COLD,
      score: 20,
      source: 'referral',
      tags: ['suporte'],
    },
    {
      name: 'Elena Rocha',
      firstName: 'Elena',
      lastName: 'Rocha',
      phone: '+5511944332211',
      email: 'elena.rocha@example.com',
      temperature: LeadTemperature.WARM,
      score: 60,
      source: 'whatsapp',
      tags: ['lead', 'suporte'],
    },
  ];

  const contacts = [];
  for (const def of contactDefs) {
    let contact = await prisma.contact.findFirst({
      where: { tenantId: tenant.id, email: def.email },
    });
    if (!contact) {
      contact = await prisma.contact.create({
        data: {
          tenantId: tenant.id,
          name: def.name,
          firstName: def.firstName,
          lastName: def.lastName,
          phone: def.phone,
          email: def.email,
          temperature: def.temperature,
          score: def.score,
          source: def.source,
          ownerId: owner.id,
          lastInteractionAt: new Date(),
        },
      });
    }
    for (const tagName of def.tags) {
      await prisma.contactTag.upsert({
        where: {
          contactId_tagId: { contactId: contact.id, tagId: tags[tagName].id },
        },
        update: {},
        create: {
          contactId: contact.id,
          tagId: tags[tagName].id,
          tenantId: tenant.id,
        },
      });
    }
    contacts.push(contact);
  }
  console.log('✓ Contacts');

  // Conversations + messages
  const conversationSeeds = [
    {
      contact: contacts[0],
      status: ConversationStatus.OPEN,
      priority: ConversationPriority.HIGH,
      subject: 'Interesse no plano Pro',
      messages: [
        { direction: MessageDirection.INBOUND, body: 'Olá! Gostaria de saber mais sobre o plano Pro.', senderContact: true },
        { direction: MessageDirection.OUTBOUND, body: 'Olá Ana! Claro, o Pro inclui até 20 usuários e 5 agentes de IA. Posso agendar uma demo?', senderUser: true },
        { direction: MessageDirection.INBOUND, body: 'Sim, por favor. Prefiro amanhã à tarde.', senderContact: true },
      ],
    },
    {
      contact: contacts[1],
      status: ConversationStatus.ASSIGNED,
      priority: ConversationPriority.NORMAL,
      subject: 'Dúvida sobre integração',
      messages: [
        { direction: MessageDirection.INBOUND, body: 'Vocês integram com meu CRM atual?', senderContact: true },
        { direction: MessageDirection.OUTBOUND, body: 'Sim Bruno! Temos integrações nativas e webhooks. Qual CRM você usa?', senderUser: true },
      ],
    },
    {
      contact: contacts[2],
      status: ConversationStatus.PENDING,
      priority: ConversationPriority.URGENT,
      subject: 'Proposta comercial',
      messages: [
        { direction: MessageDirection.INBOUND, body: 'Preciso de uma proposta para 50 agentes até sexta.', senderContact: true },
        { direction: MessageDirection.OUTBOUND, body: 'Entendido Carla! Vou preparar a proposta Business e envio ainda hoje.', senderUser: true },
        { direction: MessageDirection.INBOUND, body: 'Perfeito, obrigada!', senderContact: true },
      ],
    },
  ];

  const conversations = [];
  for (const seed of conversationSeeds) {
    let conversation = await prisma.conversation.findFirst({
      where: {
        tenantId: tenant.id,
        contactId: seed.contact.id,
        channelId: channel.id,
        subject: seed.subject,
      },
    });

    if (!conversation) {
      const lastMsg = seed.messages[seed.messages.length - 1];
      conversation = await prisma.conversation.create({
        data: {
          tenantId: tenant.id,
          channelId: channel.id,
          contactId: seed.contact.id,
          status: seed.status,
          priority: seed.priority,
          assigneeId: agent.id,
          teamId: team.id,
          departmentId: department.id,
          subject: seed.subject,
          lastMessageAt: new Date(),
          lastMessagePreview: lastMsg.body,
          unreadCount: 1,
        },
      });

      await prisma.conversationParticipant.createMany({
        data: [
          {
            conversationId: conversation.id,
            tenantId: tenant.id,
            contactId: seed.contact.id,
            role: ParticipantRole.CONTACT,
          },
          {
            conversationId: conversation.id,
            tenantId: tenant.id,
            userId: agent.id,
            role: ParticipantRole.AGENT,
          },
        ],
      });

      for (const msg of seed.messages) {
        await prisma.message.create({
          data: {
            tenantId: tenant.id,
            conversationId: conversation.id,
            direction: msg.direction,
            type: MessageType.TEXT,
            status: MessageStatus.DELIVERED,
            body: msg.body,
            senderUserId: msg.senderUser ? agent.id : undefined,
            senderContactId: msg.senderContact ? seed.contact.id : undefined,
            sentAt: new Date(),
            deliveredAt: new Date(),
          },
        });
      }
    }
    conversations.push(conversation);
  }
  console.log('✓ Conversations & messages');

  // Deals
  const existingDeals = await prisma.deal.count({ where: { tenantId: tenant.id } });
  if (existingDeals === 0) {
    await prisma.deal.createMany({
      data: [
        {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          stageId: stages['Qualificado'].id,
          contactId: contacts[0].id,
          title: 'Ana Silva — Plano Pro',
          value: '2970',
          currency: 'BRL',
          probability: 25,
          ownerId: owner.id,
          source: 'whatsapp',
          status: DealStatus.OPEN,
          expectedClose: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
        {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          stageId: stages['Negociação'].id,
          contactId: contacts[2].id,
          title: 'Carla Mendes — Business 50 agentes',
          value: '23910',
          currency: 'BRL',
          probability: 75,
          ownerId: owner.id,
          source: 'instagram',
          status: DealStatus.OPEN,
          expectedClose: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      ],
    });
  }
  console.log('✓ Deals');

  // AI Agent
  let aiAgent = await prisma.aIAgent.findFirst({
    where: { tenantId: tenant.id, name: 'Recepcionista Virtual' },
  });
  if (!aiAgent) {
    aiAgent = await prisma.aIAgent.create({
      data: {
        tenantId: tenant.id,
        name: 'Recepcionista Virtual',
        type: AIAgentType.RECEPTIONIST,
        systemPrompt:
          'Você é a recepcionista virtual da Demo Empresa. Cumprimente o cliente, identifique a intenção e encaminhe para o setor correto. Seja cordial e objetiva em português brasileiro.',
        personality: 'amigável e profissional',
        tone: 'formal-amigável',
        model: 'gpt-4o-mini',
        temperature: 0.6,
        tokenLimit: 4096,
        tools: ['transfer_to_human', 'create_contact', 'schedule_appointment'],
        permissions: { level: 'SAFE_WRITE' },
        objectives: ['cumprimentar', 'qualificar intenção', 'rotear conversa'],
        guardrails: { neverShareInternalData: true, escalateOnComplaint: true },
        escalationRules: { keywords: ['reclamação', 'cancelar', 'advogado'], toRole: 'SUPERVISOR' },
        active: true,
      },
    });
  }
  console.log('✓ AI agent');

  // Sample workflow
  let workflow = await prisma.workflow.findFirst({
    where: { tenantId: tenant.id, name: 'Boas-vindas WhatsApp' },
  });
  if (!workflow) {
    workflow = await prisma.workflow.create({
      data: {
        tenantId: tenant.id,
        name: 'Boas-vindas WhatsApp',
        description: 'Envia mensagem de boas-vindas quando um novo contato inicia conversa',
        status: WorkflowStatus.DRAFT,
        triggerType: 'conversation.created',
        triggerConfig: { channelType: 'WHATSAPP' },
      },
    });

    await prisma.workflowVersion.create({
      data: {
        workflowId: workflow.id,
        tenantId: tenant.id,
        version: 1,
        definition: {
          nodes: [
            { id: 'trigger', type: 'trigger', config: { event: 'conversation.created' } },
            {
              id: 'send_welcome',
              type: 'send_message',
              config: {
                body: 'Olá! Bem-vindo à Demo Empresa. Como podemos ajudar?',
              },
            },
          ],
          edges: [{ from: 'trigger', to: 'send_welcome' }],
        },
      },
    });
  }
  console.log('✓ Sample workflow');

  await prisma.quickReply.createMany({
    data: [
      {
        tenantId: tenant.id,
        shortcut: 'ola',
        title: 'Saudação',
        body: 'Olá! Bem-vindo à Demo Empresa. Como posso ajudar?',
        category: 'geral',
      },
      {
        tenantId: tenant.id,
        shortcut: 'horario',
        title: 'Horário de atendimento',
        body: 'Nosso atendimento funciona de segunda a sexta, das 9h às 18h.',
        category: 'geral',
      },
      {
        tenantId: tenant.id,
        shortcut: 'humano',
        title: 'Transferir para humano',
        body: 'Vou transferir você para um atendente humano. Um momento, por favor.',
        category: 'suporte',
      },
    ],
    skipDuplicates: true,
  });
  console.log('✓ Quick replies');

  // Subscription for demo tenant
  await prisma.subscription.upsert({
    where: { tenantId: tenant.id },
    update: {
      planId: plans.PRO.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
    create: {
      tenantId: tenant.id,
      planId: plans.PRO.id,
      status: SubscriptionStatus.ACTIVE,
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      cancelAtPeriodEnd: false,
    },
  });

  console.log('\nSeed complete.');
  console.log(`  Super admin: ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
  console.log(`  Tenant:      ${tenant.slug} (${tenant.id})`);
  console.log(`  Conversations: ${conversations.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
