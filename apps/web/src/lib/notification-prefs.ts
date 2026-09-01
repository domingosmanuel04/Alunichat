const PREFS_KEY = 'alurichat.notificationPrefs';

export type NotificationPrefs = {
  enabled: boolean;
  sound: boolean;
};

export function readNotificationPrefs(): NotificationPrefs {
  if (typeof window === 'undefined') return { enabled: true, sound: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { enabled: true, sound: true };
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      enabled: parsed.enabled !== false,
      sound: parsed.sound !== false,
    };
  } catch {
    return { enabled: true, sound: true };
  }
}

export function writeNotificationPrefs(prefs: NotificationPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

let audioCtx: AudioContext | null = null;

function playBeep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.12);
  } catch {
    /* ignore */
  }
}

export function notifyIncomingMessage(opts: {
  title?: string;
  body?: string;
}) {
  const prefs = readNotificationPrefs();
  if (!prefs.enabled) return;

  if (prefs.sound) playBeep();

  if (typeof document !== 'undefined' && document.hidden) {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = `(1) ${base}`;
  }

  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification(opts.title || 'Nova mensagem', {
        body: opts.body || 'Tem uma nova mensagem no Chat',
        silent: true,
      });
    } catch {
      /* ignore */
    }
  }
}
