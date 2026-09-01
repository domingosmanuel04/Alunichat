'use client';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Workflow } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  FLOW_STEPS,
  commandFromConfig,
  type FlowEdge,
  type FlowNode,
  type FlowStepType,
  parseFlowDefinition,
  stepMeta,
  type WhatsAppFlowDefinition,
} from '@/lib/whatsapp-flow';
import {
  ArrowLeft,
  Clock,
  GitBranch,
  Headphones,
  Image as ImageIcon,
  Maximize2,
  Mic,
  Play,
  MessageSquareText,
  Timer,
  Type,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { toast } from 'sonner';

const NODE_W = 200;
const NODE_H = 64;

const STEP_ICONS: Record<FlowStepType, typeof Play> = {
  start: Play,
  delay: Clock,
  text: MessageSquareText,
  media: ImageIcon,
  audio: Mic,
  typing: Type,
  condition: GitBranch,
  business_hours: Timer,
  transfer_human: Headphones,
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

function nodeCenter(n: FlowNode) {
  return { x: n.position.x + NODE_W / 2, y: n.position.y + NODE_H / 2 };
}

function edgePath(a: FlowNode, b: FlowNode) {
  const p1 = nodeCenter(a);
  const p2 = nodeCenter(b);
  const midY = (p1.y + p2.y) / 2;
  return `M ${p1.x} ${p1.y} C ${p1.x} ${midY}, ${p2.x} ${midY}, ${p2.x} ${p2.y}`;
}

function defaultData(type: FlowStepType): FlowNode['data'] {
  const meta = stepMeta(type);
  if (type === 'delay') return { title: meta.label, subtitle: '1s', seconds: 1 };
  if (type === 'typing') return { title: meta.label, subtitle: '2s', seconds: 2 };
  if (type === 'text')
    return { title: meta.label, subtitle: 'Mensagem', body: '' };
  if (type === 'media')
    return { title: meta.label, subtitle: 'Imagem / arquivo', mediaUrl: '' };
  if (type === 'audio')
    return { title: meta.label, subtitle: 'Áudio', mediaUrl: '' };
  return { title: meta.label, subtitle: meta.defaultSubtitle };
}

export default function WhatsAppFlowEditorPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [definition, setDefinition] = useState<WhatsAppFlowDefinition | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<FlowNode | null>(null);

  const dragRef = useRef<{
    id: string;
    ox: number;
    oy: number;
    startX: number;
    startY: number;
  } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const definitionRef = useRef(definition);
  definitionRef.current = definition;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const wf = await api.getWorkflow(id);
      setWorkflow(wf);
      const def = parseFlowDefinition(wf.versions?.[0]?.definition);
      setDefinition(def);
      setSelectedId(def.nodes[0]?.id || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fluxo não encontrado');
      router.replace('/whatsapp/fluxos');
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = useCallback(
    async (next: WhatsAppFlowDefinition) => {
      setSaveState('saving');
      try {
        await api.updateWorkflow(id, { definition: next });
        setSaveState('saved');
        setTimeout(() => setSaveState('idle'), 1200);
      } catch (err) {
        setSaveState('idle');
        toast.error(err instanceof Error ? err.message : 'Falha ao salvar');
      }
    },
    [id],
  );

  const scheduleSave = useCallback(
    (next: WhatsAppFlowDefinition) => {
      setDefinition(next);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(() => {
        void persist(next);
      }, 600);
    },
    [persist],
  );

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const command = useMemo(
    () =>
      commandFromConfig(
        workflow?.triggerConfig as Record<string, unknown> | null,
      ),
    [workflow],
  );

  const nodesById = useMemo(() => {
    const map = new Map<string, FlowNode>();
    for (const n of definition?.nodes || []) map.set(n.id, n);
    return map;
  }, [definition]);

  function addStep(type: FlowStepType) {
    if (!definition) return;
    if (type === 'start' && definition.nodes.some((n) => n.type === 'start')) {
      toast.error('Já existe um bloco Início');
      return;
    }
    const anchor =
      (selectedId && nodesById.get(selectedId)) ||
      definition.nodes[definition.nodes.length - 1];
    const node: FlowNode = {
      id: uid(type),
      type,
      position: {
        x: (anchor?.position.x || 200) + (type === 'start' ? 0 : 40),
        y: (anchor?.position.y || 80) + (type === 'start' ? 0 : 120),
      },
      data: defaultData(type),
    };
    const edges = [...definition.edges];
    if (anchor && type !== 'start') {
      edges.push({
        id: uid('e'),
        source: anchor.id,
        target: node.id,
      });
    }
    const next = {
      ...definition,
      nodes: [...definition.nodes, node],
      edges,
    };
    setSelectedId(node.id);
    scheduleSave(next);
  }

  function onPointerDown(e: ReactPointerEvent, node: FlowNode) {
    e.stopPropagation();
    setSelectedId(node.id);
    dragRef.current = {
      id: node.id,
      ox: node.position.x,
      oy: node.position.y,
      startX: e.clientX,
      startY: e.clientY,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent) {
    const drag = dragRef.current;
    if (!drag || !definition) return;
    const dx = (e.clientX - drag.startX) / zoom;
    const dy = (e.clientY - drag.startY) / zoom;
    const nextNodes = definition.nodes.map((n) =>
      n.id === drag.id
        ? {
            ...n,
            position: {
              x: Math.max(0, drag.ox + dx),
              y: Math.max(0, drag.oy + dy),
            },
          }
        : n,
    );
    setDefinition({ ...definition, nodes: nextNodes });
  }

  function onPointerUp() {
    if (!dragRef.current || !definitionRef.current) {
      dragRef.current = null;
      return;
    }
    dragRef.current = null;
    scheduleSave(definitionRef.current);
  }

  function openEdit(node: FlowNode) {
    if (node.type === 'start') return;
    setEditNode({ ...node, data: { ...node.data } });
  }

  function saveEdit() {
    if (!editNode || !definition) return;
    const data = { ...editNode.data };
    if (editNode.type === 'delay' || editNode.type === 'typing') {
      const secs = Math.max(1, Number(data.seconds) || 1);
      data.seconds = secs;
      data.subtitle = `${secs}s`;
    } else if (editNode.type === 'text') {
      data.subtitle = (data.body || 'Mensagem').slice(0, 40);
    } else if (editNode.type === 'media' || editNode.type === 'audio') {
      data.subtitle = data.mediaUrl
        ? data.mediaUrl.slice(0, 36)
        : stepMeta(editNode.type).defaultSubtitle;
    }
    const next = {
      ...definition,
      nodes: definition.nodes.map((n) =>
        n.id === editNode.id ? { ...editNode, data } : n,
      ),
    };
    setEditNode(null);
    scheduleSave(next);
  }

  function deleteSelected() {
    if (!definition || !selectedId) return;
    const node = nodesById.get(selectedId);
    if (!node || node.type === 'start') {
      toast.error('O bloco Início não pode ser removido');
      return;
    }
    const next: WhatsAppFlowDefinition = {
      ...definition,
      nodes: definition.nodes.filter((n) => n.id !== selectedId),
      edges: definition.edges.filter(
        (e) => e.source !== selectedId && e.target !== selectedId,
      ),
    };
    setSelectedId(next.nodes[0]?.id || null);
    scheduleSave(next);
  }

  function fitView() {
    setZoom(1);
    canvasRef.current?.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  if (loading || !definition || !workflow) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-surface-border px-5 py-4">
          <Skeleton className="h-8 w-64" />
        </div>
        <div className="flex flex-1 gap-0">
          <Skeleton className="h-full w-56" />
          <Skeleton className="h-full flex-1" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/whatsapp/fluxos"
            className="rounded-lg p-2 text-ink-muted hover:bg-white/5 hover:text-ink"
            title="Voltar"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <p className="truncate font-semibold text-ink">{workflow.name}</p>
            <p className="text-xs text-ink-muted">
              Comando no chat:{' '}
              <span className="text-emerald-400">{`\\${command || '—'}`}</span>
            </p>
          </div>
          <span className="text-xs text-ink-faint">
            {saveState === 'saving'
              ? 'Salvando…'
              : saveState === 'saved'
                ? 'Salvo'
                : ''}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {selectedId && nodesById.get(selectedId)?.type !== 'start' ? (
            <Button size="sm" variant="ghost" onClick={deleteSelected}>
              Remover bloco
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => router.push('/whatsapp/fluxos')}
          >
            Voltar para fluxos
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-56 shrink-0 flex-col border-r border-surface-border bg-surface-raised/40">
          <div className="border-b border-surface-border px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
              Passos disponíveis
            </p>
          </div>
          <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {FLOW_STEPS.map((step) => {
              const Icon = STEP_ICONS[step.type];
              return (
                <button
                  key={step.type}
                  type="button"
                  onClick={() => addStep(step.type)}
                  className="flex w-full items-center gap-2.5 rounded-lg border border-surface-border bg-surface px-2.5 py-2 text-left hover:border-emerald-500/30 hover:bg-white/5"
                >
                  <span
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-md',
                      step.bg,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-t border-surface-border p-3">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
              Zoom
            </p>
            <div className="flex gap-1">
              <button
                type="button"
                className="rounded-md border border-surface-border p-2 text-ink-muted hover:bg-white/5"
                onClick={() => setZoom((z) => Math.min(1.6, z + 0.1))}
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md border border-surface-border p-2 text-ink-muted hover:bg-white/5"
                onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="rounded-md border border-surface-border p-2 text-ink-muted hover:bg-white/5"
                onClick={fitView}
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
              Clique em um passo para adicioná-lo. Arraste os blocos no quadro e
              dê duplo clique para editar.
            </p>
          </div>
        </aside>

        <div
          ref={canvasRef}
          className="relative min-h-0 flex-1 overflow-auto"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(148,163,184,0.18) 1px, transparent 0)',
            backgroundSize: `${18 * zoom}px ${18 * zoom}px`,
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onClick={() => setSelectedId(null)}
        >
          <div
            className="relative origin-top-left"
            style={{
              width: 2400,
              height: 1600,
              transform: `scale(${zoom})`,
            }}
          >
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              width={2400}
              height={1600}
            >
              {definition.edges.map((edge: FlowEdge) => {
                const a = nodesById.get(edge.source);
                const b = nodesById.get(edge.target);
                if (!a || !b) return null;
                return (
                  <path
                    key={edge.id}
                    d={edgePath(a, b)}
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth={2.5}
                    opacity={0.85}
                  />
                );
              })}
            </svg>

            {definition.nodes.map((node) => {
              const meta = stepMeta(node.type);
              const Icon = STEP_ICONS[node.type];
              const selected = selectedId === node.id;
              return (
                <div
                  key={node.id}
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedId(node.id);
                  }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    openEdit(node);
                  }}
                  onPointerDown={(e) => onPointerDown(e, node)}
                  className={cn(
                    'absolute flex cursor-grab items-center gap-2.5 rounded-xl border bg-slate-900/95 px-3 shadow-lg active:cursor-grabbing',
                    selected
                      ? 'border-sky-400 ring-2 ring-sky-400/30'
                      : 'border-surface-border',
                  )}
                  style={{
                    left: node.position.x,
                    top: node.position.y,
                    width: NODE_W,
                    height: NODE_H,
                  }}
                >
                  <span
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                      meta.bg,
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {node.data.title || meta.label}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {node.data.subtitle || meta.defaultSubtitle}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Modal
        open={Boolean(editNode)}
        onClose={() => setEditNode(null)}
        title={editNode ? `Editar · ${stepMeta(editNode.type).label}` : 'Editar'}
        size="md"
      >
        {editNode ? (
          <div className="space-y-4">
            {(editNode.type === 'delay' || editNode.type === 'typing') && (
              <Input
                label="Duração (segundos)"
                type="number"
                min={1}
                value={String(editNode.data.seconds ?? 1)}
                onChange={(e) =>
                  setEditNode({
                    ...editNode,
                    data: {
                      ...editNode.data,
                      seconds: Number(e.target.value) || 1,
                    },
                  })
                }
              />
            )}
            {editNode.type === 'text' && (
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-muted">Mensagem</span>
                <textarea
                  className="min-h-[110px] w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-ink outline-none focus:border-brand/60"
                  value={editNode.data.body || ''}
                  onChange={(e) =>
                    setEditNode({
                      ...editNode,
                      data: { ...editNode.data, body: e.target.value },
                    })
                  }
                  placeholder="Digite o texto..."
                />
              </label>
            )}
            {(editNode.type === 'media' || editNode.type === 'audio') && (
              <>
                <Input
                  label={editNode.type === 'audio' ? 'URL do áudio' : 'URL da mídia'}
                  value={editNode.data.mediaUrl || ''}
                  onChange={(e) =>
                    setEditNode({
                      ...editNode,
                      data: { ...editNode.data, mediaUrl: e.target.value },
                    })
                  }
                  placeholder="https://..."
                />
                {editNode.type === 'media' ? (
                  <label className="flex flex-col gap-1.5 text-sm">
                    <span className="font-medium text-ink-muted">
                      Legenda (opcional)
                    </span>
                    <textarea
                      className="min-h-[72px] w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-ink outline-none focus:border-brand/60"
                      value={editNode.data.body || ''}
                      onChange={(e) =>
                        setEditNode({
                          ...editNode,
                          data: { ...editNode.data, body: e.target.value },
                        })
                      }
                    />
                  </label>
                ) : null}
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setEditNode(null)}>
                Cancelar
              </Button>
              <Button
                className="bg-emerald-600 hover:bg-emerald-500"
                onClick={saveEdit}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
