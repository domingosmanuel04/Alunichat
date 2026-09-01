export type FlowStepType =
  | 'start'
  | 'delay'
  | 'text'
  | 'media'
  | 'audio'
  | 'typing'
  | 'condition'
  | 'business_hours'
  | 'transfer_human';

export type FlowNodeData = {
  title?: string;
  subtitle?: string;
  /** delay / typing duration in seconds */
  seconds?: number;
  /** text body or caption */
  body?: string;
  mediaUrl?: string;
  fileName?: string;
};

export type FlowNode = {
  id: string;
  type: FlowStepType;
  position: { x: number; y: number };
  data: FlowNodeData;
};

export type FlowEdge = {
  id: string;
  source: string;
  target: string;
};

export type WhatsAppFlowDefinition = {
  kind: 'whatsapp_chat_flow';
  nodes: FlowNode[];
  edges: FlowEdge[];
};

export const FLOW_STEPS: {
  type: FlowStepType;
  label: string;
  defaultSubtitle: string;
  color: string;
  bg: string;
}[] = [
  {
    type: 'start',
    label: 'Início',
    defaultSubtitle: 'Ponto de partida',
    color: '#22c55e',
    bg: 'bg-emerald-500/20 text-emerald-400',
  },
  {
    type: 'delay',
    label: 'Atraso',
    defaultSubtitle: '1s',
    color: '#f59e0b',
    bg: 'bg-amber-500/20 text-amber-400',
  },
  {
    type: 'text',
    label: 'Enviar texto',
    defaultSubtitle: 'Mensagem',
    color: '#3b82f6',
    bg: 'bg-blue-500/20 text-blue-400',
  },
  {
    type: 'media',
    label: 'Enviar mídia',
    defaultSubtitle: 'Imagem / arquivo',
    color: '#a855f7',
    bg: 'bg-purple-500/20 text-purple-400',
  },
  {
    type: 'audio',
    label: 'Enviar áudio',
    defaultSubtitle: 'Áudio',
    color: '#ec4899',
    bg: 'bg-pink-500/20 text-pink-400',
  },
  {
    type: 'typing',
    label: 'Digitando',
    defaultSubtitle: '2s',
    color: '#94a3b8',
    bg: 'bg-slate-500/20 text-slate-300',
  },
  {
    type: 'condition',
    label: 'Condição',
    defaultSubtitle: 'Ramificar fluxo',
    color: '#06b6d4',
    bg: 'bg-cyan-500/20 text-cyan-300',
  },
  {
    type: 'business_hours',
    label: 'Horário comercial',
    defaultSubtitle: 'Dentro / fora',
    color: '#eab308',
    bg: 'bg-yellow-500/20 text-yellow-300',
  },
  {
    type: 'transfer_human',
    label: 'Transferir para humano',
    defaultSubtitle: 'Atendimento',
    color: '#f97316',
    bg: 'bg-orange-500/20 text-orange-300',
  },
];

export function stepMeta(type: FlowStepType) {
  return FLOW_STEPS.find((s) => s.type === type) || FLOW_STEPS[0];
}

export function createEmptyFlowDefinition(): WhatsAppFlowDefinition {
  return {
    kind: 'whatsapp_chat_flow',
    nodes: [
      {
        id: 'start',
        type: 'start',
        position: { x: 280, y: 80 },
        data: { title: 'Início', subtitle: 'Ponto de partida' },
      },
    ],
    edges: [],
  };
}

export function normalizeCommand(raw: string) {
  return raw.trim().replace(/^\\+/, '').toLowerCase().replace(/\s+/g, '');
}

export function commandFromConfig(config?: Record<string, unknown> | null) {
  const cmd = config?.command;
  return typeof cmd === 'string' ? cmd : '';
}

export function parseFlowDefinition(
  raw: unknown,
): WhatsAppFlowDefinition {
  const obj = (raw || {}) as Record<string, unknown>;
  const nodes = Array.isArray(obj.nodes) ? (obj.nodes as FlowNode[]) : [];
  const edges = Array.isArray(obj.edges) ? (obj.edges as FlowEdge[]) : [];
  if (nodes.length === 0) return createEmptyFlowDefinition();
  return {
    kind: 'whatsapp_chat_flow',
    nodes,
    edges,
  };
}
