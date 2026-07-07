'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

// Hardcoded RGB accent-ish colors (canvas can't easily read CSS vars).
const ACCENT = '#e0975a';
const ACCENT_DEEP = '#d98a4f';

type View = 'camera' | 'radar';

interface HawkeyeTileProps {
  unit: string;
  location: string;
  passed: number;
  looked: number;
  engaged: number;
  fps: number;
}

interface Pedestrian {
  x: number; // px, horizontal position of feet
  vx: number; // px/sec (signed) — realistic walking speed
  depth: number; // 0 = far (small, high), 1 = near (large, low)
  looking: boolean;
  phase: number; // walk-cycle phase
}

interface Blip {
  angle: number; // radians, measured from straight-up
  r: number; // normalized 0..1 distance from sensor
  speed: number;
}

export default function HawkeyeTile({
  unit,
  location,
  passed,
  looked,
  engaged,
  fps,
}: HawkeyeTileProps) {
  const [view, setView] = useState<View>('camera');
  const [tracked, setTracked] = useState(4);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Slowly drift the "tracked people" telemetry number ~ every second.
  useEffect(() => {
    const id = window.setInterval(() => {
      setTracked(Math.max(1, 3 + Math.floor(Math.random() * 5)));
    }, 1100);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = Math.max(1, window.devicePixelRatio || 1);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      dpr = Math.max(1, window.devicePixelRatio || 1);
      width = rect.width;
      height = rect.height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // --- CAMERA state ---
    const peds: Pedestrian[] = [];
    const spawnPed = (offscreen: boolean): Pedestrian => {
      const dir = Math.random() > 0.5 ? 1 : -1;
      const depth = Math.random();
      // Slow, calm stroll: ~7–20 px/s, nearer people read a touch faster.
      const pxPerSec = 7 + depth * 7 + Math.random() * 6;
      const w = Math.max(width, 1);
      return {
        x: offscreen ? (dir > 0 ? -70 : w + 70) : Math.random() * w,
        vx: dir * pxPerSec,
        depth,
        looking: Math.random() < 0.32,
        phase: Math.random() * Math.PI * 2,
      };
    };
    for (let i = 0; i < 6; i++) peds.push(spawnPed(false));

    // --- RADAR state ---
    const blips: Blip[] = [];
    for (let i = 0; i < 16; i++) {
      blips.push({
        angle: (Math.random() - 0.5) * Math.PI * 1.4,
        r: 0.15 + Math.random() * 0.85,
        speed: (Math.random() - 0.5) * 0.004,
      });
    }

    let scanY = 0;
    let raf = 0;
    let last = performance.now();

    const drawCamera = (dt: number) => {
      const dts = dt / 1000; // seconds
      ctx.clearRect(0, 0, width, height);

      // base dark street scene with a faint ground plane for depth
      const bg = ctx.createLinearGradient(0, 0, 0, height);
      bg.addColorStop(0, '#0b0908');
      bg.addColorStop(0.55, '#0d0a08');
      bg.addColorStop(1, '#060504');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, width, height);

      // pedestrians walk within this vertical band; depth maps to y + size
      const horizon = height * 0.34;
      const bandH = height * 0.5;

      // faint horizon line
      ctx.strokeStyle = 'rgba(207,199,189,0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, horizon);
      ctx.lineTo(width, horizon);
      ctx.stroke();

      const anchorX = width / 2;
      const anchorY = height - 4;

      // advance + respawn
      for (const p of peds) {
        p.x += p.vx * dts;
        p.phase += dts * (2 + Math.abs(p.vx) * 0.05);
        if (p.vx > 0 && p.x > width + 80) Object.assign(p, spawnPed(true));
        if (p.vx < 0 && p.x < -80) Object.assign(p, spawnPed(true));
      }

      // draw far → near so closer people overlap correctly
      const order = [...peds].sort((a, b) => a.depth - b.depth);
      for (const p of order) {
        const feetY = horizon + p.depth * bandH;
        const ph = height * (0.2 + p.depth * 0.26); // person height in px
        drawHuman(ctx, p.x, feetY, ph, p.looking, p.phase);

        if (p.looking) {
          const bw = ph * 0.5;
          const top = feetY - ph;
          // dashed gaze line from chest to the robot screen (ad anchor)
          ctx.save();
          ctx.strokeStyle = 'rgba(224,151,90,0.45)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 5]);
          ctx.beginPath();
          ctx.moveTo(p.x, top + ph * 0.42);
          ctx.lineTo(anchorX, anchorY);
          ctx.stroke();
          ctx.restore();

          // lock-on brackets + LOOKING tag
          drawBrackets(ctx, p.x - bw / 2 - 5, top - 7, bw + 10, ph + 12, ACCENT);
          ctx.font = '600 9px ui-monospace, monospace';
          ctx.fillStyle = ACCENT;
          ctx.textAlign = 'center';
          ctx.fillText('LOOKING', p.x, top - 12);
        }
      }

      // faint slow sweeping scanline
      scanY += dts * 22;
      if (scanY > height) scanY = 0;
      const sg = ctx.createLinearGradient(0, scanY - 24, 0, scanY + 24);
      sg.addColorStop(0, 'rgba(224,151,90,0)');
      sg.addColorStop(0.5, 'rgba(224,151,90,0.06)');
      sg.addColorStop(1, 'rgba(224,151,90,0)');
      ctx.fillStyle = sg;
      ctx.fillRect(0, scanY - 24, width, 48);

      // ad anchor marker (the robot's own screen)
      ctx.fillStyle = 'rgba(224,151,90,0.85)';
      ctx.beginPath();
      ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawRadar = (dt: number) => {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#080605';
      ctx.fillRect(0, 0, width, height);

      const cx = width / 2;
      const cy = height - 24;
      const maxR = Math.min(height * 0.92, width * 0.5);
      const coneHalf = (34 * Math.PI) / 180; // ±34° → ~68° cone

      // concentric arcs
      ctx.strokeStyle = 'rgba(207,199,189,0.12)';
      ctx.lineWidth = 1;
      for (let i = 1; i <= 3; i++) {
        ctx.beginPath();
        ctx.arc(cx, cy, (maxR * i) / 3, Math.PI, Math.PI * 2);
        ctx.stroke();
      }

      // detection cone — soft accent radial wedge (pointing up = -PI/2)
      const up = -Math.PI / 2;
      ctx.save();
      const wedge = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR);
      wedge.addColorStop(0, 'rgba(217,138,79,0.30)');
      wedge.addColorStop(1, 'rgba(217,138,79,0)');
      ctx.fillStyle = wedge;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, maxR, up - coneHalf, up + coneHalf);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      let lookingNow = 0;
      for (const b of blips) {
        b.angle += b.speed * dt * 0.06;
        if (b.angle > Math.PI * 0.85) b.angle = -Math.PI * 0.85;
        if (b.angle < -Math.PI * 0.85) b.angle = Math.PI * 0.85;

        // map angle (from up) to screen
        const a = up + b.angle;
        const px = cx + Math.cos(a) * b.r * maxR;
        const py = cy + Math.sin(a) * b.r * maxR;
        const inCone = Math.abs(b.angle) <= coneHalf;
        if (inCone) lookingNow++;

        if (inCone) {
          ctx.strokeStyle = 'rgba(217,138,79,0.4)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(px, py);
          ctx.stroke();
        }

        ctx.fillStyle = inCone ? ACCENT_DEEP : 'rgba(207,199,189,0.5)';
        ctx.beginPath();
        ctx.arc(px, py, inCone ? 4 : 3, 0, Math.PI * 2);
        ctx.fill();
      }

      // center sensor node
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,151,90,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();

      // overlay text
      ctx.font = '600 11px ui-monospace, monospace';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.textAlign = 'left';
      ctx.fillText(`${lookingNow} looking now`, 18, 26);
    };

    const loop = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (width > 0 && height > 0) {
        if (view === 'camera') drawCamera(dt);
        else drawRadar(dt);
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);

    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [view]);

  const toggleCls = (active: boolean) =>
    `px-[13px] py-[7px] rounded-[18px] border font-mono text-[11px] tracking-[0.08em] cursor-pointer transition-colors ${
      active
        ? 'bg-accent border-accent text-white'
        : 'border-white/20 bg-black/35 text-white/80'
    }`;

  return (
    <div className="bg-panel border border-line rounded-[16px] overflow-hidden">
      {/* Feed area */}
      <div className="relative h-[480px] bg-[#0b0907]">
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

        {/* HUD frame */}
        <div className="absolute inset-[14px] border border-white/[0.06] rounded-[8px] z-[4] pointer-events-none" />

        {/* LIVE pill */}
        <div className="absolute top-[22px] left-[22px] z-[6] flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-[20px]">
          <span className="k-pulse block h-2 w-2 rounded-full bg-accent" />
          <span className="font-mono text-[11px] tracking-[0.12em] text-white">
            LIVE · {fps}FPS
          </span>
        </div>

        {/* View toggles */}
        <div className="absolute top-[22px] right-[22px] z-[6] flex gap-2">
          <button
            type="button"
            className={toggleCls(view === 'camera')}
            onClick={() => setView('camera')}
          >
            CAMERA
          </button>
          <button
            type="button"
            className={toggleCls(view === 'radar')}
            onClick={() => setView('radar')}
          >
            360° LiDAR
          </button>
        </div>

        {/* Location chip */}
        <div className="absolute bottom-[22px] left-[22px] z-[6] bg-black/60 text-white font-mono text-[12px] px-3 py-1.5 rounded-[7px]">
          {location}
        </div>
      </div>

      {/* Telemetry strip */}
      <div className="grid grid-cols-4 border-b border-line">
        <TelemetryCell k="UNIT" v={unit} />
        <TelemetryCell k="TRACKED" v={`${tracked} people`} />
        <TelemetryCell k="RANGE" v="18.0 m" />
        <TelemetryCell k="UPTIME" v="6h 12m" last />
      </div>

      {/* 3-up counters */}
      <div className="grid grid-cols-3">
        <Counter value={passed.toLocaleString()} label="PEOPLE PASSED" />
        <Counter
          value={looked.toLocaleString()}
          label="ACTUALLY LOOKED"
          valueClass="text-accent-dark"
        />
        <Counter value={engaged.toLocaleString()} label="ENGAGED NOW" last />
      </div>
    </div>
  );
}

