'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import {
  api,
  type Channel,
  type ScheduledWhatsAppMessage,
} from '@/lib/api';
import {
  CalendarClock,
  FileText,
  Image as ImageIcon,
  Mic,
  Plus,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

/** Same message kinds as WhatsApp → Mensagens (playground) */
const MESSAGE_TYPES = [
  { id: 'text' as const, label: 'Texto', icon: Send },
  { id: 'image' as const, label: 'Imagem', icon: ImageIcon },
  { id: 'audio' as const, label: 'Áudio', icon: Mic },
  { id: 'document' as const, label: 'Documento', icon: FileText },
];

type MessageKind = (typeof MESSAGE_TYPES)[number]['id'];

function selectClassName() {
  return 'h-10 w-full rounded-lg border border-surface-border bg-surface-raised px-3 text-ink outline-none transition focus:border-brand/60 focus:ring-2 focus:ring-brand/20';
}

function toLocalDateInput(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function toLocalTimeInput(d = new Date()) {
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${min}`;
}

function combineLocalDateTime(date: string, time: string) {
  if (!date || !time) return null;
  const isoLocal = `${date}T${time}:00`;
  const dt = new Date(isoLocal);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

function typeLabel(type?: string | null) {
  const t = (type || 'text').toLowerCase();
  return MESSAGE_TYPES.find((x) => x.id === t)?.label || type || 'Texto';
}

function statusLabel(item: ScheduledWhatsAppMessage) {
  const s = (item.status || '').toUpperCase();
  if (s === 'PENDING') return 'Agendado';
  if (s === 'SENT') return 'Enviado';
  if (s === 'FAILED' && item.failedReason === 'CANCELLED') return 'Cancelado';
  if (s === 'FAILED') return 'Falhou';
  return item.status || '—';
}

function statusTone(item: ScheduledWhatsAppMessage) {
  const s = (item.status || '').toUpperCase();
  if (s === 'PENDING') return 'warning' as const;
  if (s === 'SENT') return 'success' as const;
  if (s === 'FAILED' && item.failedReason === 'CANCELLED') return 'default' as const;
  if (s === 'FAILED') return 'danger' as const;
  return 'default' as const;
}

export default function WhatsAppSchedulesPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [items, setItems] = useState<ScheduledWhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filterChannelId, setFilterChannelId] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const [channelId, setChannelId] = useState('');
  const [to, setTo] = useState('');
  const [messageType, setMessageType] = useState<MessageKind>('text');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [date, setDate] = useState(toLocalDateInput());
  const [time, setTime] = useState(
    toLocalTimeInput(new Date(Date.now() + 10 * 60_000)),
  );

  const whatsappChannels = useMemo(
    () =>
      channels.filter(
        (c) =>
          (c.type || '').toUpperCase() === 'WHATSAPP' &&
          ((c.provider || '').toUpperCase() === 'ALURICHAT' ||
            (c.provider || '').toUpperCase() === 'MOCK'),
      ),
    [channels],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [chs, scheduled] = await Promise.all([
        api.listChannels(),
        api.listScheduledWhatsAppMessages(
          filterChannelId ? { channelId: filterChannelId } : undefined,
        ),
      ]);
      setChannels(chs);
      setItems(scheduled);
      setChannelId((prev) => {
        if (prev) return prev;
        const wa = chs.filter(
          (c) => (c.type || '').toUpperCase() === 'WHATSAPP',
        );
        const connected = wa.find(
          (c) => (c.status || '').toUpperCase() === 'CONNECTED',
        );
        return connected?.id || wa[0]?.id || '';
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Falha ao carregar agendamentos',
      );
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filterChannelId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  function clearFile() {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
  }

  function onPickFile(next: File | null) {
    clearFile();
    if (!next) return;
    setFile(next);
    if (messageType === 'image' && next.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(next));
    }
  }

  function onChangeType(next: MessageKind) {
    setMessageType(next);
    clearFile();
    setMediaUrl('');
    if (next !== 'text') setMessage('');
  }

  function openModal() {
    const now = new Date(Date.now() + 10 * 60_000);
    setDate(toLocalDateInput(now));
    setTime(toLocalTimeInput(now));
    setMessage('');
    setTo('');
    setMessageType('text');
    setMediaUrl('');
    clearFile();
    if (!channelId && whatsappChannels[0]) {
      setChannelId(whatsappChannels[0].id);
    }
    setModalOpen(true);
  }

  async function submitSchedule() {
    if (!channelId) {
      toast.error('Selecione uma instância');
      return;
    }
    const digits = to.replace(/\D/g, '');
    if (digits.length < 8) {
      toast.error('Informe o número com DDI/DDD');
      return;
    }
    const when = combineLocalDateTime(date, time);
    if (!when) {
      toast.error('Data/hora inválida');
      return;
    }
    if (when.getTime() <= Date.now() + 5_000) {
      toast.error('Escolha uma data/hora futura');
      return;
    }

    if (messageType === 'text' && !message.trim()) {
      toast.error('Digite a mensagem');
      return;
    }
    if (messageType !== 'text' && !file && !mediaUrl.trim()) {
      toast.error('Envie um arquivo ou informe a URL');
      return;
    }

    setSaving(true);
    try {
      const scheduledAt = when.toISOString();
      if (messageType === 'text') {
        await api.scheduleWhatsAppMessage(channelId, {
          to: digits,
          message: message.trim(),
          scheduledAt,
          messageType: 'text',
        });
      } else if (file) {
        await api.scheduleWhatsAppMessageUpload(channelId, {
          file,
          fileName: file.name,
          to: digits,
          scheduledAt,
          messageType,
          caption: message.trim() || undefined,
          message: message.trim() || undefined,
          ptt: messageType === 'audio',
        });
      } else {
        await api.scheduleWhatsAppMessage(channelId, {
          to: digits,
          scheduledAt,
          messageType,
          mediaUrl: mediaUrl.trim(),
          caption: message.trim() || undefined,
          message: message.trim() || undefined,
          fileName: file?.name,
        });
      }
      toast.success('Mensagem agendada');
      setModalOpen(false);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao agendar');
    } finally {
      setSaving(false);
    }
  }

  async function cancelItem(id: string) {
    if (!window.confirm('Cancelar este agendamento?')) return;
    setBusyId(id);
    try {
      await api.cancelScheduledWhatsAppMessage(id);
      toast.success('Agendamento cancelado');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao cancelar');
    } finally {
      setBusyId(null);
    }
  }

  const pendingCount = items.filter((i) => i.status === 'PENDING').length;
  const acceptByType =
    messageType === 'image'
      ? 'image/*'
      : messageType === 'audio'
        ? 'audio/*'
        : messageType === 'document'
          ? '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip'
          : undefined;

  return (
    <>
      <AppTopbar
        title="WhatsApp · Agendamentos"
        subtitle="Programe envios de mensagens para data e hora certas"
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex min-w-[200px] flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-muted">Filtrar instância</span>
            <select
              className={selectClassName()}
              value={filterChannelId}
              onChange={(e) => setFilterChannelId(e.target.value)}
            >
              <option value="">Todas</option>
              {whatsappChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                </option>
              ))}
            </select>
          </label>
          <p className="pt-6 text-xs text-ink-muted">
            {pendingCount} pendente{pendingCount === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-500"
          onClick={openModal}
        >
          <Plus className="h-4 w-4" />
          Agendar mensagem
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-5">
        {error ? (
          <p className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-surface-border py-16 text-center">
            <CalendarClock className="mx-auto h-10 w-10 text-ink-faint" />
            <p className="mt-3 text-sm text-ink-muted">
              Nenhuma mensagem agendada.
            </p>
            <Button
              className="mt-4 bg-emerald-600 hover:bg-emerald-500"
              onClick={openModal}
            >
              <Plus className="h-4 w-4" />
              Agendar mensagem
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised text-ink-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Quando</th>
                  <th className="px-4 py-3 font-medium">Instância</th>
                  <th className="px-4 py-3 font-medium">Destino</th>
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Mensagem</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-surface-border">
                    <td className="whitespace-nowrap px-4 py-3 text-ink">
                      {new Date(item.scheduledAt).toLocaleString('pt-BR', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {item.channelName || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-ink">
                        {item.contactName || item.to}
                      </div>
                      {item.to && item.contactName !== item.to ? (
                        <div className="text-xs text-ink-faint">{item.to}</div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {typeLabel(item.messageType)}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-ink-muted">
                      {item.body || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statusTone(item)}>{statusLabel(item)}</Badge>
                      {item.status === 'FAILED' &&
                      item.failedReason &&
                      item.failedReason !== 'CANCELLED' ? (
                        <p className="mt-1 max-w-[180px] truncate text-[11px] text-red-400">
                          {item.failedReason}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {item.status === 'PENDING' ? (
                        <button
                          type="button"
                          disabled={busyId === item.id}
                          onClick={() => void cancelItem(item.id)}
                          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs text-ink-muted hover:bg-white/5 hover:text-red-300 disabled:opacity-50"
                          title="Cancelar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Cancelar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Agendar mensagem"
        size="md"
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-muted">Instância</span>
            <select
              className={selectClassName()}
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
            >
              {whatsappChannels.length === 0 ? (
                <option value="">Nenhuma instância</option>
              ) : null}
              {whatsappChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name}
                  {(ch.status || '').toUpperCase() === 'CONNECTED'
                    ? ''
                    : ' (offline)'}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="Número (DDD + número)"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="5511999999999"
            inputMode="tel"
          />

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-muted">Tipo de mensagem</span>
            <select
              className={selectClassName()}
              value={messageType}
              onChange={(e) => onChangeType(e.target.value as MessageKind)}
            >
              {MESSAGE_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          {messageType === 'text' ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-muted">Mensagem</span>
              <textarea
                className="min-h-[110px] w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-ink placeholder:text-ink-faint outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Digite o texto..."
              />
            </label>
          ) : (
            <div className="space-y-3">
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-muted">Arquivo</span>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface-raised px-4 py-6 text-center hover:border-brand/40">
                  <Upload className="h-5 w-5 text-ink-muted" />
                  <span className="text-sm text-ink-muted">
                    {file ? file.name : 'Clique para escolher o arquivo'}
                  </span>
                  <input
                    type="file"
                    accept={acceptByType}
                    className="hidden"
                    onChange={(e) => onPickFile(e.target.files?.[0] || null)}
                  />
                </label>
                {filePreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={filePreview}
                    alt="Pré-visualização"
                    className="mt-2 max-h-40 rounded-lg border border-surface-border object-contain"
                  />
                ) : null}
                {file ? (
                  <button
                    type="button"
                    className="self-start text-xs text-ink-muted hover:text-red-300"
                    onClick={clearFile}
                  >
                    Remover arquivo
                  </button>
                ) : null}
              </label>

              <Input
                label="Ou URL da mídia"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
                placeholder="https://..."
                disabled={Boolean(file)}
              />

              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium text-ink-muted">
                  Legenda (opcional)
                </span>
                <textarea
                  className="min-h-[72px] w-full rounded-lg border border-surface-border bg-surface-raised px-3 py-2 text-ink placeholder:text-ink-faint outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/20"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Texto da legenda"
                />
              </label>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Data (horário local)"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              label="Hora (horário local)"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-500"
              loading={saving}
              onClick={() => void submitSchedule()}
            >
              Agendar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
