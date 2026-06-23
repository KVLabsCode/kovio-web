'use client';

import { useState } from 'react';
import type { Insight } from '@/lib/insights';

// Fixed-dark "Kovio Intelligence" panel. Insights are computed server-side
// (deterministic v1); Regenerate just replays the brief analyzing state since
// there's no live model yet — the seam is buildInsights() on the server.
export default function IntelligencePanel({
  insight,
  generated,
}: {
  insight: Insight;
  generated: string;
}) {
  const [analyzing, setAnalyzing] = useState(false);

  function regenerate() {
    setAnalyzing(true);
    setTimeout(() => setAnalyzing(false), 1400);
  }

  const toneClass = (t?: Insight['summary'][number]['tone']) =>
    t === 'accent' ? 'text-[#d38b50] font-semibold' : t === 'good' ? 'text-[#5cbe85] font-semibold' : t === 'ink' ? 'text-[#f1ead9] font-semibold' : '';

  return (
    <div className="mt-[26px] overflow-hidden rounded-[20px] border border-[#4b4231] bg-[#211d18] text-[#f1ead9]">
      {/* header */}
      <div
        className="flex items-center justify-between gap-4 border-b border-[#39321f] px-7 py-[22px]"
        style={{ background: 'linear-gradient(90deg, #2a2519, #211d18)' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-[34px] w-[34px] items-center justify-center rounded-[9px] text-[17px] text-[#161310]"
            style={{ background: 'linear-gradient(135deg, #d38b50, #bc6f37)' }}
          >
            ✦
          </div>
          <div>
            <div className="text-[17px] font-semibold tracking-[-0.01em]">Kovio Intelligence</div>
            <div className="mt-px font-mono text-[11px] text-[#857b64]">
              Generated {generated} · analyzed {insight.analyzed.toLocaleString()} verified interactions
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={regenerate}
          disabled={analyzing}
          className="inline-flex items-center gap-1.5 rounded-[9px] border border-[#4b4231] bg-[#2a2519] px-3.5 py-2.5 text-[13px] text-[#f1ead9] transition-colors hover:border-[#d38b50] disabled:opacity-70"
        >
          {analyzing ? 'Analyzing…' : '↻ Regenerate'}
        </button>
      </div>

      <div className="px-7 py-[26px]">
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#857b64]">
          Executive summary
        </div>
        <p className="mt-3 max-w-[920px] text-[18px] leading-[1.6] text-[#e8e0cf]">
          {insight.summary.map((seg, i) => (
            <span key={i} className={toneClass(seg.tone)}>
              {seg.text}
            </span>
          ))}
        </p>

        {/* key findings */}
        <div className="mb-3.5 mt-7 font-mono text-[11px] uppercase tracking-[0.12em] text-[#857b64]">
          Key findings
        </div>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {insight.findings.map((f, i) => (
            <div key={i} className="rounded-[14px] border border-[#39321f] bg-[#1a1712] p-5">
              <div className="font-mono text-[30px] text-[#d38b50]">{f.stat}</div>
              <div className="mt-2 text-[15px] font-semibold">{f.title}</div>
              <div className="mt-1.5 text-[14px] leading-[1.5] text-[#b6ac95]">{f.body}</div>
            </div>
          ))}
        </div>

        {/* recommended actions */}
        <div className="mb-3.5 mt-7 font-mono text-[11px] uppercase tracking-[0.12em] text-[#857b64]">
          Recommended actions
        </div>
        <div className="flex flex-col gap-2.5">
          {insight.actions.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-[12px] border border-[#39321f] bg-[#1a1712] px-5 py-4"
            >
              <div className="flex h-7 w-7 flex-none items-center justify-center rounded-[8px] bg-[#5c4527] font-mono text-[13px] text-[#d38b50]">
                {i + 1}
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-semibold">{a.title}</div>
                <div className="mt-0.5 text-[13px] text-[#b6ac95]">{a.rationale}</div>
              </div>
              <span className="hidden flex-none font-mono text-[12px] text-[#5cbe85] sm:block">
                {a.impact}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
