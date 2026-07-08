'use client';

// Live session panel for one admin custom display: pick the ONLINE robot that
// is showing it, hit Go, watch the RealSense camera + the impressions accruing
// in the session window. Talks straight to kovio-api /session/v1 with the
// pasted fleet key (see admin-session/kovioClient). Visual idiom copied from
// the OEM DisplayLivePanel (5s polling, Stat tiles) — deliberately NOT
// imported from it; LiDAR tile omitted (driver not publishing in V1).

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getFleetKey,
  setFleetKey,
  sessionApi,
  type SessionRobot,
  type SessionSummary,
} from '@/components/admin-session/kovioClient';

const inputCls =
  'rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function AdminSessionPanel({ displayId }: { displayId: string }) {
  const [key, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [robots, setRobots] = useState<SessionRobot[]>([]);
  const [robotId, setRobotId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const frameUrlRef = useRef<string | null>(null);

  const robot = robots.find((r) => r.id === robotId) ?? null;

  useEffect(() => {
    mounted.current = true;
    const stored = getFleetKey();
    if (stored) {
      setKey(stored);
      setKeySaved(true);
    }
    return () => {
      mounted.current = false;
      if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
    };
  }, []);

  const loadRobots = useCallback(async () => {
    if (!getFleetKey()) return;
    try {
      const { robots: rs } = await sessionApi.robots();
      if (!mounted.current) return;
      setRobots(rs);
      setRobotId((prev) => prev || (rs.find((r) => r.online) ?? rs[0])?.id || '');
      setError('');
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Could not load robots.');
    }
  }, []);

  // Robot list (with ONLINE badge) refreshes on the same cadence as the
  // heartbeat-derived rule it displays.
  useEffect(() => {
    if (!keySaved) return;
    loadRobots();
    const t = window.setInterval(loadRobots, 15000);
    return () => window.clearInterval(t);
  }, [keySaved, loadRobots]);

  // Adopt an already-open session for the selected robot (page reload, second
  // admin tab) instead of failing on Start.
  useEffect(() => {
    if (!keySaved || !robot || sessionId) return;
    let cancelled = false;
    sessionApi
      .current(robot.external_id)
      .then((cur) => {
        if (!cancelled && cur.active && cur.session_id) setSessionId(cur.session_id);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [keySaved, robot, sessionId]);

  // While a session is open: 5s poll of camera frame + counters (same cadence
  // as the OEM live panel — no realtime stack in V1).
  useEffect(() => {
    if (!sessionId || !robotId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const [s, url] = await Promise.all([
          sessionApi.summary(sessionId),
          sessionApi.fetchFrame(robotId),
        ]);
        if (stopped || !mounted.current) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        setSummary(s);
        if (url) {
          if (frameUrlRef.current) URL.revokeObjectURL(frameUrlRef.current);
          frameUrlRef.current = url;
          setFrameUrl(url);
        }
        if (s.status === 'stopped') setSessionId(null);
      } catch (e) {
        if (!stopped && mounted.current)
          setError(e instanceof Error ? e.message : 'Session poll failed.');
      }
    };

    tick();
    const t = window.setInterval(tick, 5000);
    return () => {
      stopped = true;
      window.clearInterval(t);
    };
  }, [sessionId, robotId]);

  function saveKey() {
    setFleetKey(key.trim());
    setKeySaved(Boolean(key.trim()));
    setError('');
  }

  async function go() {
    if (!robot || !robot.online || busy) return;
    setBusy(true);
    setError('');
    try {
      const s = await sessionApi.start(robot.id, displayId);
      setSessionId(s.id);
      setSummary(null);
      setFrameUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the session.');
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    if (!sessionId || busy) return;
    setBusy(true);
    try {
      await sessionApi.stop(sessionId);
    } catch {}
    if (mounted.current) {
      setSessionId(null);
      setSummary(null);
      setFrameUrl(null);
      setBusy(false);
    }
  }

  const live = sessionId != null;
  const canGo = keySaved && !!robot && robot.online && !live && !busy;

  return (
    <div className="mt-3 rounded-lg border border-border-soft bg-page p-4">
      <div className="flex items-center gap-2">
        <span
          className="block h-[7px] w-[7px] rounded-full"
          style={{ background: live ? '#5cbe85' : 'var(--color-faint, #9ca3af)' }}
        />
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">
          {live ? 'Session live · recording window open' : 'Session idle'}
        </span>
      </div>

      {/* Fleet key custody — the crux of V1: the session inherits this key's
          fleet → org resolution; no new keys are minted. */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">Fleet key</span>
        <input
          type="password"
          value={key}
          onChange={(e) => {
            setKey(e.target.value);
            setKeySaved(false);
          }}
          placeholder="kov_live_…"
          className={`${inputCls} w-56`}
        />
        <button
          onClick={saveKey}
          disabled={!key.trim() || keySaved}
          className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-ink hover:bg-card disabled:opacity-40"
        >
          {keySaved ? 'Key set ✓' : 'Use key'}
        </button>
      </div>

      {/* Robot picker with the heartbeat-derived ONLINE/OFFLINE badge */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">Robot</span>
        <select
          value={robotId}
          onChange={(e) => setRobotId(e.target.value)}
          disabled={!keySaved || robots.length === 0}
          className={inputCls}
        >
          {robots.length === 0 && <option value="">{keySaved ? 'No robots in fleet' : 'Set the key first'}</option>}
          {robots.map((r) => (
            <option key={r.id} value={r.id}>
              {r.online ? '● ONLINE' : '○ offline'} — {r.external_id}
            </option>
          ))}
        </select>
        {robot && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${robot.online ? 'bg-good/10 text-good' : 'border border-border-soft text-ink-2'}`}
          >
            {robot.online ? 'online' : 'offline'}
          </span>
        )}
        {!live ? (
          <button
            onClick={go}
            disabled={!canGo}
            className="rounded-md bg-rust px-4 py-1.5 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
          >
            {busy ? 'Starting…' : 'Go'}
          </button>
        ) : (
          <button
            onClick={stop}
            disabled={busy}
            className="rounded-md border border-border-soft px-4 py-1.5 text-sm text-danger hover:bg-card disabled:opacity-40"
          >
            {busy ? 'Stopping…' : 'Stop'}
          </button>
        )}
      </div>
      {!live && robot && !robot.online && (
        <p className="mt-1.5 font-mono text-[11px] opacity-60">
          Go is enabled when the robot heartbeats (online = last beat within 90s).
        </p>
      )}
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}

      {live && (
        <>
          {/* Live camera — latest JPEG from the in-RAM relay, ~5s cadence */}
          <div className="mt-4 overflow-hidden rounded-lg border border-border-soft bg-black">
            {frameUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={frameUrl} alt="Live robot camera" className="max-h-[420px] w-full object-contain" />
            ) : (
              <div className="flex h-48 items-center justify-center font-mono text-[11px] uppercase tracking-wider text-white/50">
                awaiting first frame…
              </div>
            )}
          </div>
          {summary?.last_frame_age_seconds != null && (
            <div className="mt-1 font-mono text-[11px] opacity-50">
              frame {summary.last_frame_age_seconds.toFixed(0)}s ago
            </div>
          )}

          {/* Impression counters for the session window — read from the
              existing ad_played → spend processor pipeline, nothing new. */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Impressions" value={String(summary?.impressions ?? 0)} />
            <Stat label="People" value={String(summary?.person_count ?? 0)} />
            <Stat label="Attended" value={String(summary?.attended_count ?? 0)} />
            <Stat
              label="Started"
              value={
                summary?.started_at
                  ? new Date(summary.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : '—'
              }
            />
          </div>
          {summary?.latest_campaign && (
            <div className="mt-2 font-mono text-[11px] opacity-60">
              now playing: {summary.latest_campaign}
            </div>
          )}
        </>
      )}
    </div>
  );
}
