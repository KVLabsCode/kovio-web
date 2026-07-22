'use client';

// Live session panel for one admin custom display — V2.
//
// V1 gave this panel the camera + impression counters. V2 adds the measured
// audience pipeline: the operator asserts attribution at Start (single
// creative → pick ONE org campaign; looping playlist → BLENDED, display-
// scoped, campaign picker hidden), and while the session runs the tiles show
// the three deduplicated LiDAR+depth metrics (unique reach / dwell engaged+ /
// close approaches) from audience_samples, with a sensor-health row so a dead
// LiDAR reads DEGRADED — never as "no audience". Playlist editing and the
// audience report/export live in sibling admin-session components.

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getFleetKey,
  setFleetKey,
  sessionApi,
  type DisplayItems,
  type SessionCampaign,
  type SessionMetrics,
  type SessionRobot,
  type SessionSummary,
} from '@/components/admin-session/kovioClient';
import PlaylistEditor from '@/components/admin-session/PlaylistEditor';
import AudienceReport from '@/components/admin-session/AudienceReport';

const inputCls =
  'rounded-md border border-border-soft bg-card px-3 py-2 text-sm text-ink outline-none focus:border-rust';

const UNATTRIBUTED = '__none__';

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean }) {
  return (
    <div className={`rounded-lg border border-border-soft p-3 ${dim ? 'opacity-50' : ''}`}>
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SensorDot({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="block h-[7px] w-[7px] rounded-full"
        style={{ background: ok ? '#5cbe85' : '#d4643a' }}
      />
      <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">{label}</span>
    </span>
  );
}

export default function AdminSessionPanel({ displayId }: { displayId: string }) {
  const [key, setKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [robots, setRobots] = useState<SessionRobot[]>([]);
  const [robotId, setRobotId] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [metrics, setMetrics] = useState<SessionMetrics | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // V2 attribution state
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [campaigns, setCampaigns] = useState<SessionCampaign[]>([]);
  const [campaignChoice, setCampaignChoice] = useState('');
  const [blendedAck, setBlendedAck] = useState(false);
  const [view, setView] = useState<'session' | 'playlist' | 'report'>('session');
  // Dashboard TTS: type a line, the robot speaks it on its next /current poll.
  const [speakText, setSpeakText] = useState('');
  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const mounted = useRef(true);
  const frameUrlRef = useRef<string | null>(null);

  const robot = robots.find((r) => r.id === robotId) ?? null;
  const blended = (itemCount ?? 0) > 1;

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

  // V2: attribution mode comes from the playlist length; the campaign picker
  // only lists the key org's campaigns (the server enforces the same gate).
  useEffect(() => {
    if (!keySaved) return;
    let cancelled = false;
    sessionApi
      .items(displayId)
      .then((p) => {
        if (!cancelled) setItemCount(p.items.length);
      })
      .catch(() => {});
    sessionApi
      .campaigns()
      .then((cs) => {
        if (!cancelled) setCampaigns(cs);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [keySaved, displayId]);

  const onPlaylistChange = useCallback((p: DisplayItems) => {
    setItemCount(p.items.length);
  }, []);

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

  // While a session is open: 5s poll of camera frame + V2 metric tiles +
  // legacy impression counters (same cadence as the OEM live panel).
  useEffect(() => {
    if (!sessionId || !robotId) return;
    let stopped = false;

    const tick = async () => {
      try {
        const [s, m, url] = await Promise.all([
          sessionApi.summary(sessionId),
          sessionApi.metrics(sessionId).catch(() => null),
          sessionApi.fetchFrame(robotId),
        ]);
        if (stopped || !mounted.current) {
          if (url) URL.revokeObjectURL(url);
          return;
        }
        setSummary(s);
        if (m) setMetrics(m);
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
    if (!canGo) return;
    setBusy(true);
    setError('');
    try {
      // A paused display serves NOTHING at /display/<code> — a live session on
      // one reads as "creatives not showing". Ensure it's active before start.
      try {
        const { createClient } = await import('@/lib/supabase/client');
        await createClient().rpc('kovio_admin_set_display_status', {
          p_id: displayId,
          p_status: 'active',
        });
      } catch {}
      const campaignId =
        !blended && campaignChoice && campaignChoice !== UNATTRIBUTED ? campaignChoice : null;
      const s = await sessionApi.start(robot!.id, displayId, campaignId);
      setSessionId(s.id);
      setSummary(null);
      setMetrics(null);
      setFrameUrl(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the session.');
    } finally {
      setBusy(false);
    }
  }

  async function sendSpeak() {
    const text = speakText.trim();
    if (!text || !robot || speaking) return;
    setSpeaking(true);
    setError('');
    try {
      await sessionApi.speak(robot.id, text);
      setSpeakText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send the message.');
    } finally {
      if (mounted.current) setSpeaking(false);
    }
  }

  async function sendListen() {
    if (!robot || listening) return;
    setListening(true);
    setError('');
    try {
      await sessionApi.listen(robot.id);
      // The robot captures + transcribes on-device and replies out its speaker;
      // the window is single-shot. Give it roughly a capture cycle before the
      // operator can trigger another turn.
      setTimeout(() => {
        if (mounted.current) setListening(false);
      }, 14000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start listening.');
      if (mounted.current) setListening(false);
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
      setMetrics(null);
      setFrameUrl(null);
      setBusy(false);
    }
  }

  const live = sessionId != null;
  // The operator must ASSERT attribution before Go: single-creative needs an
  // explicit campaign (or explicit "unattributed"); looping needs the blended
  // acknowledgment. The system never guesses.
  const attributionAsserted = blended ? blendedAck : Boolean(campaignChoice);
  const canGo = keySaved && !!robot && robot.online && !live && !busy && attributionAsserted;

  const boundCampaign = metrics?.campaign_id
    ? campaigns.find((c) => c.id === metrics.campaign_id)?.name ?? metrics.campaign_id
    : null;
  const degraded = Boolean(metrics?.degraded);
  const depthOff = metrics != null && metrics.sensor != null && !metrics.sensor.depth_ok;

  return (
    <div className="mt-3 rounded-lg border border-border-soft bg-page p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="block h-[7px] w-[7px] rounded-full"
            style={{ background: live ? '#5cbe85' : 'var(--color-faint, #9ca3af)' }}
          />
          <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">
            {live ? 'Session live · recording window open' : 'Session idle'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {(['session', 'playlist', 'report'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-md border px-2.5 py-1 text-[11px] uppercase tracking-wider hover:bg-card ${
                view === v ? 'border-rust text-rust' : 'border-border-soft text-ink-2'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
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

      {view === 'playlist' && (
        <PlaylistEditor displayId={displayId} disabled={!keySaved} live={live} onItems={onPlaylistChange} />
      )}
      {view === 'report' && (keySaved ? <AudienceReport displayId={displayId} /> : (
        <p className="mt-3 text-xs text-ink-2">Set the fleet key to load the report.</p>
      ))}

      {view === 'session' && (
        <>
          {/* Robot picker with the heartbeat-derived ONLINE/OFFLINE badge */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">Robot</span>
            <select
              value={robotId}
              onChange={(e) => setRobotId(e.target.value)}
              disabled={!keySaved || robots.length === 0}
              className={inputCls}
            >
              {robots.length === 0 && (
                <option value="">{keySaved ? 'No robots in fleet' : 'Set the key first'}</option>
              )}
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

          {/* V2 attribution — asserted by the operator at Start. */}
          {!live && keySaved && (
            blended ? (
              <label className="mt-2 flex items-start gap-2 rounded-md border border-rust/30 bg-rust/5 px-3 py-2 text-xs text-ink-2">
                <input
                  type="checkbox"
                  checked={blendedAck}
                  onChange={(e) => setBlendedAck(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  This display loops <b>{itemCount}</b> creatives, so the session runs{' '}
                  <b>blended</b>: its metrics stay on the display and are never reported under any
                  single campaign. Check to acknowledge.
                </span>
              </label>
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">
                  Attribute to
                </span>
                <select
                  value={campaignChoice}
                  onChange={(e) => setCampaignChoice(e.target.value)}
                  className={inputCls}
                >
                  <option value="">select campaign…</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.advertiser ? ` — ${c.advertiser}` : ''}
                      {c.status !== 'active' ? ` (${c.status})` : ''}
                    </option>
                  ))}
                  <option value={UNATTRIBUTED}>— no campaign (unattributed session) —</option>
                </select>
              </div>
            )
          )}
          {!live && robot && !robot.online && (
            <p className="mt-1.5 font-mono text-[11px] opacity-60">
              Go is enabled when the robot heartbeats (online = last beat within 90s).
            </p>
          )}
          {!live && keySaved && robot?.online && !attributionAsserted && (
            <p className="mt-1.5 font-mono text-[11px] opacity-60">
              {blended
                ? 'Acknowledge the blended mode to enable Go.'
                : 'Pick the campaign on screen (or "no campaign") to enable Go.'}
            </p>
          )}
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}

          {live && (
            <>
              {/* Attribution + sensor health strip */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full border border-border-soft px-2 py-0.5 text-[11px] text-ink-2">
                  {metrics?.is_blended
                    ? 'BLENDED — display-scoped metrics'
                    : boundCampaign
                      ? `attributing to: ${boundCampaign}`
                      : 'unattributed session'}
                </span>
                {metrics?.sensor && (
                  <div className="flex items-center gap-3">
                    <SensorDot
                      ok={metrics.sensor.lidar_ok}
                      label={metrics.sensor.lidar_ok ? `lidar ${metrics.sensor.lidar_hz.toFixed(1)}Hz` : 'lidar down'}
                    />
                    <SensorDot ok={metrics.sensor.depth_ok} label={metrics.sensor.depth_ok ? 'depth ok' : 'depth off'} />
                  </div>
                )}
              </div>
              {degraded && (
                <div className="mt-2 rounded-md border border-rust/40 bg-rust/10 px-3 py-2 text-xs text-rust">
                  DEGRADED — LiDAR is not delivering, so reach and dwell below are not
                  trustworthy right now. This is a sensor problem, not an empty room.
                </div>
              )}
              {!degraded && depthOff && (
                <div className="mt-2 rounded-md border border-border-soft bg-card px-3 py-2 text-xs text-ink-2">
                  Depth camera offline — close-approach is disabled and dwell runs
                  LiDAR-only (unconfirmed) until it returns.
                </div>
              )}

              {/* Dashboard TTS — type a line and the robot speaks it (~5s to
                  land on the next /current poll). */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">Say</span>
                <input
                  type="text"
                  value={speakText}
                  onChange={(e) => setSpeakText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendSpeak();
                  }}
                  maxLength={500}
                  placeholder="type something for the robot to say…"
                  className={`${inputCls} min-w-[220px] flex-1`}
                />
                <button
                  onClick={sendSpeak}
                  disabled={!speakText.trim() || speaking}
                  className="rounded-md bg-rust px-4 py-1.5 text-sm text-page transition-colors hover:bg-rust-dark disabled:opacity-40"
                >
                  {speaking ? 'Sending…' : 'Speak'}
                </button>
                {/* Push-to-talk — the robot listens once, transcribes on-device,
                    and replies out its speaker. */}
                <button
                  onClick={sendListen}
                  disabled={listening}
                  className="rounded-md border border-rust px-4 py-1.5 text-sm text-rust transition-colors hover:bg-rust hover:text-page disabled:opacity-40"
                >
                  {listening ? 'Listening…' : '🎤 Listen'}
                </button>
              </div>

              {/* Live camera — latest JPEG from the in-RAM relay, ~5s cadence */}
              <div className="mt-3 overflow-hidden rounded-lg border border-border-soft bg-black">
                {frameUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={frameUrl} alt="Live robot camera" className="max-h-[420px] w-full object-contain" />
                ) : (
                  <div className="flex h-48 items-center justify-center font-mono text-[11px] uppercase tracking-wider text-white/50">
                    {depthOff ? 'depth camera offline' : 'awaiting first frame…'}
                  </div>
                )}
              </div>
              {summary?.last_frame_age_seconds != null && (
                <div className="mt-1 font-mono text-[11px] opacity-50">
                  frame {summary.last_frame_age_seconds.toFixed(0)}s ago
                </div>
              )}

              {/* V2 tiles — measured, deduplicated audience_samples for this
                  session window. Dimmed while degraded so a dead sensor never
                  masquerades as an empty venue. */}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Unique reach" value={String(metrics?.reach_unique ?? 0)} dim={degraded} />
                <Stat label="Dwell (engaged+)" value={String(metrics?.dwell_engaged_plus ?? 0)} dim={degraded} />
                <Stat label="Close approach" value={String(metrics?.close_approaches ?? 0)} dim={degraded || depthOff} />
                <Stat
                  label="Started"
                  value={
                    summary?.started_at
                      ? new Date(summary.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'
                  }
                />
              </div>
              <div className="mt-2 font-mono text-[11px] opacity-60">
                gross passersby {metrics?.passersby_gross ?? 0} · dwell deep {metrics?.dwell_deep ?? 0} ·
                impressions {summary?.impressions ?? 0}
                {summary?.latest_campaign ? ` · now playing: ${summary.latest_campaign}` : ''}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
