import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { MockAiProvider } from './providers/mock-ai.provider';
import { AiProvider } from './providers/ai-provider.interface';
import { AiChatDto, CreateAiAgentDto, UpdateAiAgentDto } from './dto/ai.dto';

@Injectable()
export class AiService {
  private readonly provider: AiProvider = new MockAiProvider();

  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.aIAgent.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const agent = await this.prisma.aIAgent.findFirst({
      where: { id, tenantId },
    });
    if (!agent) {
      throw new NotFoundException({
        code: 'AI_AGENT_NOT_FOUND',
        message: 'AI agent not found',
      });
    }
    return agent;
  }

  async create(tenantId: string, dto: CreateAiAgentDto) {
    return this.prisma.aIAgent.create({
      data: {
        tenantId,
        name: dto.name,
        type: (dto.type as 'CUSTOM') || 'CUSTOM',
        systemPrompt: dto.systemPrompt,
        personality: dto.personality,
        tone: dto.tone,
        model: dto.model ?? 'gpt-4o-mini',
        temperature: dto.temperature ?? 0.7,
        tokenLimit: dto.tokenLimit ?? 4096,
        tools: (dto.tools as object) ?? {},
        permissions: {},
        objectives: {},
        guardrails: (dto.guardrails as object) ?? {},
        escalationRules: {},
        knowledgeBaseId: dto.knowledgeBaseId,
        active: dto.active ?? true,
      },
    });
  }

  async update(tenantId: string, id: string, dto: UpdateAiAgentDto) {
    await this.findOne(tenantId, id);
    return this.prisma.aIAgent.update({
      where: { id },
      data: {
        name: dto.name,
        type: dto.type as never,
        systemPrompt: dto.systemPrompt,
        personality: dto.personality,
        tone: dto.tone,
        model: dto.model,
        temperature: dto.temperature,
        tokenLimit: dto.tokenLimit,
        tools: dto.tools as object | undefined,
        guardrails: dto.guardrails as object | undefined,
        knowledgeBaseId: dto.knowledgeBaseId,
        active: dto.active,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.findOne(tenantId, id);
    await this.prisma.aIAgent.delete({ where: { id } });
    return { deleted: true };
  }

  async chat(tenantId: string, id: string, dto: AiChatDto) {
    const agent = await this.findOne(tenantId, id);

    const history: { role: 'system' | 'user' | 'assistant'; content: string }[] =
      [{ role: 'system', content: agent.systemPrompt }];

    if (dto.conversationId) {
      const recent = await this.prisma.message.findMany({
        where: { tenantId, conversationId: dto.conversationId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      for (const msg of recent.reverse()) {
        if (!msg.body) continue;
        history.push({
          role: msg.direction === 'INBOUND' ? 'user' : 'assistant',
          content: msg.body,
        });
      }
    }

    history.push({ role: 'user', content: dto.message });

    const response = await this.provider.chat({
      messages: history,
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.tokenLimit,
    });

    return {
      agentId: agent.id,
      agentName: agent.name,
      reply: response.content,
      model: response.model,
      usage: response.usage,
      provider: this.provider.name,
      conversationId: dto.conversationId ?? null,
    };
  }

  private async loadRecentMessages(tenantId: string, conversationId: string, take = 30) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
    });
    if (!conversation) {
      throw new NotFoundException({
        code: 'CONVERSATION_NOT_FOUND',
        message: 'Conversation not found',
      });
    }
    const messages = await this.prisma.message.findMany({
      where: { tenantId, conversationId },
      orderBy: { createdAt: 'desc' },
      take,
    });
    return messages.reverse();
  }

  private transcript(messages: { direction: string; body: string | null }[]) {
    return messages
      .filter((m) => m.body)
      .map((m) => `${m.direction === 'INBOUND' ? 'Cliente' : 'Agente'}: ${m.body}`)
      .join('\n');
  }

  async summarizeConversation(tenantId: string, conversationId: string) {
    const messages = await this.loadRecentMessages(tenantId, conversationId, 30);
    const text = this.transcript(messages);
    const inbound = messages.filter((m) => m.direction === 'INBOUND').length;
    const outbound = messages.filter((m) => m.direction === 'OUTBOUND').length;
    const summary =
      messages.length === 0
        ? 'Não há mensagens suficientes para resumir esta conversa.'
        : `Resumo (mock): conversa com ${messages.length} mensagens recentes ` +
          `(${inbound} do cliente, ${outbound} da equipa). ` +
          `Temas principais: atendimento e follow-up. ` +
          (text
            ? `Trecho: "${text.slice(0, 180)}${text.length > 180 ? '…' : ''}"`
            : '');

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        summary,
        aiSummary: {
          summary,
          messageCount: messages.length,
          generatedAt: new Date().toISOString(),
          provider: 'mock',
        },
      },
    });

    return {
      conversationId,
      summary,
      messageCount: messages.length,
      provider: 'mock',
      language: 'pt',
    };
  }

  async classifyIntent(tenantId: string, conversationId: string) {
    const messages = await this.loadRecentMessages(tenantId, conversationId, 30);
    const blob = messages
      .map((m) => m.body || '')
      .join(' ')
      .toLowerCase();

    const rules: { intent: 'sales' | 'support' | 'spam' | 'other'; keywords: string[]; weight: number }[] = [
      {
        intent: 'sales',
        keywords: [
          'preço',
          'preco',
          'orçamento',
          'orcamento',
          'comprar',
          'proposta',
          'plano',
          'assinatura',
          'venda',
          'desconto',
        ],
        weight: 0,
      },
      {
        intent: 'support',
        keywords: [
          'ajuda',
          'problema',
          'erro',
          'bug',
          'suporte',
          'não funciona',
          'nao funciona',
          'reclamação',
          'reclamacao',
          'ticket',
        ],
        weight: 0,
      },
      {
        intent: 'spam',
        keywords: [
          'crypto',
          'bitcoin',
          'ganhe dinheiro',
          'clique aqui',
          'prize',
          'lottery',
          'viagra',
        ],
        weight: 0,
      },
    ];

    for (const rule of rules) {
      for (const kw of rule.keywords) {
        if (blob.includes(kw)) rule.weight += 1;
      }
    }

    const ranked = [...rules].sort((a, b) => b.weight - a.weight);
    const top = ranked[0];
    const intent =
      !top || top.weight === 0 ? ('other' as const) : top.intent;
    const confidence =
      intent === 'other'
        ? 0.4
        : Math.min(0.95, 0.55 + top.weight * 0.12);

    await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { intent },
    });

    return { conversationId, intent, confidence, provider: 'mock-keywords' };
  }

  async suggestNextStep(tenantId: string, conversationId: string) {
    const classified = await this.classifyIntent(tenantId, conversationId);
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, tenantId },
      select: { status: true },
    });

    let suggestion: 'create_deal' | 'create_ticket' | 'close' | 'follow_up' =
      'follow_up';
    let reason = 'Continuar o acompanhamento com o contacto.';

    if (classified.intent === 'sales') {
      suggestion = 'create_deal';
      reason = 'Intenção comercial detectada — criar oportunidade no CRM.';
    } else if (classified.intent === 'support') {
      suggestion = 'create_ticket';
      reason = 'Pedido de suporte detectado — abrir ticket.';
    } else if (
      classified.intent === 'spam' ||
      conversation?.status === 'CLOSED' ||
      conversation?.status === 'RESOLVED'
    ) {
      suggestion = 'close';
      reason =
        classified.intent === 'spam'
          ? 'Conversa parece spam — encerrar.'
          : 'Conversa já resolvida — pode fechar.';
    }

    return {
      conversationId,
      suggestion,
      reason,
      intent: classified.intent,
      confidence: classified.confidence,
    };
  }

  async ragDraft(
    tenantId: string,
    conversationId: string,
    question?: string,
  ) {
    await this.loadRecentMessages(tenantId, conversationId, 10);

    const docs = await this.prisma.knowledgeDocument.findMany({
      where: { tenantId },
      take: 20,
      orderBy: { updatedAt: 'desc' },
      include: {
        chunks: { orderBy: { chunkIndex: 'asc' }, take: 5 },
      },
    });

    const knowledgeText = docs
      .map((d) => {
        const chunkText = d.chunks.map((c) => c.content).join('\n');
        return chunkText
          ? `## ${d.title}\n${chunkText}`
          : `## ${d.title}`;
      })
      .filter(Boolean)
      .join('\n\n')
      .slice(0, 4000);

    const q =
      question ||
      'Escreve um rascunho curto e profissional em português para responder ao cliente.';

    const reply = knowledgeText
      ? `[RAG mock] Com base na base de conhecimento (${docs.length} docs):\n\n` +
        `${q}\n\n---\nContexto usado:\n${knowledgeText.slice(0, 600)}${knowledgeText.length > 600 ? '…' : ''}\n\n` +
        `Sugestão: Olá! Com base na nossa documentação, posso ajudar. Em que posso ser útil?`
      : `[Mock] Sem documentos de conhecimento. ${q}\n\nOlá! Obrigado pelo contacto. Em que posso ajudar?`;

    return {
      conversationId,
      draft: reply,
      knowledgeDocs: docs.length,
      usedRag: docs.length > 0,
      provider: 'mock-rag',
    };
  }

  async hasKnowledgeDocuments(tenantId: string) {
    const count = await this.prisma.knowledgeDocument.count({
      where: { tenantId },
    });
    return count > 0;
  }
}
