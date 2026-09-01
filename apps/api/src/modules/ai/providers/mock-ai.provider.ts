import { AiChatRequest, AiChatResponse, AiProvider } from './ai-provider.interface';

const CANNED: Record<string, string> = {
  default:
    'Olá! Sou o assistente virtual da Alurichat. Como posso ajudar você hoje?',
  agendar:
    'Claro! Posso ajudar a agendar. Qual dia e horário prefere?',
  preço:
    'Temos planos a partir do FREE até ENTERPRISE. Quer que eu compare os planos?',
  humano:
    'Vou transferir você para um atendente humano. Um momento, por favor.',
};

export class MockAiProvider implements AiProvider {
  readonly name = 'mock';

  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    const lastUser = [...request.messages]
      .reverse()
      .find((m) => m.role === 'user');
    const text = (lastUser?.content || '').toLowerCase();

    let content = CANNED.default;
    if (text.includes('agend') || text.includes('marcar')) content = CANNED.agendar;
    else if (text.includes('preço') || text.includes('preco') || text.includes('plano'))
      content = CANNED.preço;
    else if (text.includes('humano') || text.includes('atendente'))
      content = CANNED.humano;
    else if (lastUser?.content) {
      content = `Entendi: "${lastUser.content.slice(0, 120)}". Em um ambiente real eu responderia com o modelo ${request.model || 'gpt-4o-mini'}. Como posso ajudar mais?`;
    }

    const promptTokens = request.messages.reduce(
      (acc, m) => acc + Math.ceil(m.content.length / 4),
      0,
    );
    const completionTokens = Math.ceil(content.length / 4);

    return {
      content,
      model: request.model || 'mock-gpt',
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      finishReason: 'stop',
    };
  }
}
