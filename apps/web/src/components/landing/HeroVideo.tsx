'use client';

import { useEffect, useRef } from 'react';

type Bubble = {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
  phase: number;
  outgoing: boolean;
  alpha: number;
  text: string;
};

type Particle = {
  x: number;
  y: number;
  r: number;
  vx: number;
  vy: number;
  a: number;
};

const TEXTS_IN = [
  'Olá! Quero o plano Pro',
  'Podem agendar uma demo?',
  'Quanto custa por mês?',
  'Tem integração WhatsApp?',
  'Preciso de automação 24/7',
];
const TEXTS_OUT = [
  'Claro — envio os detalhes.',
  'Sim, já agendei para si.',
  'A partir de 49.000 Kz/mês.',
  'Nativo e em tempo real.',
  'Fluxos + IA prontos.',
];

/**
 * Full-bleed cinematic “video” for the landing hero:
 * drifting WhatsApp-style bubbles, pulses and particles in brand navy→cyan.
 */
export function HeroVideo() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let t0 = performance.now();

    const bubbles: Bubble[] = [];
    const particles: Particle[] = [];

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawnBubble = (forceY?: number) => {
      const outgoing = Math.random() > 0.45;
      const text = outgoing
        ? TEXTS_OUT[Math.floor(Math.random() * TEXTS_OUT.length)]
        : TEXTS_IN[Math.floor(Math.random() * TEXTS_IN.length)];
      const bw = 140 + Math.random() * 120;
      const bh = 36 + Math.random() * 10;
      bubbles.push({
        x: outgoing ? w * 0.45 + Math.random() * w * 0.4 : Math.random() * w * 0.4,
        y: forceY ?? h + bh + Math.random() * 80,
        w: bw,
        h: bh,
        vx: (Math.random() - 0.5) * 0.15,
        vy: -(0.25 + Math.random() * 0.35),
        phase: Math.random() * Math.PI * 2,
        outgoing,
        alpha: 0,
        text,
      });
    };

    const init = () => {
      bubbles.length = 0;
      particles.length = 0;
      for (let i = 0; i < 10; i++) {
        spawnBubble(h * (0.15 + Math.random() * 0.75));
      }
      for (let i = 0; i < 48; i++) {
        particles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.6 + Math.random() * 1.8,
          vx: (Math.random() - 0.5) * 0.2,
          vy: -0.05 - Math.random() * 0.25,
          a: 0.15 + Math.random() * 0.45,
        });
      }
    };

    const roundRect = (
      x: number,
      y: number,
      rw: number,
      rh: number,
      r: number,
    ) => {
      const rr = Math.min(r, rw / 2, rh / 2);
      ctx.beginPath();
      ctx.moveTo(x + rr, y);
      ctx.arcTo(x + rw, y, x + rw, y + rh, rr);
      ctx.arcTo(x + rw, y + rh, x, y + rh, rr);
      ctx.arcTo(x, y + rh, x, y, rr);
      ctx.arcTo(x, y, x + rw, y, rr);
      ctx.closePath();
    };

    const draw = (now: number) => {
      const t = (now - t0) / 1000;
      ctx.clearRect(0, 0, w, h);

      // Brand atmosphere
      const g1 = ctx.createRadialGradient(
        w * 0.2,
        h * 0.15,
        0,
        w * 0.2,
        h * 0.15,
        w * 0.7,
      );
      g1.addColorStop(0, 'rgba(10, 47, 107, 0.55)');
      g1.addColorStop(1, 'rgba(10, 47, 107, 0)');
      ctx.fillStyle = g1;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(
        w * 0.85,
        h * 0.7,
        0,
        w * 0.85,
        h * 0.7,
        w * 0.55,
      );
      g2.addColorStop(0, 'rgba(34, 211, 238, 0.22)');
      g2.addColorStop(0.5, 'rgba(13, 148, 136, 0.12)');
      g2.addColorStop(1, 'rgba(13, 148, 136, 0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      // Soft grid like signal mesh
      ctx.save();
      ctx.globalAlpha = 0.07;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1;
      const grid = 56;
      const ox = (t * 8) % grid;
      for (let x = -grid + ox; x < w + grid; x += grid) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = -grid + ((t * 6) % grid); y < h + grid; y += grid) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
      ctx.restore();

      // Pulse rings (connection / signal)
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.35 + i / 3) % 1;
        const cx = w * 0.72;
        const cy = h * 0.42;
        ctx.beginPath();
        ctx.arc(cx, cy, 40 + p * 180, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(34, 211, 238, ${0.28 * (1 - p)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Central chat orb
      const orbX = w * 0.72;
      const orbY = h * 0.42;
      const orbR = 54 + Math.sin(t * 1.4) * 4;
      const orbGrad = ctx.createLinearGradient(
        orbX - orbR,
        orbY - orbR,
        orbX + orbR,
        orbY + orbR,
      );
      orbGrad.addColorStop(0, '#0A2F6B');
      orbGrad.addColorStop(0.55, '#0D9488');
      orbGrad.addColorStop(1, '#22D3EE');
      ctx.beginPath();
      ctx.arc(orbX, orbY, orbR, 0, Math.PI * 2);
      ctx.fillStyle = orbGrad;
      ctx.shadowColor = 'rgba(34, 211, 238, 0.45)';
      ctx.shadowBlur = 28;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Simple chat glyph inside orb
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      roundRect(orbX - 22, orbY - 14, 44, 28, 10);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(orbX - 6, orbY + 14);
      ctx.lineTo(orbX + 2, orbY + 14);
      ctx.lineTo(orbX - 10, orbY + 26);
      ctx.closePath();
      ctx.fill();

      // Particles
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34, 211, 238, ${p.a})`;
        ctx.fill();
      }

      // Bubbles
      if (bubbles.length < 12 && Math.random() < 0.02) spawnBubble();

      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.x += b.vx + Math.sin(t + b.phase) * 0.12;
        b.y += b.vy;
        b.alpha = Math.min(1, b.alpha + 0.02);
        if (b.y + b.h < -40) {
          bubbles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = b.alpha * 0.92;
        if (b.outgoing) {
          const bg = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y + b.h);
          bg.addColorStop(0, '#0A2F6B');
          bg.addColorStop(1, '#0D9488');
          ctx.fillStyle = bg;
        } else {
          ctx.fillStyle = 'rgba(18, 32, 51, 0.88)';
        }
        roundRect(b.x, b.y, b.w, b.h, 16);
        ctx.fill();

        // Tail
        ctx.beginPath();
        if (b.outgoing) {
          ctx.moveTo(b.x + b.w - 10, b.y + b.h - 4);
          ctx.lineTo(b.x + b.w + 6, b.y + b.h + 8);
          ctx.lineTo(b.x + b.w - 22, b.y + b.h - 2);
        } else {
          ctx.moveTo(b.x + 10, b.y + b.h - 4);
          ctx.lineTo(b.x - 6, b.y + b.h + 8);
          ctx.lineTo(b.x + 22, b.y + b.h - 2);
        }
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = b.outgoing ? '#F8FAFC' : '#E2E8F0';
        ctx.font = '600 12px var(--font-dm-sans), system-ui, sans-serif';
        ctx.textBaseline = 'middle';
        const tx = b.x + 14;
        const ty = b.y + b.h / 2;
        ctx.fillText(b.text, tx, ty, b.w - 28);
        ctx.restore();
      }

      raf = requestAnimationFrame(draw);
    };

    resize();
    init();
    raf = requestAnimationFrame(draw);

    const onResize = () => {
      resize();
      init();
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 h-full w-full"
      aria-hidden
    />
  );
}
