'use client';

// Real per-display interaction metrics for the OEM. Polls
// GET /oem/v1/displays/{id}/live every few seconds and renders the attributed
// summary + event feed. This is the genuine replacement for the synthetic
// Hawkeye (Math.random feed / seeded-RNG charts): every number here comes from
// the robot's own scene_observed / interaction_observed events, attributed to
// this display via the assignment the operator sets below.

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { EngagementFunnel } from '@/components/EngagementFunnel';
import HawkeyeRadar from '@/components/HawkeyeRadar';
import { formatCount, formatDwell, formatPct, formatRelative } from '@/lib/format';
import type { DisplayLive, DisplayMetrics } from '@/lib/types';

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-soft p-3">
      <div className="font-mono text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums">{value}</div>
    </div>
  );
}

export default function DisplayLivePanel({
  displayId,
  fleets,
  initial,
}: {
  displayId: string;
  fleets: { id: string; name: string }[];
  initial: DisplayMetrics;
}) {
  const [live, setLive] = useState<DisplayLive | null>(null);
  const [fleetId, setFleetId] = useState(fleets[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const { data } = await apiClient.oemDisplayLive(displayId, 5);
    if (data && mounted.current) setLive(data);
  }, [displayId]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const t = window.setInterval(refresh, 5000);
    return () => {
      mounted.current = false;
      window.clearInterval(t);
    };
  }, [refresh]);

  async function assign() {
    if (!fleetId || busy) return;
    setBusy(true);
    await apiClient.oemAssignDisplay(displayId, { fleet_id: fleetId });
    await refresh();
    setBusy(false);
  }

  async function unassignAll() {
    if (busy) return;
    setBusy(true);
    await apiClient.oemUnassignDisplay(displayId, {});
    await refresh();
    setBusy(false);
  }

  const summary = live?.summary ?? initial.summary;
  const active = live?.active ?? initial.active;
  const events = live?.events ?? [];
  const radar = live?.radar ?? null;
  const lookRate = summary.look_rate;

  return (
    <div className="rounded-lg border border-border-soft bg-card p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="block h-[7px] w-[7px] rounded-full"
            style={{ background: active.length > 0 ? '#5cbe85' : 'var(--color-faint, #9ca3af)' }}
          />
          <span className="font-mono text-[11px] uppercase tracking-wider opacity-70">
            {active.length > 0 ? 'Live · attributing' : 'Live · no robots assigned'}
          </span>
        </div>
        <span className="font-mono text-[11px] opacity-50">last 5 min</span>
      </div>

      {/* Assign control: bind this display to a fleet's robots so their
          perception attributes here. Without this, metrics stay at zero. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] uppercase tracking-wider opacity-60">
          Show on fleet
        </span>
        <select
          value={fleetId}
          onChange={(e) => setFleetId(e.target.value)}
          className="rounded-md border border-border-soft bg-transparent px-2 py-1.5 text-sm"
        >
          {fleets.length === 0 && <option value="">No fleets</option>}
          {fleets.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
        <button
          onClick={assign}
          disabled={busy || !fleetId}
          className="rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          style={{ background: 'var(--color-rust, #b4532a)' }}
        >
          {busy ? 'Saving…' : 'Assign'}
        </button>
        {active.length > 0 && (
          <button
            onClick={unassignAll}
            disabled={busy}
            className="rounded-md border border-border-soft px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50"
          >
            Unassign all
          </button>
        )}
      </div>
      <div className="mt-2 font-mono text-[11px] opacity-60">
        {active.length > 0
          ? `${active.length} robot${active.length === 1 ? '' : 's'} showing this display`
          : 'Assign a fleet, point its robot screens at the link above, and run the robot agent to start collecting.'}
      </div>

      {/* Real attributed metrics */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Passed by" value={formatCount(summary.total_reach ?? 0)} />
        <Stat label="Looked" value={formatCount(summary.total_looked ?? 0)} />
        <Stat label="Look rate" value={lookRate != null ? formatPct(lookRate) : '—'} />
        <Stat label="Avg dwell" value={formatDwell(summary.avg_dwell_s)} />
      </div>

      <div className="mt-5 border-t border-border-soft pt-4">
        <EngagementFunnel summary={summary} />
      </div>

      {/* Real 360° LiDAR radar — actual clustered people, not the advertiser
          tile's Math.random blips. Idle until a lidar-equipped robot streams. */}
      <div className="mt-5 border-t border-border-soft pt-4">
        <HawkeyeRadar
          radar={radar}
          passed={summary.total_passed_lidar ?? 0}
          peakNearby={summary.peak_people_nearby ?? null}
        />
      </div>

      {/* Live event feed (real events, real timestamps) */}
      <div className="mt-5 border-t border-border-soft pt-4">
        <div className="font-mono text-[11px] uppercase tracking-wider opacity-60">
          Recent activity
        </div>
        <div className="mt-2">
          {events.length === 0 ? (
            <div className="py-3 text-sm opacity-50">No events in the last 5 minutes.</div>
          ) : (
            events.map((e, i) => (
              <div
                key={`${e.ts}-${i}`}
                className="flex items-center gap-2 border-b border-border-soft py-2 last:border-b-0"
              >
                <span className="text-sm font-medium capitalize">
                  {e.kind === 'view' ? 'View' : e.kind.replace(/_/g, ' ')}
                </span>
                {e.kind === 'view' && (
                  <span className="text-sm opacity-60">
                    {e.person_count ?? 0} nearby · {e.attended_count ?? 0} faced
                  </span>
                )}
                <span className="ml-auto font-mono text-[12px] opacity-50">
                  {formatRelative(e.ts)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
