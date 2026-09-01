import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs';
import * as path from 'path';
import QRCode from 'qrcode';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

export type SessionState = {
  channelId: string;
  tenantId: string;
  status: 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  qrCode?: string | null;
  phoneNumber?: string | null;
  error?: string | null;
  updatedAt: string;
};

type LiveSession = SessionState & {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sock?: any;
  starting?: boolean;
  /** When true, connection.close must not auto-reconnect */
  intentionalClose?: boolean;
  /** Generation id to ignore stale socket close events */
  generation?: number;
  reconnectTimer?: ReturnType<typeof setTimeout> | null;
  reconnectAttempts?: number;
  /** Wipe auth at most once per live session to avoid QR-less 408 loops */
  authWipedOnce?: boolean;
  /** Cached chats from history / upserts (jid → meta) */
  chatCache?: Map<string, { id: string; name?: string; conversationTimestamp?: number }>;
  /** Cached contacts (jid → name) */
  contactCache?: Map<string, string>;
  avatarTried?: Set<string>;
};

@Injectable()
export class WhatsAppSessionManager implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsAppSessionManager.name);
  private readonly sessions = new Map<string, LiveSession>();
  private readonly bootstrapLocks = new Map<string, Promise<void>>();
  private readonly rootDir: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly events: EventEmitter2,
  ) {
    this.rootDir = this.resolveRootDir();
    fs.mkdirSync(this.rootDir, { recursive: true });
    this.logger.log(`WhatsApp sessions path: ${this.rootDir}`);
  }

  private resolveRootDir() {
    const configured = this.config.get<string>('WHATSAPP_SESSIONS_PATH')?.trim();
    const candidates: string[] = [];

    // Prefer path relative to the API package (stable across cwd / env mistakes)
    candidates.push(path.resolve(__dirname, '..', '..', '..', 'data', 'whatsapp-sessions'));

    if (configured) {
      candidates.unshift(
        path.isAbsolute(configured)
          ? configured
          : path.resolve(process.cwd(), configured),
      );
      // Root .env often has ./apps/api/data/... while API cwd is already apps/api
      if (/apps[/\\]api[/\\]data[/\\]whatsapp-sessions/.test(configured)) {
        candidates.push(path.resolve(process.cwd(), 'data', 'whatsapp-sessions'));
        candidates.push(
          path.resolve(process.cwd(), 'apps', 'api', 'data', 'whatsapp-sessions'),
        );
      }
    }

    candidates.push(path.join(process.cwd(), 'data', 'whatsapp-sessions'));

    for (const dir of candidates) {
      try {
        if (fs.existsSync(dir)) return dir;
      } catch {
        // ignore
      }
    }

    const fallback = candidates[0];
    return fallback;
  }

  async onModuleInit() {
    try {
      const channels = await this.prisma.channel.findMany({
        where: {
          // Only restore fully connected sessions — CONNECTING is user-driven via Conectar
          status: 'CONNECTED',
          provider: { in: ['ALURICHAT', 'MOCK'] },
          type: 'WHATSAPP',
        },
        select: { id: true, tenantId: true, name: true, status: true },
      });

      // Stale CONNECTING rows (e.g. after crash mid-QR) → DISCONNECTED so UI shows Conectar
      await this.prisma.channel.updateMany({
        where: {
          status: 'CONNECTING',
          provider: { in: ['ALURICHAT', 'MOCK'] },
          type: 'WHATSAPP',
        },
        data: { status: 'DISCONNECTED' },
      });

      for (const ch of channels) {
        if (!this.hasAuth(ch.tenantId, ch.id) || !this.isPairedAuth(ch.tenantId, ch.id)) {
          this.logger.warn(
            `Channel ${ch.id} marked ${ch.status} but auth missing/unpaired — skipping restore`,
          );
          await this.prisma.channel.update({
            where: { id: ch.id },
            data: { status: 'DISCONNECTED' },
          });
          continue;
        }
        this.repairAuthDir(ch.tenantId, ch.id);
        this.logger.log(`Restoring WhatsApp session for ${ch.name} (${ch.id})`);
        void this.startSession(ch.tenantId, ch.id).catch((err) =>
          this.logger.error(
            `Failed to restore session ${ch.id}: ${err?.message || err}`,
          ),
        );
      }
    } catch (err) {
      this.logger.error(
        `Session restore on boot failed: ${(err as Error).message}`,
      );
    }
  }

  getState(channelId: string): SessionState | null {
    const s = this.sessions.get(channelId);
    if (!s) return null;
    return {
      channelId: s.channelId,
      tenantId: s.tenantId,
      status: s.status,
      qrCode: s.qrCode,
      phoneNumber: s.phoneNumber,
      error: s.error,
      updatedAt: s.updatedAt,
    };
  }

  hasAuth(tenantId: string, channelId: string) {
    const creds = path.join(this.authPath(tenantId, channelId), 'creds.json');
    return fs.existsSync(creds);
  }

  /** Paired device auth (creds present + `me`). `registered:false` is repaired in place. */
  private isPairedAuth(tenantId: string, channelId: string): boolean {
    const credsPath = path.join(this.authPath(tenantId, channelId), 'creds.json');
    if (!fs.existsSync(credsPath)) return false;
    try {
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8')) as {
        me?: { id?: string } | null;
        registered?: boolean;
      };
      return Boolean(creds?.me?.id);
    } catch {
      return false;
    }
  }

  /**
   * Repair common corruptions that cause endless DisconnectReason 408:
   * - registered:false while me is set
   * - thousands of lid-* / pre-key files bloating auth load
   */
  private repairAuthDir(tenantId: string, channelId: string): void {
    const dir = this.authPath(tenantId, channelId);
    if (!fs.existsSync(dir)) return;

    const credsPath = path.join(dir, 'creds.json');
    if (fs.existsSync(credsPath)) {
      try {
        const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8')) as Record<
          string,
          unknown
        >;
        const me = creds.me as { id?: string } | null | undefined;
        if (me?.id && creds.registered === false) {
          creds.registered = true;
          fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), 'utf8');
          this.logger.warn(
            `Repaired creds.registered=true for ${channelId} (me=${me.id})`,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to repair creds for ${channelId}: ${(err as Error).message}`,
        );
      }
    }

    // Cap volatile key files — huge dirs make useMultiFileAuthState slow → 408
    try {
      const files = fs.readdirSync(dir);
      const lidFiles = files.filter((f) => f.startsWith('lid-'));
      const preKeys = files.filter((f) => f.startsWith('pre-key-'));
      const prune = (list: string[], keep: number) => {
        if (list.length <= keep) return;
        list
          .sort()
          .slice(0, list.length - keep)
          .forEach((f) => {
            try {
              fs.unlinkSync(path.join(dir, f));
            } catch {
              // ignore
            }
          });
      };
      if (lidFiles.length > 200) {
        prune(lidFiles, 100);
        this.logger.warn(
          `Pruned lid-* files for ${channelId} (had ${lidFiles.length})`,
        );
      }
      if (preKeys.length > 400) {
        prune(preKeys, 200);
        this.logger.warn(
          `Pruned pre-key-* files for ${channelId} (had ${preKeys.length})`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `Failed to prune auth dir ${channelId}: ${(err as Error).message}`,
      );
    }
  }

  /** Wipe Baileys auth so the next bootstrap emits a fresh QR. Keeps chats-cache. */
  private wipeAuthKeepCache(tenantId: string, channelId: string) {
    const dir = this.authPath(tenantId, channelId);
    if (!fs.existsSync(dir)) return;
    let kept = 0;
    for (const f of fs.readdirSync(dir)) {
      if (f === 'chats-cache.json') {
        kept++;
        continue;
      }
      try {
        fs.unlinkSync(path.join(dir, f));
      } catch {
        // ignore
      }
    }
    this.logger.warn(
      `Wiped auth for ${channelId} (kept ${kept} cache file(s)) — QR required`,
    );
  }

  /**
   * Ensures a live Baileys socket is CONNECTED.
   * After API restarts the DB may still say CONNECTED while memory is empty —
   * this resumes from saved credentials on disk.
   */
  async ensureConnected(tenantId: string, channelId: string): Promise<SessionState> {
    const live = this.sessions.get(channelId);
    if (live?.sock && live.status === 'CONNECTED') {
      return this.getState(channelId)!;
    }

    if (!this.hasAuth(tenantId, channelId) || !this.isPairedAuth(tenantId, channelId)) {
      throw new Error(
        'Instância WhatsApp não está conectada. Vá a Instâncias e escaneie o QR Code.',
      );
    }

    this.repairAuthDir(tenantId, channelId);

    const current = this.sessions.get(channelId);
    // Restart from ERROR / idle; do not pile on if already connecting
    if (current?.status === 'ERROR') {
      await this.startSession(tenantId, channelId);
    } else if (!(current?.starting || current?.status === 'CONNECTING')) {
      await this.startSession(tenantId, channelId);
    }

    // Up to ~45s — if auth is healthy, connect is usually fast; QR wipe is faster UX
    for (let i = 0; i < 90; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const s = this.sessions.get(channelId);
      if (s?.sock && s.status === 'CONNECTED') {
        return this.getState(channelId)!;
      }
      if (s?.status === 'ERROR') {
        throw new Error(
          s.error ||
            'Sessão instável. Vá a Instâncias → Conectar e escaneie o QR novamente.',
        );
      }
      // Fresh QR after wipe — user must scan; don't pretend restore can finish
      if (s?.qrCode && !this.isPairedAuth(tenantId, channelId)) {
        throw new Error(
          'Sessão expirada. Escaneie o novo QR Code em Instâncias → Conectar.',
        );
      }
      if ((s?.reconnectAttempts || 0) >= 5 && i >= 16) {
        throw new Error(
          'Não foi possível restaurar a sessão. Vá a Instâncias → Conectar e escaneie o QR.',
        );
      }
      if (!s && i === 10) {
        await this.startSession(tenantId, channelId);
      }
    }

    throw new Error(
      'Não foi possível restaurar a sessão. Vá a Instâncias → Conectar (ou Desconectar e escaneie o QR).',
    );
  }

  async startSession(tenantId: string, channelId: string): Promise<SessionState> {
    const existing = this.sessions.get(channelId);
    if (existing?.status === 'CONNECTED' && existing.sock) {
      return this.getState(channelId)!;
    }
    // Allow restart from ERROR / expired; only skip if a healthy connect is already in flight
    // without a blocking "scan QR" error
    if (
      existing?.status !== 'ERROR' &&
      !existing?.error &&
      (existing?.starting || existing?.status === 'CONNECTING') &&
      existing?.qrCode
    ) {
      return this.getState(channelId)!;
    }
    // Stuck CONNECTING without QR (408 loop) — tear down and start clean
    if (
      existing &&
      (existing.status === 'CONNECTING' || existing.status === 'ERROR') &&
      !existing.qrCode
    ) {
      existing.intentionalClose = true;
      if (existing.reconnectTimer) {
        clearTimeout(existing.reconnectTimer);
        existing.reconnectTimer = null;
      }
      try {
        existing.sock?.end?.(undefined);
      } catch {
        // ignore
      }
      this.sessions.delete(channelId);
      await new Promise((r) => setTimeout(r, 800));
    }

    if (this.hasAuth(tenantId, channelId)) {
      this.repairAuthDir(tenantId, channelId);
    }

    // Replace any half-dead session cleanly
    const afterCleanup = this.sessions.get(channelId);
    if (afterCleanup?.sock) {
      afterCleanup.intentionalClose = true;
      try {
        afterCleanup.sock.end?.(undefined);
      } catch {
        // ignore
      }
    }
    if (afterCleanup?.reconnectTimer) {
      clearTimeout(afterCleanup.reconnectTimer);
    }

    const generation = (afterCleanup?.generation || 0) + 1;
    const state: LiveSession = {
      channelId,
      tenantId,
      status: 'CONNECTING',
      qrCode: null,
      phoneNumber: afterCleanup?.phoneNumber || null,
      error: null,
      updatedAt: new Date().toISOString(),
      starting: true,
      intentionalClose: false,
      generation,
      reconnectTimer: null,
      reconnectAttempts: 0,
      authWipedOnce: afterCleanup?.authWipedOnce || false,
      chatCache: afterCleanup?.chatCache || new Map(),
      contactCache: afterCleanup?.contactCache || new Map(),
      avatarTried: afterCleanup?.avatarTried || new Set(),
    };
    this.sessions.set(channelId, state);

    await this.prisma.channel.update({
      where: { id: channelId },
      data: { status: 'CONNECTING' },
    });

    // Fire async socket bootstrap
    void this.bootstrap(tenantId, channelId, generation).catch(async (err) => {
      this.logger.error(`Bootstrap failed for ${channelId}: ${err?.message || err}`);
      await this.markError(channelId, tenantId, err?.message || 'Falha ao iniciar sessão WhatsApp');
    });

    // Wait briefly for first QR or connected
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const current = this.sessions.get(channelId);
      if (current?.qrCode || current?.status === 'CONNECTED' || current?.status === 'ERROR') {
        break;
      }
    }

    return this.getState(channelId)!;
  }

  async stopSession(tenantId: string, channelId: string, logout = false) {
    const live = this.sessions.get(channelId);
    if (live) {
      live.intentionalClose = true;
      if (live.reconnectTimer) {
        clearTimeout(live.reconnectTimer);
        live.reconnectTimer = null;
      }
    }
    try {
      if (live?.sock) {
        if (logout) {
          await live.sock.logout().catch(() => undefined);
        } else {
          live.sock.end(undefined);
        }
      }
    } catch (err) {
      this.logger.warn(`Error stopping session ${channelId}: ${(err as Error).message}`);
    }

    this.sessions.delete(channelId);

    if (logout) {
      const authDir = this.authPath(tenantId, channelId);
      fs.rmSync(authDir, { recursive: true, force: true });
    }

    await this.prisma.channel.updateMany({
      where: { id: channelId, tenantId },
      data: { status: 'DISCONNECTED' },
    });

    await this.prisma.channelSession.updateMany({
      where: { channelId, tenantId, status: 'ACTIVE' },
      data: { status: 'DISCONNECTED' },
    });

    return {
      channelId,
      tenantId,
      status: 'DISCONNECTED' as const,
      qrCode: null,
      phoneNumber: null,
      error: null,
      updatedAt: new Date().toISOString(),
    };
  }

  private normalizeJid(to: string) {
    const raw = to.trim();
    if (raw.includes('@')) return raw;
    const digits = raw.replace(/\D/g, '');
    return `${digits}@s.whatsapp.net`;
  }

  /** Resolve WhatsApp JID from a contact record (1:1 or group). */
  resolveContactJid(contact: {
    phone?: string | null;
    metadata?: unknown;
  }): string | null {
    const meta = (contact.metadata || {}) as Record<string, unknown>;
    if (typeof meta.waJid === 'string' && meta.waJid.includes('@')) {
      return meta.waJid;
    }
    if (!contact.phone) return null;
    if (contact.phone.includes('@')) return contact.phone;
    if (meta.isGroup === true) {
      return `${contact.phone.replace(/\D/g, '')}@g.us`;
    }
    return this.normalizeJid(contact.phone);
  }

  /** Lightweight auto-sync on connect — groups only, no socket restart. */
  private async syncGroupsOnly(tenantId: string, channelId: string) {
    const live = this.sessions.get(channelId);
    if (!live?.sock || live.status !== 'CONNECTED') return;
    try {
      const participating = await live.sock.groupFetchAllParticipating();
      for (const [jid, meta] of Object.entries(participating || {})) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = meta as any;
        await this.ensureChatConversation(tenantId, channelId, {
          jid,
          name: g?.subject || 'Grupo WhatsApp',
          isGroup: true,
          preview: 'Grupo sincronizado',
          fetchAvatar: true,
        });
      }
    } catch (err) {
      this.logger.warn(`syncGroupsOnly failed: ${(err as Error).message}`);
    }
  }

  async syncChats(tenantId: string, channelId: string) {
    await this.ensureConnected(tenantId, channelId);
    let live = this.sessions.get(channelId);
    if (live && !live.chatCache) live.chatCache = new Map();
    if (live && !live.contactCache) live.contactCache = new Map();
    if (live && !live.avatarTried) live.avatarTried = new Set();

    // Give history events a short moment if cache is still empty (no socket restart —
    // restarting caused reconnect storms / timeouts)
    if ((live?.chatCache?.size || 0) < 3) {
      this.logger.log(
        `Waiting briefly for WhatsApp history (${live?.chatCache?.size || 0} chats cached)…`,
      );
      await new Promise((r) => setTimeout(r, 8_000));
      live = this.sessions.get(channelId);
    }

    await this.ensureConnected(tenantId, channelId);
    const sock = this.requireSocket(channelId);

    // Reload disk cache after restart
    try {
      const cachePath = path.join(this.authPath(tenantId, channelId), 'chats-cache.json');
      if (fs.existsSync(cachePath)) {
        const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as {
          chats?: Array<{ id: string; name?: string; conversationTimestamp?: number }>;
          contacts?: Array<{ id: string; name?: string }>;
        };
        for (const chat of raw.chats || []) {
          if (chat?.id) {
            this.rememberChat(channelId, chat.id, chat.name, chat.conversationTimestamp);
          }
        }
        for (const c of raw.contacts || []) {
          if (c?.id) this.rememberContact(channelId, c.id, c.name);
        }
      }
    } catch {
      // ignore
    }

    let groups = 0;
    let directs = 0;
    const seen = new Set<string>();

    const upsert = async (
      jid: string,
      name: string,
      isGroup: boolean,
      preview?: string,
    ) => {
      if (!jid || jid === 'status@broadcast' || seen.has(jid)) return;
      // skip newsletters / broadcast lists
      if (jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) return;
      seen.add(jid);
      await this.ensureChatConversation(tenantId, channelId, {
        jid,
        name,
        isGroup,
        preview: preview || (isGroup ? 'Grupo sincronizado' : 'Conversa sincronizada'),
        fetchAvatar: true,
      });
      if (isGroup) groups += 1;
      else directs += 1;
    };

    // 1) Groups
    try {
      const participating = await sock.groupFetchAllParticipating();
      for (const [jid, meta] of Object.entries(participating || {})) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = meta as any;
        await upsert(jid, g?.subject || 'Grupo WhatsApp', true, 'Grupo sincronizado');
      }
    } catch (err) {
      this.logger.warn(
        `groupFetchAllParticipating failed: ${(err as Error).message}`,
      );
    }

    // 2) Cached chats from history / upserts (includes 1:1)
    if (live?.chatCache) {
      for (const chat of live.chatCache.values()) {
        const jid = chat.id;
        const isGroup = jid.endsWith('@g.us');
        const name =
          chat.name ||
          live.contactCache?.get(jid) ||
          jid.replace(/@.*/, '');
        await upsert(jid, name, isGroup);
      }
    }

    // 3) Cached contacts without a chat entry yet → still create conversation
    if (live?.contactCache) {
      for (const [jid, name] of live.contactCache.entries()) {
        if (jid.endsWith('@g.us') || jid === 'status@broadcast') continue;
        if (!jid.includes('@s.whatsapp.net') && !jid.includes('@lid')) continue;
        await upsert(jid, name || jid.replace(/@.*/, ''), false, 'Contato sincronizado');
      }
    }

    // 4) Baileys in-memory store if present
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const storeChats: any[] = sock.store?.chats
        ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Array.from((sock.store.chats as Map<string, any>).values())
        : [];
      for (const chat of storeChats) {
        const jid = chat.id || chat.jid;
        if (!jid) continue;
        const isGroup = String(jid).endsWith('@g.us');
        await upsert(
          jid,
          chat.name || chat.subject || jid.replace(/@.*/, ''),
          isGroup,
        );
      }
    } catch (err) {
      this.logger.warn(`chat store sync failed: ${(err as Error).message}`);
    }

    this.logger.log(
      `Sync chats ${channelId}: ${directs} diretas, ${groups} grupos (total ${seen.size})`,
    );

    // Persist cache so next sync works even before history arrives again
    try {
      const cachePath = path.join(this.authPath(tenantId, channelId), 'chats-cache.json');
      const payload = {
        chats: Array.from(live?.chatCache?.values() || []),
        contacts: Array.from(live?.contactCache?.entries() || []).map(([id, name]) => ({
          id,
          name,
        })),
        updatedAt: new Date().toISOString(),
      };
      fs.writeFileSync(cachePath, JSON.stringify(payload, null, 2), 'utf8');
    } catch (err) {
      this.logger.warn(`Failed to persist chats-cache: ${(err as Error).message}`);
    }

    return { groups, chats: directs, total: seen.size };
  }

  /**
   * Upsert 1:1 WhatsApp contacts (name + number).
   * Resolves modern @lid chats to phone numbers via auth lid-mapping files
   * and live signalRepository when the socket is up. Always imports registered
   * 1:1 chats/contacts (not groups), even if the number is still pending.
   */
  async syncContacts(tenantId: string, channelId?: string) {
    const channels = await this.prisma.channel.findMany({
      where: {
        tenantId,
        type: 'WHATSAPP',
        provider: { in: ['ALURICHAT', 'MOCK'] },
        ...(channelId ? { id: channelId } : {}),
      },
      select: { id: true, name: true, status: true },
    });

    let upserted = 0;
    let scanned = 0;
    let resolvedLids = 0;
    let pendingNumbers = 0;

    for (const ch of channels) {
      const live = this.sessions.get(ch.id);
      /** phone digits → display name */
      const byPhone = new Map<string, string>();
      /** lid jid → name (unresolved until mapped) */
      const byLid = new Map<string, string>();
      const nameByLid = new Map<string, string>();
      const pendingLids = new Set<string>();

      const rememberName = (key: string | undefined, name?: string) => {
        if (!key || !name) return;
        const clean = name.trim();
        if (!clean || clean.includes('@')) return;
        if (key.endsWith('@lid') || key.includes('@lid')) {
          const user = key.replace(/@.*/, '');
          nameByLid.set(key, clean);
          nameByLid.set(user, clean);
        }
      };

      const addPhone = (rawDigits: string, name?: string) => {
        const phone = rawDigits.replace(/\D/g, '');
        if (phone.length < 8 || phone.length > 15 || phone === '0') return;
        const prev = byPhone.get(phone);
        const label =
          name &&
          name.trim() &&
          !name.includes('@') &&
          name.replace(/\D/g, '') !== phone
            ? name.trim()
            : prev && prev.replace(/\D/g, '') !== phone
              ? prev
              : phone;
        byPhone.set(phone, label);
      };

      const noteJid = (jid?: string | null, name?: string | null) => {
        if (!jid || jid === 'status@broadcast') return;
        if (
          jid.endsWith('@g.us') ||
          jid.endsWith('@broadcast') ||
          jid.endsWith('@newsletter')
        ) {
          return;
        }
        rememberName(jid, name || undefined);
        if (jid.endsWith('@s.whatsapp.net') && !jid.includes('@lid')) {
          addPhone(jid.replace(/@.*/, ''), name || undefined);
          return;
        }
        if (jid.endsWith('@lid')) {
          pendingLids.add(jid);
          byLid.set(
            jid,
            (name && !name.includes('@') ? name : null) ||
              nameByLid.get(jid) ||
              nameByLid.get(jid.replace(/@.*/, '')) ||
              jid.replace(/@.*/, ''),
          );
        }
      };

      // 1) Names + JIDs from caches
      try {
        const cachePath = path.join(
          this.authPath(tenantId, ch.id),
          'chats-cache.json',
        );
        if (fs.existsSync(cachePath)) {
          const raw = JSON.parse(fs.readFileSync(cachePath, 'utf8')) as {
            chats?: Array<{ id: string; name?: string }>;
            contacts?: Array<{ id: string; name?: string }>;
          };
          for (const c of raw.contacts || []) noteJid(c?.id, c?.name);
          for (const chat of raw.chats || []) noteJid(chat?.id, chat?.name);
        }
      } catch {
        // ignore
      }

      if (live?.contactCache) {
        for (const [jid, name] of live.contactCache.entries()) {
          noteJid(jid, name);
        }
      }
      if (live?.chatCache) {
        for (const chat of live.chatCache.values()) {
          noteJid(chat.id, chat.name);
        }
      }

      const conversations = await this.prisma.conversation.findMany({
        where: { tenantId, channelId: ch.id },
        include: { contact: true },
        take: 8000,
      });
      for (const conv of conversations) {
        const meta = (conv.contact?.metadata || {}) as Record<string, unknown>;
        const jid =
          (typeof meta.waJid === 'string' && meta.waJid) ||
          (conv.contact?.phone?.includes('@') ? conv.contact.phone : null);
        noteJid(jid, conv.contact?.name);
        if (conv.contact?.phone && !conv.contact.phone.includes('@')) {
          addPhone(conv.contact.phone, conv.contact.name || undefined);
        }
      }

      // Existing DB contacts for this tenant that look like WA (normalize / resolve)
      const existingWa = await this.prisma.contact.findMany({
        where: {
          tenantId,
          OR: [
            { source: 'whatsapp' },
            { phone: { contains: '@' } },
            { metadata: { path: ['channelId'], equals: ch.id } },
          ],
        },
        take: 8000,
      });
      for (const c of existingWa) {
        const meta = (c.metadata || {}) as Record<string, unknown>;
        noteJid(
          typeof meta.waJid === 'string' ? meta.waJid : c.phone,
          c.name,
        );
        if (c.phone && !c.phone.includes('@')) {
          addPhone(c.phone, c.name || undefined);
        }
      }

      // 2) Auth-dir LID↔PN mappings
      try {
        const authDir = this.authPath(tenantId, ch.id);
        if (fs.existsSync(authDir)) {
          for (const file of fs.readdirSync(authDir)) {
            if (!file.startsWith('lid-mapping-') || !file.endsWith('.json')) {
              continue;
            }
            const stem = file.slice('lid-mapping-'.length, -'.json'.length);
            try {
              const raw = fs.readFileSync(path.join(authDir, file), 'utf8').trim();
              const value = JSON.parse(raw) as unknown;
              const mapped =
                typeof value === 'string'
                  ? value
                  : value &&
                      typeof value === 'object' &&
                      'id' in (value as object)
                    ? String((value as { id: string }).id)
                    : null;
              if (stem.endsWith('_reverse')) {
                const lidUser = stem.replace(/_reverse$/, '');
                const digits = String(mapped || '').replace(/\D/g, '');
                if (digits.length >= 8 && digits.length <= 15) {
                  addPhone(
                    digits,
                    nameByLid.get(lidUser) || nameByLid.get(`${lidUser}@lid`),
                  );
                  resolvedLids++;
                  pendingLids.delete(`${lidUser}@lid`);
                  byLid.delete(`${lidUser}@lid`);
                }
              } else {
                const digits = stem.replace(/\D/g, '');
                if (digits.length >= 8 && digits.length <= 15) {
                  addPhone(
                    digits,
                    mapped
                      ? nameByLid.get(String(mapped)) ||
                          nameByLid.get(`${mapped}@lid`)
                      : undefined,
                  );
                }
              }
            } catch {
              // skip bad mapping file
            }
          }
        }
      } catch (err) {
        this.logger.warn(
          `syncContacts: lid-mapping scan failed for ${ch.id}: ${(err as Error).message}`,
        );
      }

      // 3) Live socket resolve remaining LIDs
      const lidMapping = live?.sock?.signalRepository?.lidMapping;
      if (lidMapping && pendingLids.size > 0) {
        const lids = Array.from(pendingLids);
        const chunkSize = 40;
        for (let i = 0; i < lids.length; i += chunkSize) {
          const chunk = lids.slice(i, i + chunkSize);
          try {
            let pairs: Array<{ lid: string; pn: string }> | null = null;
            if (typeof lidMapping.getPNsForLIDs === 'function') {
              pairs = await lidMapping.getPNsForLIDs(chunk);
            } else {
              const rows = await Promise.all(
                chunk.map(async (lid: string) => {
                  const pn = await lidMapping.getPNForLID(lid);
                  return pn ? { lid, pn: String(pn) } : null;
                }),
              );
              pairs = rows.filter(
                (
                  r: { lid: string; pn: string } | null,
                ): r is { lid: string; pn: string } => Boolean(r),
              );
            }
            for (const pair of pairs || []) {
              if (!pair?.pn) continue;
              const digits = String(pair.pn)
                .replace(/@.*/, '')
                .replace(/\D/g, '');
              const lidUser = String(pair.lid || '').replace(/@.*/, '');
              const name =
                nameByLid.get(pair.lid) ||
                nameByLid.get(lidUser) ||
                nameByLid.get(`${lidUser}@lid`) ||
                byLid.get(pair.lid);
              addPhone(digits, name);
              resolvedLids++;
              pendingLids.delete(pair.lid);
              byLid.delete(pair.lid);
            }
          } catch (err) {
            this.logger.warn(
              `syncContacts: getPNsForLIDs failed: ${(err as Error).message}`,
            );
          }
        }
      }

      scanned += byPhone.size + byLid.size;

      const upsertOne = async (opts: {
        phone: string;
        name: string;
        waJid: string;
        pendingNumber?: boolean;
      }) => {
        const { phone, name, waJid, pendingNumber } = opts;
        const existing = await this.prisma.contact.findFirst({
          where: {
            tenantId,
            OR: [
              { phone },
              { phone: waJid },
              { phone: `+${phone}` },
              ...(phone.length >= 8
                ? [{ phone: `${phone}@s.whatsapp.net` }]
                : []),
            ],
          },
        });

        const dupes = await this.prisma.contact.findMany({
          where: {
            tenantId,
            id: existing ? { not: existing.id } : undefined,
            OR: [
              { phone: waJid },
              ...(phone.includes('@')
                ? []
                : [{ phone: `${phone}@s.whatsapp.net` }]),
            ],
          },
          take: 8,
        });
        for (const dupe of dupes) {
          if (dupe.id === existing?.id) continue;
          await this.prisma.contact
            .delete({ where: { id: dupe.id } })
            .catch(() => undefined);
        }

        if (existing) {
          const prev = (existing.metadata || {}) as Record<string, unknown>;
          const shouldRename =
            !existing.name ||
            existing.name === phone ||
            existing.name === waJid ||
            existing.name.replace(/\D/g, '') === phone.replace(/\D/g, '');
          await this.prisma.contact.update({
            where: { id: existing.id },
            data: {
              phone,
              name: shouldRename ? name : existing.name,
              source: existing.source || 'whatsapp',
              metadata: {
                ...prev,
                waJid,
                isGroup: false,
                channelId: ch.id,
                pendingNumber: Boolean(pendingNumber),
                syncedAt: new Date().toISOString(),
              },
            },
          });
        } else {
          await this.prisma.contact.create({
            data: {
              tenantId,
              name,
              phone,
              source: 'whatsapp',
              metadata: {
                waJid,
                isGroup: false,
                channelId: ch.id,
                pendingNumber: Boolean(pendingNumber),
                syncedAt: new Date().toISOString(),
              },
            },
          });
        }
        upserted++;
      };

      for (const [digits, rawName] of byPhone.entries()) {
        const name =
          rawName && rawName !== digits && !rawName.includes('@')
            ? rawName
            : digits;
        await upsertOne({
          phone: digits,
          name,
          waJid: `${digits}@s.whatsapp.net`,
          pendingNumber: false,
        });
      }

      // Keep unresolved LID contacts visible (name + WhatsApp id until number resolves)
      for (const [lid, rawName] of byLid.entries()) {
        const lidUser = lid.replace(/@.*/, '');
        const nice =
          rawName &&
          !rawName.includes('@') &&
          rawName !== lidUser &&
          rawName.replace(/\D/g, '') !== lidUser
            ? rawName
            : nameByLid.get(lid) ||
              nameByLid.get(lidUser) ||
              'Contacto WhatsApp';
        pendingNumbers++;
        await upsertOne({
          phone: lid,
          name: nice,
          waJid: lid,
          pendingNumber: true,
        });
      }
    }

    this.logger.log(
      `syncContacts tenant=${tenantId}: scanned=${scanned}, upserted=${upserted}, resolvedLids≈${resolvedLids}, pending=${pendingNumbers}, channels=${channels.length}`,
    );
    return {
      channels: channels.length,
      scanned,
      upserted,
      resolvedLids,
      pendingNumbers,
    };
  }

  async ensureChatConversation(
    tenantId: string,
    channelId: string,
    opts: {
      jid: string;
      name: string;
      isGroup?: boolean;
      preview?: string;
      avatarUrl?: string | null;
      fetchAvatar?: boolean;
    },
  ) {
    const isGroup = opts.isGroup ?? opts.jid.endsWith('@g.us');
    const phoneKey = opts.jid;
    let avatarUrl = opts.avatarUrl ?? null;

    if (opts.fetchAvatar && !avatarUrl) {
      avatarUrl = await this.fetchAvatarUrl(channelId, opts.jid);
    }

    let contact = await this.prisma.contact.findFirst({
      where: { tenantId, phone: phoneKey },
    });
    if (!contact) {
      contact = await this.prisma.contact.create({
        data: {
          tenantId,
          name: opts.name || phoneKey.replace(/@.*/, ''),
          phone: phoneKey,
          source: 'whatsapp',
          metadata: {
            waJid: opts.jid,
            isGroup,
            channelId,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
        },
      });
    } else {
      const prev = (contact.metadata || {}) as Record<string, unknown>;
      const nextName =
        opts.name &&
        opts.name !== phoneKey.replace(/@.*/, '') &&
        (contact.name === phoneKey.replace(/@.*/, '') ||
          contact.name === phoneKey ||
          !contact.name)
          ? opts.name
          : contact.name;
      contact = await this.prisma.contact.update({
        where: { id: contact.id },
        data: {
          name: nextName,
          metadata: {
            ...prev,
            waJid: opts.jid,
            isGroup,
            channelId,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
        },
      });
    }

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        channelId,
        contactId: contact.id,
        status: { in: ['OPEN', 'PENDING', 'ASSIGNED', 'SNOOZED'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      // Also reopen closed ones by finding any conversation for this contact+channel
      conversation = await this.prisma.conversation.findFirst({
        where: { tenantId, channelId, contactId: contact.id },
        orderBy: { updatedAt: 'desc' },
      });
    }

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          channelId,
          contactId: contact.id,
          status: 'PENDING',
          priority: 'NORMAL',
          subject: isGroup ? opts.name : undefined,
          lastMessageAt: new Date(),
          lastMessagePreview: opts.preview || (isGroup ? 'Grupo' : 'Conversa'),
          unreadCount: 0,
          slaDueAt: new Date(Date.now() + 30 * 60_000),
          metadata: {
            waJid: opts.jid,
            isGroup,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
        },
      });
    } else {
      const prevMeta = (conversation.metadata || {}) as Record<string, unknown>;
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          subject: isGroup ? opts.name || conversation.subject : conversation.subject,
          metadata: {
            ...prevMeta,
            waJid: opts.jid,
            isGroup,
            ...(avatarUrl ? { avatarUrl } : {}),
          },
        },
      });
    }

    return conversation;
  }

  private async clearProcessedHistory(tenantId: string, channelId: string) {
    try {
      const credsPath = path.join(this.authPath(tenantId, channelId), 'creds.json');
      if (!fs.existsSync(credsPath)) return;
      const creds = JSON.parse(fs.readFileSync(credsPath, 'utf8')) as {
        processedHistoryMessages?: unknown[];
      };
      if (!creds.processedHistoryMessages?.length) return;
      creds.processedHistoryMessages = [];
      fs.writeFileSync(credsPath, JSON.stringify(creds, null, 2), 'utf8');
      this.logger.log(`Cleared processedHistoryMessages for ${channelId}`);
    } catch (err) {
      this.logger.warn(
        `clearProcessedHistory failed: ${(err as Error).message}`,
      );
    }
  }

  private async fetchAvatarUrl(channelId: string, jid: string): Promise<string | null> {
    const live = this.sessions.get(channelId);
    if (!live?.sock) return null;
    if (!live.avatarTried) live.avatarTried = new Set();
    if (live.avatarTried.has(jid)) {
      // already tried this session — read from DB if any
      return null;
    }
    live.avatarTried.add(jid);
    try {
      const url = await live.sock.profilePictureUrl(jid, 'image');
      return typeof url === 'string' ? url : null;
    } catch {
      return null;
    }
  }

  private rememberChat(
    channelId: string,
    jid: string,
    name?: string,
    conversationTimestamp?: number,
  ) {
    const live = this.sessions.get(channelId);
    if (!live || !jid) return;
    if (!live.chatCache) live.chatCache = new Map();
    const prev = live.chatCache.get(jid);
    live.chatCache.set(jid, {
      id: jid,
      name: name || prev?.name,
      conversationTimestamp:
        conversationTimestamp || prev?.conversationTimestamp,
    });
  }

  private rememberContact(channelId: string, jid: string, name?: string) {
    const live = this.sessions.get(channelId);
    if (!live || !jid || !name) return;
    if (!live.contactCache) live.contactCache = new Map();
    live.contactCache.set(jid, name);
  }

  private async ingestInbound(
    tenantId: string,
    channelId: string,
    opts: {
      jid: string;
      body: string;
      externalId?: string;
      pushName?: string | null;
      isGroup?: boolean;
    },
  ) {
    const isGroup = opts.isGroup ?? opts.jid.endsWith('@g.us');
    const name =
      opts.pushName ||
      (isGroup ? 'Grupo WhatsApp' : opts.jid.replace(/@.*/, ''));

    await this.ensureChatConversation(tenantId, channelId, {
      jid: opts.jid,
      name,
      isGroup,
      preview: opts.body.slice(0, 180),
      fetchAvatar: !isGroup,
    });

    const contact = await this.prisma.contact.findFirst({
      where: { tenantId, phone: opts.jid },
    });
    if (!contact) return;

    let conversation = await this.prisma.conversation.findFirst({
      where: {
        tenantId,
        channelId,
        contactId: contact.id,
        status: { in: ['OPEN', 'PENDING', 'ASSIGNED', 'SNOOZED'] },
      },
      orderBy: { updatedAt: 'desc' },
    });

    if (!conversation) {
      conversation = await this.prisma.conversation.create({
        data: {
          tenantId,
          channelId,
          contactId: contact.id,
          status: 'PENDING',
          priority: 'NORMAL',
          lastMessageAt: new Date(),
          lastMessagePreview: opts.body.slice(0, 180),
          unreadCount: 1,
          slaDueAt: new Date(Date.now() + 30 * 60_000),
          metadata: { waJid: opts.jid, isGroup },
        },
      });
    } else {
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: {
          status:
            conversation.status === 'CLOSED' || conversation.status === 'RESOLVED'
              ? 'PENDING'
              : conversation.status,
          lastMessageAt: new Date(),
          lastMessagePreview: opts.body.slice(0, 180),
          unreadCount: { increment: 1 },
        },
      });
    }

    await this.prisma.message.create({
      data: {
        tenantId,
        conversationId: conversation.id,
        direction: 'INBOUND',
        type: 'TEXT',
        status: 'DELIVERED',
        body: opts.body,
        externalId: opts.externalId,
        senderContactId: contact.id,
        sentAt: new Date(),
        deliveredAt: new Date(),
      },
    });

    this.events.emit('message.received', {
      tenantId,
      channelId,
      conversationId: conversation.id,
      contactId: contact.id,
    });
  }

  private extractMessageBody(message: Record<string, unknown> | null | undefined) {
    if (!message) return '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = message as any;
    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      (m.imageMessage ? '[Imagem]' : '') ||
      (m.videoMessage ? '[Vídeo]' : '') ||
      (m.audioMessage ? '[Áudio]' : '') ||
      (m.documentMessage ? `[Documento] ${m.documentMessage.fileName || ''}`.trim() : '') ||
      (m.stickerMessage ? '[Sticker]' : '') ||
      (m.contactMessage ? '[Contato]' : '') ||
      (m.locationMessage ? '[Localização]' : '') ||
      ''
    );
  }

  private async markError(channelId: string, tenantId: string, message: string) {
    const current = this.sessions.get(channelId);
    if (current) {
      current.status = 'ERROR';
      current.error = message;
      current.updatedAt = new Date().toISOString();
      current.starting = false;
    }
    await this.prisma.channel.updateMany({
      where: { id: channelId, tenantId },
      data: { status: 'ERROR' },
    });
  }

  private requireSocket(channelId: string) {
    const live = this.sessions.get(channelId);
    if (!live?.sock || live.status !== 'CONNECTED') {
      throw new Error('Instância WhatsApp não está conectada. Escaneie o QR Code primeiro.');
    }
    return live.sock;
  }

  async sendText(
    tenantId: string,
    channelId: string,
    to: string,
    message: string,
  ) {
    await this.ensureConnected(tenantId, channelId);
    const sock = this.requireSocket(channelId);
    const jid = this.normalizeJid(to);
    const result = await sock.sendMessage(jid, { text: message });
    return {
      externalId: result?.key?.id || `out_${Date.now()}`,
      status: 'SENT' as const,
      to: jid,
    };
  }

  async sendMedia(
    tenantId: string,
    channelId: string,
    to: string,
    opts: {
      url?: string;
      buffer?: Buffer;
      mimetype?: string;
      caption?: string;
      mediaType?: 'image' | 'audio' | 'document';
      fileName?: string;
      ptt?: boolean;
    },
  ) {
    await this.ensureConnected(tenantId, channelId);
    const sock = this.requireSocket(channelId);
    const jid = this.normalizeJid(to);
    const mediaType = opts.mediaType || 'image';
    const source = opts.buffer
      ? opts.buffer
      : opts.url
        ? { url: opts.url }
        : null;
    if (!source) {
      throw new Error('Informe a URL ou envie um arquivo');
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any;
    if (mediaType === 'audio') {
      payload = {
        audio: source,
        mimetype: opts.mimetype || 'audio/mpeg',
        ptt: Boolean(opts.ptt),
      };
    } else if (mediaType === 'document') {
      payload = {
        document: source,
        mimetype: opts.mimetype || 'application/octet-stream',
        fileName: opts.fileName || 'documento',
        caption: opts.caption,
      };
    } else {
      payload = {
        image: source,
        mimetype: opts.mimetype || 'image/jpeg',
        caption: opts.caption,
      };
    }
    const result = await sock.sendMessage(jid, payload);
    return {
      externalId: result?.key?.id || `out_${Date.now()}`,
      status: 'SENT' as const,
      to: jid,
      mediaType,
    };
  }

  async checkNumber(tenantId: string, channelId: string, number: string) {
    await this.ensureConnected(tenantId, channelId);
    const sock = this.requireSocket(channelId);
    const digits = number.replace(/\D/g, '');
    const results = await sock.onWhatsApp(digits);
    const first = Array.isArray(results) ? results[0] : results;
    return {
      number: digits,
      exists: Boolean(first?.exists),
      jid: first?.jid || null,
    };
  }

  private async notifySessionDown(
    tenantId: string,
    channelId: string,
    body: string,
  ) {
    try {
      const channel = await this.prisma.channel.findFirst({
        where: { id: channelId, tenantId },
        select: { name: true },
      });
      const owners = await this.prisma.membership.findMany({
        where: {
          tenantId,
          status: 'ACTIVE',
          role: { in: ['OWNER', 'ADMIN'] },
        },
        select: { userId: true },
      });
      for (const m of owners) {
        await this.prisma.notification.create({
          data: {
            tenantId,
            userId: m.userId,
            type: 'whatsapp.session_down',
            title: channel?.name
              ? `WhatsApp: ${channel.name}`
              : 'Instância WhatsApp',
            body,
            data: { channelId },
            channel: 'IN_APP',
          },
        });
      }
      this.events.emit('whatsapp.disconnected', { tenantId, channelId, body });
    } catch (err) {
      this.logger.warn(
        `Failed to notify session down: ${(err as Error).message}`,
      );
    }
  }

  private authPath(tenantId: string, channelId: string) {
    return path.join(this.rootDir, tenantId, channelId);
  }

  private async bootstrap(
    tenantId: string,
    channelId: string,
    generation?: number,
  ) {
    const prev = this.bootstrapLocks.get(channelId) || Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>((r) => {
      release = r;
    });
    this.bootstrapLocks.set(
      channelId,
      prev.then(() => gate).catch(() => gate),
    );
    await prev.catch(() => undefined);
    try {
      await this.bootstrapLocked(tenantId, channelId, generation);
    } finally {
      release();
    }
  }

  private async bootstrapLocked(
    tenantId: string,
    channelId: string,
    generation?: number,
  ) {
    const baileys = await import('@whiskeysockets/baileys');
    const makeWASocket =
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (baileys as any).default?.default ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (baileys as any).default ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (baileys as any).makeWASocket;
    const {
      useMultiFileAuthState,
      DisconnectReason,
      fetchLatestBaileysVersion,
      makeCacheableSignalKeyStore,
      Browsers,
    } = baileys as typeof import('@whiskeysockets/baileys');

    const sessionBefore = this.sessions.get(channelId);
    const gen = generation ?? sessionBefore?.generation ?? 1;
    if (sessionBefore && generation != null && sessionBefore.generation !== generation) {
      this.logger.warn(`Skipping stale bootstrap for ${channelId} (gen ${generation})`);
      return;
    }

    if (sessionBefore?.sock) {
      sessionBefore.intentionalClose = true;
      try {
        sessionBefore.sock.end?.(undefined);
      } catch {
        // ignore
      }
      sessionBefore.sock = undefined;
      await new Promise((r) => setTimeout(r, 1000));
    }

    const authDir = this.authPath(tenantId, channelId);
    fs.mkdirSync(authDir, { recursive: true });

    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    let version: [number, number, number] = [2, 3000, 1025190524];
    try {
      const latest = await fetchLatestBaileysVersion();
      if (latest?.version?.length === 3 && latest.isLatest !== false) {
        version = latest.version as [number, number, number];
      } else if (latest?.version?.length === 3) {
        // fetch failed / stale — still prefer returned fallback over nothing
        version = latest.version as [number, number, number];
        this.logger.warn(
          `Using Baileys fallback WA version ${version.join('.')} (latest fetch unreliable)`,
        );
      }
    } catch (err) {
      this.logger.warn(
        `fetchLatestBaileysVersion failed, using pinned ${version.join('.')}: ${(err as Error).message}`,
      );
    }
    const isFreshPairing = !state.creds?.me?.id;
    this.logger.log(
      `Bootstrapping ${channelId} (gen=${gen}, paired=${!isFreshPairing}, wa=${version.join('.')})`,
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const silentLogger = {
      level: 'silent',
      child: () => silentLogger,
      trace: () => undefined,
      debug: () => undefined,
      info: () => undefined,
      warn: () => undefined,
      error: () => undefined,
      fatal: () => undefined,
    } as any;

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, silentLogger),
      },
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      // Fresh QR: allow history. Restore: skip (heavy sync often causes 408)
      shouldSyncHistoryMessage: () => isFreshPairing,
      markOnlineOnConnect: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      keepAliveIntervalMs: 25_000,
      retryRequestDelayMs: 500,
      getMessage: async () => undefined,
      logger: silentLogger,
    });

    const live = this.sessions.get(channelId);
    if (!live || (generation != null && live.generation !== generation)) {
      try {
        sock.end?.(undefined);
      } catch {
        // ignore
      }
      return;
    }
    live.sock = sock;
    live.starting = false;
    live.intentionalClose = false;
    if (!live.chatCache) live.chatCache = new Map();
    if (!live.contactCache) live.contactCache = new Map();
    if (!live.avatarTried) live.avatarTried = new Set();

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;
      const current = this.sessions.get(channelId);
      if (!current || current.generation !== gen) return;
      // Ignore events from a replaced socket
      if (current.sock && current.sock !== sock) return;

      if (qr) {
        try {
          const dataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            width: 320,
            color: { dark: '#0f172a', light: '#ffffff' },
          });
          current.qrCode = dataUrl;
          current.status = 'CONNECTING';
          current.updatedAt = new Date().toISOString();
          current.error = null; // clear "Sessão expirada" once a fresh QR is available
          current.reconnectAttempts = 0;

          await this.prisma.channelSession.create({
            data: {
              tenantId,
              channelId,
              status: 'ACTIVE',
              qrCode: dataUrl,
              sessionData: { engine: 'baileys', updatedAt: current.updatedAt },
            },
          });

          this.events.emit('whatsapp.qr', { tenantId, channelId, qrCode: dataUrl });
          this.logger.log(`QR ready for channel ${channelId}`);
        } catch (err) {
          this.logger.error(`QR encode failed: ${(err as Error).message}`);
        }
      }

      if (connection === 'open') {
        const phone =
          sock.user?.id?.split(':')[0] ||
          sock.user?.id?.replace(/@.*/, '') ||
          null;
        current.status = 'CONNECTED';
        current.qrCode = null;
        current.phoneNumber = phone;
        current.updatedAt = new Date().toISOString();
        current.error = null;
        current.starting = false;
        current.reconnectAttempts = 0;

        await this.prisma.channel.update({
          where: { id: channelId },
          data: {
            status: 'CONNECTED',
            phoneNumber: phone,
            externalId: sock.user?.id || `baileys_${channelId}`,
            config: {
              engine: 'baileys',
              connectedAt: current.updatedAt,
            },
          },
        });

        await this.prisma.channelSession.updateMany({
          where: { channelId, tenantId, status: 'ACTIVE' },
          data: {
            status: 'ACTIVE',
            qrCode: null,
            sessionData: {
              engine: 'baileys',
              phoneNumber: phone,
              connectedAt: current.updatedAt,
            },
          },
        });

        this.events.emit('whatsapp.connected', { tenantId, channelId, phoneNumber: phone });
        this.logger.log(`WhatsApp connected for ${channelId} (${phone})`);
        // Light sync only (groups) — full sync is user-triggered to avoid reconnect loops
        void this.syncGroupsOnly(tenantId, channelId).catch((err) =>
          this.logger.warn(`Auto group sync failed: ${err?.message || err}`),
        );
      }

      if (connection === 'close') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const loggedOut = statusCode === DisconnectReason.loggedOut;

        if (current.intentionalClose || current.generation !== gen) {
          this.logger.log(
            `Ignoring close for ${channelId} (intentional/stale gen=${gen})`,
          );
          return;
        }

        if (loggedOut) {
          await this.notifySessionDown(tenantId, channelId, 'Sessão WhatsApp desligada (logout)');
          await this.stopSession(tenantId, channelId, true);
          return;
        }

        current.status = 'CONNECTING';
        current.updatedAt = new Date().toISOString();
        current.starting = false;
        current.sock = undefined;
        const attempts = (current.reconnectAttempts || 0) + 1;
        current.reconnectAttempts = attempts;

        // Notify owners once when a previously connected session drops
        if (attempts === 1) {
          void this.notifySessionDown(
            tenantId,
            channelId,
            'Instância WhatsApp caiu — a tentar reconectar…',
          );
        }

        const paired = this.isPairedAuth(tenantId, channelId);

        // Soft repair once while still paired
        if (statusCode === 408 && paired && attempts === 2 && !current.authWipedOnce) {
          this.repairAuthDir(tenantId, channelId);
          try {
            const dir = this.authPath(tenantId, channelId);
            for (const f of fs.readdirSync(dir)) {
              if (
                f.startsWith('app-state-sync-key-') ||
                f.startsWith('app-state-sync-version-')
              ) {
                fs.unlinkSync(path.join(dir, f));
              }
            }
            this.logger.warn(
              `Purged app-state-sync keys for ${channelId} after repeated 408`,
            );
          } catch (err) {
            this.logger.warn(
              `Failed to purge app-state keys: ${(err as Error).message}`,
            );
          }
        }

        // Wipe paired auth at most ONCE, then wait for QR — never infinite wipe loops
        if (
          statusCode === 408 &&
          paired &&
          attempts >= 4 &&
          !current.authWipedOnce
        ) {
          this.logger.error(
            `Auth unrecoverable for ${channelId} after ${attempts}×408 — wiping once for fresh QR`,
          );
          this.wipeAuthKeepCache(tenantId, channelId);
          current.authWipedOnce = true;
          current.reconnectAttempts = 0;
          current.error =
            'Sessão expirada. Escaneie o novo QR Code para reconectar.';
          if (current.reconnectTimer) {
            clearTimeout(current.reconnectTimer);
            current.reconnectTimer = null;
          }
          const nextGen = (current.generation || gen) + 1;
          current.generation = nextGen;
          current.starting = true;
          current.status = 'CONNECTING';
          await this.prisma.channel.updateMany({
            where: { id: channelId, tenantId },
            data: { status: 'CONNECTING' },
          });
          void this.bootstrap(tenantId, channelId, nextGen).catch((err) =>
            this.logger.error(`QR rebootstrap failed: ${err?.message || err}`),
          );
          return;
        }

        // Unpaired / already wiped: keep trying a few times for QR, then stop
        const maxAttempts = paired && !current.authWipedOnce ? 8 : 5;
        if (attempts > maxAttempts) {
          this.logger.error(
            `Giving up reconnect for ${channelId} after ${attempts} attempts (paired=${paired})`,
          );
          await this.markError(
            channelId,
            tenantId,
            current.authWipedOnce || !paired
              ? 'Não foi possível gerar o QR. Clique em Conectar novamente (verifique a internet do servidor).'
              : 'Sessão instável. Vá a Instâncias → Conectar (ou Desconectar e escaneie o QR novamente).',
          );
          return;
        }

        const delay = Math.min(25_000, 2500 * attempts);
        this.logger.warn(
          `Connection closed for ${channelId} (code=${statusCode}, paired=${paired}). Reconnecting in ${delay}ms (try ${attempts})…`,
        );

        if (current.reconnectTimer) {
          clearTimeout(current.reconnectTimer);
        }
        const nextGen = (current.generation || gen) + 1;
        current.generation = nextGen;
        current.reconnectTimer = setTimeout(() => {
          const still = this.sessions.get(channelId);
          if (!still || still.intentionalClose) return;
          if (still.generation !== nextGen) return;
          still.starting = true;
          void this.bootstrap(tenantId, channelId, nextGen).catch((err) =>
            this.logger.error(`Reconnect failed: ${err?.message || err}`),
          );
        }, delay);
      }
    });

    sock.ev.on('chats.upsert', async (chats) => {
      try {
        for (const chat of chats || []) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const c = chat as any;
          const jid = c.id as string | undefined;
          if (!jid || jid === 'status@broadcast') continue;
          const isGroup = jid.endsWith('@g.us');
          const name = c.name || c.subject || jid.replace(/@.*/, '');
          this.rememberChat(channelId, jid, name, Number(c.conversationTimestamp) || undefined);
          await this.ensureChatConversation(tenantId, channelId, {
            jid,
            name,
            isGroup,
            preview: 'Conversa sincronizada',
            fetchAvatar: !isGroup,
          });
        }
      } catch (err) {
        this.logger.warn(`chats.upsert handler: ${(err as Error).message}`);
      }
    });

    sock.ev.on('chats.update', (updates) => {
      for (const u of updates || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const c = u as any;
        if (c.id) {
          this.rememberChat(
            channelId,
            c.id,
            c.name || c.subject,
            Number(c.conversationTimestamp) || undefined,
          );
        }
      }
    });

    sock.ev.on('contacts.upsert', (contacts) => {
      for (const c of contacts || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ct = c as any;
        const jid = ct.id as string | undefined;
        if (!jid) continue;
        const name =
          ct.notify || ct.name || ct.verifiedName || ct.pushname || undefined;
        this.rememberContact(channelId, jid, name);
      }
    });

    sock.ev.on('contacts.update', (updates) => {
      for (const c of updates || []) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ct = c as any;
        if (!ct.id) continue;
        const name =
          ct.notify || ct.name || ct.verifiedName || ct.pushname || undefined;
        this.rememberContact(channelId, ct.id, name);
      }
    });

    // Full history sync brings 1:1 chats + contacts (not only groups)
    sock.ev.on('messaging-history.set', async (data) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const payload = data as any;
        const chats = payload.chats || [];
        const contacts = payload.contacts || [];
        const messages = payload.messages || [];

        for (const c of contacts) {
          const jid = c.id as string | undefined;
          if (!jid) continue;
          const name =
            c.notify || c.name || c.verifiedName || c.pushname || undefined;
          this.rememberContact(channelId, jid, name);
        }

        for (const chat of chats) {
          const jid = chat.id as string | undefined;
          if (!jid || jid === 'status@broadcast') continue;
          const isGroup = jid.endsWith('@g.us');
          const live = this.sessions.get(channelId);
          const name =
            chat.name ||
            chat.subject ||
            live?.contactCache?.get(jid) ||
            jid.replace(/@.*/, '');
          this.rememberChat(
            channelId,
            jid,
            name,
            Number(chat.conversationTimestamp) || undefined,
          );
          await this.ensureChatConversation(tenantId, channelId, {
            jid,
            name,
            isGroup,
            preview: 'Histórico sincronizado',
            fetchAvatar: true,
          });
        }

        // Messages reveal chats that may be missing from the chats array
        for (const msg of messages) {
          const jid = msg?.key?.remoteJid as string | undefined;
          if (!jid || jid === 'status@broadcast') continue;
          if (jid.endsWith('@newsletter') || jid.endsWith('@broadcast')) continue;
          const isGroup = jid.endsWith('@g.us');
          const live = this.sessions.get(channelId);
          const name =
            live?.contactCache?.get(jid) ||
            msg.pushName ||
            jid.replace(/@.*/, '');
          this.rememberChat(channelId, jid, name);
          await this.ensureChatConversation(tenantId, channelId, {
            jid,
            name,
            isGroup,
            preview: 'Histórico sincronizado',
            fetchAvatar: false,
          });
        }

        this.logger.log(
          `History sync for ${channelId}: ${chats.length} chats, ${contacts.length} contacts, ${messages.length} msgs`,
        );

        // Persist immediately so Sync button picks up 1:1 chats
        try {
          const liveNow = this.sessions.get(channelId);
          const cachePath = path.join(
            this.authPath(tenantId, channelId),
            'chats-cache.json',
          );
          fs.writeFileSync(
            cachePath,
            JSON.stringify(
              {
                chats: Array.from(liveNow?.chatCache?.values() || []),
                contacts: Array.from(liveNow?.contactCache?.entries() || []).map(
                  ([id, name]) => ({ id, name }),
                ),
                updatedAt: new Date().toISOString(),
              },
              null,
              2,
            ),
            'utf8',
          );
        } catch {
          // ignore
        }
      } catch (err) {
        this.logger.warn(
          `messaging-history.set handler: ${(err as Error).message}`,
        );
      }
    });

    // Ingest inbound messages into conversations (1:1 + groups)
    sock.ev.on('messages.upsert', async (payload) => {
      try {
        const messages = payload.messages || [];
        for (const msg of messages) {
          const remoteJid = msg.key.remoteJid;
          if (!remoteJid || remoteJid === 'status@broadcast') continue;
          if (remoteJid.endsWith('@newsletter') || remoteJid.endsWith('@broadcast')) {
            continue;
          }
          const isGroup = remoteJid.endsWith('@g.us');
          if (msg.pushName) {
            this.rememberContact(channelId, remoteJid, msg.pushName);
          }
          this.rememberChat(channelId, remoteJid, msg.pushName || undefined);

          // Outbound from phone still creates/updates the chat entry (1:1 discovery)
          if (msg.key.fromMe) {
            await this.ensureChatConversation(tenantId, channelId, {
              jid: remoteJid,
              name:
                this.sessions.get(channelId)?.contactCache?.get(remoteJid) ||
                remoteJid.replace(/@.*/, ''),
              isGroup,
              preview: 'Conversa ativa',
              fetchAvatar: !isGroup,
            });
            continue;
          }

          if (!msg.message) continue;
          const body = this.extractMessageBody(msg.message as Record<string, unknown>);
          if (!body) continue;
          await this.ingestInbound(tenantId, channelId, {
            jid: remoteJid,
            body,
            externalId: msg.key.id || undefined,
            pushName: msg.pushName,
            isGroup,
          });
        }
      } catch (err) {
        this.logger.error(`Inbound handler error: ${(err as Error).message}`);
      }
    });
  }

  async onModuleDestroy() {
    for (const [channelId, live] of this.sessions.entries()) {
      live.intentionalClose = true;
      if (live.reconnectTimer) clearTimeout(live.reconnectTimer);
      try {
        live.sock?.end?.(undefined);
      } catch {
        // ignore
      }
      this.sessions.delete(channelId);
    }
  }
}