function TelemetryCell({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`px-4 py-3.5 ${last ? '' : 'border-r border-line'}`}>
      <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{k}</div>
      <div className="text-[17px] font-semibold text-ink mt-0.5">{v}</div>
    </div>
  );
}

function Counter({
  value,
  label,
  valueClass,
  last,
}: {
  value: string;
  label: string;
  valueClass?: string;
  last?: boolean;
}) {
  return (
    <div className={`p-[22px] text-center ${last ? '' : 'border-r border-line'}`}>
      <div className={`text-[26px] font-semibold ${valueClass ?? 'text-ink'}`}>{value}</div>
      <div className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint mt-1">
        {label}
      </div>
    </div>
  );
}

/** Pause/resume button styled per the campaign-detail design spec. */
export function CampaignPauseButton({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isActive = status === 'active';

  async function handleClick() {
    setLoading(true);
    setError('');
    const { error: err } = isActive
      ? await apiClient.pauseCampaign(id)
      : await apiClient.resumeCampaign(id);
    setLoading(false);
    if (err) {
      setError(
        err.code === 'budget_exhausted'
          ? 'Campaign budget exhausted.'
          : err.detail ?? 'Failed.',
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-[11px] border border-line-strong px-5 py-[13px] text-ink transition-colors hover:bg-panel disabled:opacity-50"
      >
        {loading ? 'Saving…' : isActive ? 'Pause campaign' : 'Resume campaign'}
      </button>
      {error && <p className="text-[12px] text-danger">{error}</p>}
    </div>
  );
}

// --- canvas helpers ---------------------------------------------------------

/** A walking human silhouette: head + tapered torso + swinging legs/arms. */
function drawHuman(
  ctx: CanvasRenderingContext2D,
  cx: number,
  feetY: number,
  h: number,
  looking: boolean,
  phase: number,
) {
  const color = looking ? 'rgba(224,151,90,0.95)' : 'rgba(216,208,196,0.7)';
  const top = feetY - h;
  const rh = h * 0.12; // head radius
  const headCy = top + rh;
  const shoulderY = headCy + rh * 1.1;
  const hipY = top + h * 0.56;
  const shoulderW = h * 0.26;
  const hipW = h * 0.17;
  const swing = Math.sin(phase) * h * 0.07;
  const armSwing = Math.sin(phase + Math.PI) * h * 0.055;

  ctx.save();
  ctx.shadowBlur = looking ? 16 : 7;
  ctx.shadowColor = looking ? ACCENT : 'rgba(216,208,196,0.4)';
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';

  // legs (behind torso)
  ctx.lineWidth = Math.max(2, h * 0.075);
  ctx.beginPath();
  ctx.moveTo(cx - hipW * 0.28, hipY);
  ctx.lineTo(cx - hipW * 0.28 + swing, feetY);
  ctx.moveTo(cx + hipW * 0.28, hipY);
  ctx.lineTo(cx + hipW * 0.28 - swing, feetY);
  ctx.stroke();

  // arms
  ctx.lineWidth = Math.max(1.5, h * 0.05);
  const armTopY = shoulderY + h * 0.015;
  const armBotY = hipY + h * 0.04;
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW * 0.42, armTopY);
  ctx.lineTo(cx - shoulderW * 0.42 + armSwing, armBotY);
  ctx.moveTo(cx + shoulderW * 0.42, armTopY);
  ctx.lineTo(cx + shoulderW * 0.42 - armSwing, armBotY);
  ctx.stroke();

  // torso (shoulders → hips)
  ctx.beginPath();
  ctx.moveTo(cx - shoulderW / 2, shoulderY);
  ctx.lineTo(cx + shoulderW / 2, shoulderY);
  ctx.lineTo(cx + hipW / 2, hipY);
  ctx.lineTo(cx - hipW / 2, hipY);
  ctx.closePath();
  ctx.fill();

  // head
  ctx.beginPath();
  ctx.arc(cx, headCy, rh, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBrackets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
) {
  const len = 8;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  // top-left
  ctx.moveTo(x, y + len);
  ctx.lineTo(x, y);
  ctx.lineTo(x + len, y);
  // top-right
  ctx.moveTo(x + w - len, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + len);
  // bottom-right
  ctx.moveTo(x + w, y + h - len);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w - len, y + h);
  // bottom-left
  ctx.moveTo(x + len, y + h);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x, y + h - len);
  ctx.stroke();
}
