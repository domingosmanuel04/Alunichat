'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { api, type Channel } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Eye,
  FileText,
  Image as ImageIcon,
  Mic,
  MicOff,
  Send,
  Square,
  Trash2,
  Upload,
  UserCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

type TabId = 'texto' | 'imagem' | 'audio' | 'documento' | 'chat' | 'verificar';

const TABS: {
  id: TabId;
  label: string;
  icon: typeof Send;
}[] = [
  { id: 'texto', label: 'Texto', icon: Send },
  { id: 'imagem', label: 'Imagem', icon: ImageIcon },
  { id: 'audio', label: 'Áudio', icon: Mic },
  { id: 'documento', label: 'Documento', icon: FileText },
  { id: 'chat', label: 'Chat', icon: Eye },
  { id: 'verificar', label: 'Verificar Números', icon: UserCheck },
];

export default function ApiPlaygroundPage() {
  const params = useParams<{ id: string }>();
  const channelId = params.id;

  const [channel, setChannel] = useState<Channel | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabId>('texto');
  const [to, setTo] = useState('');
  const [message, setMessage] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [fileName, setFileName] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [docFile, setDocFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const [checkNumber, setCheckNumber] = useState('');
  const [checkResult, setCheckResult] = useState<{
    number: string;
    exists: boolean;
    jid: string | null;
  } | null>(null);
  const [sending, setSending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<BlobPart[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ch = await api.getChannel(channelId);
      setChannel(ch);
      if (ch.phoneNumber) setTo(ch.phoneNumber.replace(/\D/g, ''));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar instância');
      setChannel(null);
    } finally {
      setLoading(false);
    }
  }, [channelId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    return () => {
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (imagePreview) URL.revokeObjectURL(imagePreview);
      if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    };
  }, [imagePreview, recordedUrl]);

  function clearImageFile() {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImageFile(null);
    setImagePreview(null);
  }

  function onPickImage(file: File | null) {
    clearImageFile();
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setMediaUrl('');
  }

  function onPickDoc(file: File | null) {
    setDocFile(file);
    if (file) {
      setFileName(file.name);
      setMediaUrl('');
    }
  }

  function clearRecording() {
    if (recordedUrl) URL.revokeObjectURL(recordedUrl);
    setRecordedBlob(null);
    setRecordedUrl(null);
    setRecordSecs(0);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
          ? 'audio/ogg;codecs=opus'
          : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recordChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordChunksRef.current, { type: mime.split(';')[0] });
        clearRecording();
        setRecordedBlob(blob);
        setRecordedUrl(URL.createObjectURL(blob));
        setAudioFile(null);
        setMediaUrl('');
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = setInterval(() => {
        setRecordSecs((s) => s + 1);
      }, 1000);
    } catch {
      toast.error('Não foi possível acessar o microfone');
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  }

  async function sendText() {
    if (!to.trim() || !message.trim()) {
      toast.error('Informe o número e a mensagem');
      return;
    }
    setSending(true);
    try {
      await api.sendChannelText(channelId, { to: to.trim(), message: message.trim() });
      toast.success('Mensagem enviada');
      setMessage('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  }

  async function sendImage() {
    if (!to.trim()) {
      toast.error('Informe o número');
      return;
    }
    if (!imageFile && !mediaUrl.trim()) {
      toast.error('Carregue uma imagem ou informe a URL');
      return;
    }
    setSending(true);
    try {
      if (imageFile) {
        await api.sendChannelMediaUpload(channelId, {
          file: imageFile,
          fileName: imageFile.name,
          to: to.trim(),
          mediaType: 'image',
          caption: caption.trim() || undefined,
        });
      } else {
        await api.sendChannelMedia(channelId, {
          to: to.trim(),
          url: mediaUrl.trim(),
          caption: caption.trim() || undefined,
          mediaType: 'image',
        });
      }
      toast.success('Imagem enviada');
      clearImageFile();
      setMediaUrl('');
      setCaption('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  }

  async function sendAudio() {
    if (!to.trim()) {
      toast.error('Informe o número');
      return;
    }
    const blob = recordedBlob || audioFile;
    if (!blob && !mediaUrl.trim()) {
      toast.error('Grave um áudio, carregue um arquivo ou informe a URL');
      return;
    }
    setSending(true);
    try {
      if (blob) {
        const name =
          audioFile?.name ||
          (recordedBlob ? `gravacao-${Date.now()}.webm` : 'audio.webm');
        await api.sendChannelMediaUpload(channelId, {
          file: blob,
          fileName: name,
          to: to.trim(),
          mediaType: 'audio',
          ptt: Boolean(recordedBlob),
        });
      } else {
        await api.sendChannelMedia(channelId, {
          to: to.trim(),
          url: mediaUrl.trim(),
          mediaType: 'audio',
        });
      }
      toast.success('Áudio enviado');
      clearRecording();
      setAudioFile(null);
      setMediaUrl('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  }

  async function sendDocument() {
    if (!to.trim()) {
      toast.error('Informe o número');
      return;
    }
    if (!docFile && !mediaUrl.trim()) {
      toast.error('Carregue um documento ou informe a URL');
      return;
    }
    setSending(true);
    try {
      if (docFile) {
        await api.sendChannelMediaUpload(channelId, {
          file: docFile,
          fileName: fileName.trim() || docFile.name,
          to: to.trim(),
          mediaType: 'document',
          caption: caption.trim() || undefined,
        });
      } else {
        await api.sendChannelMedia(channelId, {
          to: to.trim(),
          url: mediaUrl.trim(),
          caption: caption.trim() || undefined,
          mediaType: 'document',
          fileName: fileName.trim() || undefined,
        });
      }
      toast.success('Documento enviado');
      setDocFile(null);
      setMediaUrl('');
      setCaption('');
      setFileName('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao enviar');
    } finally {
      setSending(false);
    }
  }

  async function verifyNumber() {
    if (!checkNumber.trim()) {
      toast.error('Informe o número');
      return;
    }
    setSending(true);
    setCheckResult(null);
    try {
      const result = await api.checkWhatsAppNumber(channelId, checkNumber.trim());
      setCheckResult(result);
      toast.success(result.exists ? 'Número encontrado no WhatsApp' : 'Número não encontrado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao verificar');
    } finally {
      setSending(false);
    }
  }

  const name = channel?.name || 'Instância';
  const connected = (channel?.status || '').toUpperCase() === 'CONNECTED';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <AppTopbar
        title={`API Playground · ${name}`}
        subtitle="Teste todas as funcionalidades da API"
      />

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <Link
          href="/whatsapp/instancias"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para Instâncias
        </Link>

        {loading ? (
          <Skeleton className="h-80 w-full rounded-xl" />
        ) : !channel ? (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-8 text-center text-ink-muted">
            Instância não encontrada.
          </div>
        ) : (
          <div className="rounded-xl border border-surface-border bg-surface-raised">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-surface-border px-5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={connected ? 'success' : 'danger'}>
                  {connected ? 'Conectado' : statusLabel(channel.status)}
                </Badge>
                {channel.phoneNumber ? (
                  <span className="text-xs text-ink-muted">{channel.phoneNumber}</span>
                ) : null}
              </div>
            </div>

            <div className="flex gap-1 overflow-x-auto border-b border-surface-border px-2">
              {TABS.map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors',
                      active
                        ? 'border-brand text-brand'
                        : 'border-transparent text-ink-muted hover:text-ink',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div className="p-5">
              {tab === 'texto' && (
                <PlaygroundForm
                  title="Enviar Mensagem de Texto"
                  to={to}
                  setTo={setTo}
                  disabled={!connected || sending}
                  loading={sending}
                  onSubmit={() => void sendText()}
                  submitLabel="Enviar Mensagem"
                >
                  <Field label="Mensagem">
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Digite sua mensagem..."
                      rows={5}
                      className="w-full rounded-lg border border-surface-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/40"
                    />
                  </Field>
                </PlaygroundForm>
              )}

              {tab === 'imagem' && (
                <PlaygroundForm
                  title="Enviar Imagem"
                  to={to}
                  setTo={setTo}
                  disabled={!connected || sending}
                  loading={sending}
                  onSubmit={() => void sendImage()}
                  submitLabel="Enviar Imagem"
                >
                  <Field label="Carregar imagem">
                    <FileDrop
                      accept="image/*"
                      fileLabel={imageFile?.name}
                      onFile={onPickImage}
                      icon={<Upload className="h-4 w-4" />}
                    />
                  </Field>
                  {imagePreview ? (
                    <div className="relative max-h-40 overflow-hidden rounded-lg border border-surface-border bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Pré-visualização"
                        className="mx-auto max-h-40 w-auto object-contain"
                      />
                      <button
                        type="button"
                        onClick={clearImageFile}
                        className="absolute right-2 top-2 rounded-md bg-black/60 p-1.5 text-white hover:bg-black/80"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  <OrDivider />
                  <Field label="URL da imagem">
                    <Input
                      value={mediaUrl}
                      onChange={(e) => {
                        setMediaUrl(e.target.value);
                        if (e.target.value) clearImageFile();
                      }}
                      placeholder="https://…"
                      disabled={Boolean(imageFile)}
                    />
                  </Field>
                  <Field label="Legenda (opcional)">
                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Texto da legenda"
                    />
                  </Field>
                </PlaygroundForm>
              )}

              {tab === 'audio' && (
                <PlaygroundForm
                  title="Enviar Áudio"
                  to={to}
                  setTo={setTo}
                  disabled={!connected || sending || recording}
                  loading={sending}
                  onSubmit={() => void sendAudio()}
                  submitLabel="Enviar Áudio"
                >
                  <div className="space-y-3 rounded-lg border border-surface-border bg-surface p-4">
                    <p className="text-sm font-medium text-ink">Gravar áudio</p>
                    <div className="flex flex-wrap items-center gap-3">
                      {!recording ? (
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => void startRecording()}
                          disabled={!connected || sending}
                        >
                          <Mic className="h-4 w-4" />
                          Iniciar gravação
                        </Button>
                      ) : (
                        <Button type="button" variant="danger" onClick={stopRecording}>
                          <Square className="h-4 w-4" />
                          Parar ({formatSecs(recordSecs)})
                        </Button>
                      )}
                      {recording ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                          <MicOff className="h-3.5 w-3.5 animate-pulse" />
                          Gravando…
                        </span>
                      ) : null}
                    </div>
                    {recordedUrl ? (
                      <div className="flex flex-wrap items-center gap-3">
                        <audio controls src={recordedUrl} className="max-w-full" />
                        <button
                          type="button"
                          onClick={clearRecording}
                          className="inline-flex items-center gap-1 text-xs text-ink-muted hover:text-ink"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Descartar
                        </button>
                      </div>
                    ) : null}
                  </div>

                  <OrDivider />

                  <Field label="Carregar arquivo de áudio">
                    <FileDrop
                      accept="audio/*"
                      fileLabel={audioFile?.name}
                      onFile={(f) => {
                        setAudioFile(f);
                        if (f) {
                          clearRecording();
                          setMediaUrl('');
                        }
                      }}
                      icon={<Upload className="h-4 w-4" />}
                    />
                  </Field>

                  <OrDivider />

                  <Field label="URL do áudio">
                    <Input
                      value={mediaUrl}
                      onChange={(e) => {
                        setMediaUrl(e.target.value);
                        if (e.target.value) {
                          clearRecording();
                          setAudioFile(null);
                        }
                      }}
                      placeholder="https://… (mp3, ogg…)"
                      disabled={Boolean(recordedBlob || audioFile)}
                    />
                  </Field>
                </PlaygroundForm>
              )}

              {tab === 'documento' && (
                <PlaygroundForm
                  title="Enviar Documento"
                  to={to}
                  setTo={setTo}
                  disabled={!connected || sending}
                  loading={sending}
                  onSubmit={() => void sendDocument()}
                  submitLabel="Enviar Documento"
                >
                  <Field label="Carregar documento">
                    <FileDrop
                      accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv,application/*"
                      fileLabel={docFile?.name}
                      onFile={onPickDoc}
                      icon={<Upload className="h-4 w-4" />}
                    />
                  </Field>
                  <OrDivider />
                  <Field label="URL do documento">
                    <Input
                      value={mediaUrl}
                      onChange={(e) => {
                        setMediaUrl(e.target.value);
                        if (e.target.value) setDocFile(null);
                      }}
                      placeholder="https://…"
                      disabled={Boolean(docFile)}
                    />
                  </Field>
                  <Field label="Nome do arquivo">
                    <Input
                      value={fileName}
                      onChange={(e) => setFileName(e.target.value)}
                      placeholder="arquivo.pdf"
                    />
                  </Field>
                  <Field label="Legenda (opcional)">
                    <Input
                      value={caption}
                      onChange={(e) => setCaption(e.target.value)}
                      placeholder="Texto da legenda"
                    />
                  </Field>
                </PlaygroundForm>
              )}

              {tab === 'chat' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-ink">Chat da instância</h2>
                  <p className="text-sm text-ink-muted">
                    Abra a caixa de entrada filtrada por esta instância para ver conversas e
                    responder contatos.
                  </p>
                  <Link
                    href={`/whatsapp/chat?channelId=${channelId}`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-light"
                  >
                    <Eye className="h-4 w-4" />
                    Abrir Chat
                  </Link>
                </div>
              )}

              {tab === 'verificar' && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-ink">Verificar Números</h2>
                  <Field label="Número do WhatsApp">
                    <Input
                      value={checkNumber}
                      onChange={(e) => setCheckNumber(e.target.value)}
                      placeholder="5541999999999"
                    />
                  </Field>
                  {checkResult ? (
                    <div className="rounded-lg border border-surface-border bg-surface px-4 py-3 text-sm">
                      <p className="text-ink">
                        {checkResult.number}{' '}
                        <span
                          className={
                            checkResult.exists ? 'text-emerald-400' : 'text-red-400'
                          }
                        >
                          {checkResult.exists ? '· existe no WhatsApp' : '· não encontrado'}
                        </span>
                      </p>
                      {checkResult.jid ? (
                        <p className="mt-1 text-xs text-ink-faint">{checkResult.jid}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <Button
                    className="w-full"
                    loading={sending}
                    disabled={!connected || sending}
                    onClick={() => void verifyNumber()}
                  >
                    Verificar Número
                  </Button>
                </div>
              )}

              {!connected && tab !== 'chat' ? (
                <p className="mt-4 text-center text-xs text-amber-400/90">
                  Conecte a instância via QR Code para enviar mensagens.
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatSecs(total: number) {
  const m = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function statusLabel(status?: string) {
  const s = (status || '').toUpperCase();
  if (s === 'CONNECTED') return 'Conectado';
  if (s === 'CONNECTING') return 'Aguardando QR';
  if (s === 'DISCONNECTED') return 'Desconectado';
  if (s === 'ERROR') return 'Erro';
  return status || '—';
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="block space-y-1.5">
      <span className="text-sm text-ink-muted">{label}</span>
      {children}
    </div>
  );
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-ink-faint">
      <div className="h-px flex-1 bg-surface-border" />
      ou
      <div className="h-px flex-1 bg-surface-border" />
    </div>
  );
}

function FileDrop({
  accept,
  onFile,
  fileLabel,
  icon,
}: {
  accept: string;
  onFile: (file: File | null) => void;
  fileLabel?: string;
  icon: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-surface-border bg-surface px-4 py-6 text-center transition-colors hover:border-brand/40 hover:bg-brand/5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand/15 text-brand">
        {icon}
      </span>
      <span className="text-sm text-ink">
        {fileLabel ? fileLabel : 'Clique para selecionar o arquivo'}
      </span>
      <span className="text-xs text-ink-faint">Máx. 16 MB</span>
      <input
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0] || null)}
      />
    </label>
  );
}

function PlaygroundForm({
  title,
  to,
  setTo,
  children,
  onSubmit,
  submitLabel,
  disabled,
  loading,
}: {
  title: string;
  to: string;
  setTo: (v: string) => void;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel: string;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <h2 className="text-lg font-semibold text-ink">{title}</h2>
      <Field label="Número do WhatsApp">
        <Input
          value={to}
          onChange={(e) => setTo(e.target.value)}
          placeholder="5541999999999"
        />
      </Field>
      {children}
      <div className="sticky bottom-0 -mx-1 bg-surface-raised/95 pt-2 backdrop-blur-sm">
        <Button type="submit" className="w-full" disabled={disabled} loading={loading}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
