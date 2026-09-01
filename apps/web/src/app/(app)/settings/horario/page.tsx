'use client';

import { AppTopbar } from '@/components/layout/AppTopbar';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { api } from '@/lib/api';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

const DOW_LABELS = [
  'Domingo',
  'Segunda',
  'Terça',
  'Quarta',
  'Quinta',
  'Sexta',
  'Sábado',
];

type DayRow = { dow: number; start: string; end: string; enabled: boolean };

function defaultDays(): DayRow[] {
  return Array.from({ length: 7 }, (_, dow) => ({
    dow,
    start: '09:00',
    end: '18:00',
    enabled: dow >= 1 && dow <= 5,
  }));
}

export default function SettingsHorarioPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [timezone, setTimezone] = useState('Africa/Luanda');
  const [awayMessage, setAwayMessage] = useState('');
  const [days, setDays] = useState<DayRow[]>(defaultDays);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getBusinessHours();
      setEnabled(Boolean(data.enabled));
      setTimezone(data.timezone || 'Africa/Luanda');
      setAwayMessage(data.awayMessage || '');
      const base = defaultDays();
      for (const d of data.days || []) {
        const idx = base.findIndex((b) => b.dow === d.dow);
        if (idx >= 0) {
          base[idx] = {
            dow: d.dow,
            start: d.start || '09:00',
            end: d.end || '18:00',
            enabled: true,
          };
        }
      }
      setDays(base);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao carregar horário');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateBusinessHours({
        enabled,
        timezone: timezone.trim() || 'Africa/Luanda',
        awayMessage: awayMessage.trim(),
        days: days
          .filter((d) => d.enabled)
          .map(({ dow, start, end }) => ({ dow, start, end })),
      });
      toast.success('Horário comercial guardado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Falha ao guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <AppTopbar
        title="Horário comercial"
        subtitle="Defina quando a equipa está disponível"
      />
      <div className="flex-1 overflow-auto p-5 md:p-8">
        {loading ? (
          <div className="mx-auto max-w-2xl space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <form onSubmit={onSave} className="mx-auto max-w-2xl space-y-5">
            <label className="flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-surface-border"
              />
              Ativar resposta fora de horário
            </label>

            <Input
              label="Fuso horário"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="Africa/Luanda"
            />

            <div>
              <label className="mb-1.5 block text-xs font-medium text-ink-muted">
                Mensagem de ausência
              </label>
              <textarea
                value={awayMessage}
                onChange={(e) => setAwayMessage(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-surface-border bg-surface-raised px-3 py-2 text-sm text-ink outline-none focus:border-brand/50"
              />
            </div>

            <div className="space-y-2 rounded-xl border border-surface-border p-4">
              <p className="text-sm font-medium text-ink">Dias da semana</p>
              {days.map((d, i) => (
                <div
                  key={d.dow}
                  className="flex flex-wrap items-center gap-2 border-t border-surface-border/60 py-2 first:border-0"
                >
                  <label className="flex w-28 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={(e) => {
                        const next = [...days];
                        next[i] = { ...d, enabled: e.target.checked };
                        setDays(next);
                      }}
                    />
                    {DOW_LABELS[d.dow]}
                  </label>
                  <input
                    type="time"
                    value={d.start}
                    disabled={!d.enabled}
                    onChange={(e) => {
                      const next = [...days];
                      next[i] = { ...d, start: e.target.value };
                      setDays(next);
                    }}
                    className="h-9 rounded-lg border border-surface-border bg-surface-raised px-2 text-sm text-ink disabled:opacity-40"
                  />
                  <span className="text-ink-faint">até</span>
                  <input
                    type="time"
                    value={d.end}
                    disabled={!d.enabled}
                    onChange={(e) => {
                      const next = [...days];
                      next[i] = { ...d, end: e.target.value };
                      setDays(next);
                    }}
                    className="h-9 rounded-lg border border-surface-border bg-surface-raised px-2 text-sm text-ink disabled:opacity-40"
                  />
                </div>
              ))}
            </div>

            <Button type="submit" loading={saving}>
              Guardar horário
            </Button>
          </form>
        )}
      </div>
    </>
  );
}
