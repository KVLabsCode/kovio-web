'use client';

// Real 360° LiDAR radar for the OEM display panel. Unlike the advertiser
// HawkeyeTile (whose blips are Math.random eye-candy), every dot here is an
// actual person the robot's Livox lidar clustered this frame, placed at its
// real range + bearing (0 = front, + = right). Data comes from the /live
// endpoint's `radar` snapshot; when no lidar has streamed we render an idle
// grid instead of inventing motion.

import { useEffect, useRef } from 'react';
import type { DisplayRadar } from '@/lib/types';

const ACCENT = '#e0975a';
const ACCENT_DEEP = '#d98a4f';
const RANGE_FLOOR_M = 4; // radar scales to the farthest blip, min 4 m

export default function HawkeyeRadar({
  radar,
  passed,
  peakNearby,
}: {
  radar: DisplayRadar | null;
  passed: number;
  peakNearby: number | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Keep the latest radar in a ref so the animation loop reads fresh data
  // without restarting on every poll.
  const radarRef = useRef<DisplayRadar | null>(radar);
  radarRef.current = radar;

  const blips = radar?.blips ?? [];
  const nearby = radar?.people_nearby ?? blips.length;
  const nearestM = radar?.nearest_m ?? null;

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

    let sweep = 0;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      raf = window.requestAnimationFrame(draw);
      if (width === 0 || height === 0) return;

      const cx = width / 2;
      const cy = height - 26;
      const maxR = Math.min(height * 0.9, width * 0.46);
      const up = -Math.PI / 2;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#080605';
      ctx.fillRect(0, 0, width, height);

      // range rings (labelled in metres, scaled to the farthest body)
      const r = radarRef.current;
      const rings = 3;
      const rangeM = Math.max(
        RANGE_FLOOR_M,
        ...(r?.blips ?? []).map((b) => b[0]).filter((v) => Number.isFinite(v)),
      );
      ctx.strokeStyle = 'rgba(207,199,189,0.12)';
      ctx.fillStyle = 'rgba(207,199,189,0.4)';
      ctx.font = '9px ui-monospace, monospace';
      ctx.textAlign = 'left';
      for (let i = 1; i <= rings; i++) {
        const rr = (maxR * i) / rings;
        ctx.beginPath();
        ctx.arc(cx, cy, rr, Math.PI, Math.PI * 2);
        ctx.stroke();
        ctx.fillText(`${((rangeM * i) / rings).toFixed(1)}m`, cx + 4, cy - rr + 11);
      }
      // bearing spokes at -90/-45/0/45/90
      for (const deg of [-90, -45, 0, 45, 90]) {
        const a = up + (deg * Math.PI) / 180;
        ctx.strokeStyle = 'rgba(207,199,189,0.07)';
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * maxR, cy + Math.sin(a) * maxR);
        ctx.stroke();
      }

      // rotating sweep (front semicircle) — cosmetic life, not fake data
      sweep += dt * 0.0011;
      const sa = up + Math.sin(sweep) * (Math.PI / 2);
      const grad = ctx.createLinearGradient(
        cx,
        cy,
        cx + Math.cos(sa) * maxR,
        cy + Math.sin(sa) * maxR,
      );
      grad.addColorStop(0, 'rgba(224,151,90,0.22)');
      grad.addColorStop(1, 'rgba(224,151,90,0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(sa) * maxR, cy + Math.sin(sa) * maxR);
      ctx.stroke();
      ctx.lineWidth = 1;

      // real blips
      const bl = r?.blips ?? [];
      bl.forEach(([rng, bearing], i) => {
        if (!Number.isFinite(rng) || !Number.isFinite(bearing)) return;
        const a = up + (bearing * Math.PI) / 180;
        const rr = Math.min(1, rng / rangeM) * maxR;
        const px = cx + Math.cos(a) * rr;
        const py = cy + Math.sin(a) * rr;
        const nearest = i === 0; // cloud sends nearest-first
        // soft radar echo
        ctx.fillStyle = nearest ? 'rgba(217,138,79,0.22)' : 'rgba(207,199,189,0.12)';
        ctx.beginPath();
        ctx.arc(px, py, nearest ? 11 : 8, 0, Math.PI * 2);
        ctx.fill();
        // core dot
        ctx.fillStyle = nearest ? ACCENT : 'rgba(220,212,200,0.85)';
        ctx.beginPath();
        ctx.arc(px, py, nearest ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fill();
        if (nearest) {
          ctx.strokeStyle = 'rgba(224,151,90,0.5)';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(px, py);
          ctx.stroke();
        }
      });

      // sensor node (the robot)
      ctx.fillStyle = ACCENT;
      ctx.beginPath();
      ctx.arc(cx, cy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(224,151,90,0.4)';
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.stroke();

      // overlay: live count or idle notice
      ctx.textAlign = 'left';
      ctx.font = '600 11px ui-monospace, monospace';
      if (r) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillText(`${bl.length} tracked now`, 16, 24);
      } else {
        ctx.fillStyle = 'rgba(207,199,189,0.5)';
        ctx.fillText('awaiting lidar…', 16, 24);
      }
    };
    raf = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="overflow-hidden rounded-lg border border-border-soft">
      <div className="flex items-center justify-between px-3 pt-2.5">
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">
          360° LiDAR
        </span>
        <span className="font-mono text-[11px]" style={{ color: ACCENT_DEEP }}>
          {radar ? `${nearby ?? 0} nearby` : 'idle'}
        </span>
      </div>
      <div className="relative h-[220px]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      </div>
      <div className="grid grid-cols-3 border-t border-border-soft">
        <RadarCell k="Passed by" v={passed.toLocaleString()} />
        <RadarCell k="Peak nearby" v={peakNearby != null ? String(peakNearby) : '—'} />
        <RadarCell
          k="Nearest"
          v={nearestM != null ? `${nearestM.toFixed(1)}m` : '—'}
          last
        />
      </div>
    </div>
  );
}

function RadarCell({ k, v, last }: { k: string; v: string; last?: boolean }) {
  return (
    <div className={`px-3 py-2.5 ${last ? '' : 'border-r border-border-soft'}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">{k}</div>
      <div className="mt-0.5 text-[16px] font-semibold tabular-nums">{v}</div>
    </div>
  );
}
