'use client';

import QRCode from 'qrcode';
import { useEffect, useRef, useState } from 'react';
import { clampPlacement, type DisplayQrConfig } from '@/lib/display-qr';

const inputCls =
  'w-full rounded-md border border-border-soft bg-card px-3 py-2.5 text-sm text-ink outline-none transition-colors focus:border-rust';
const labelCls = 'mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-2';

type Preview = { url: string; type: 'image' | 'video' } | null;

// Interactive placement editor for a custom campaign's QR overlay. The QR sits on
// top of the creative (drag to move it beside the logo, drag the corner to
// resize). Everything is stored as fractions of the stage so it scales on any
// robot screen — the same math the player uses.
export default function DisplayQrEditor({
  config,
  onChange,
  preview,
}: {
  config: DisplayQrConfig;
  onChange: (next: DisplayQrConfig) => void;
  preview: Preview;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Render a live QR of the target (or a placeholder) so placement is realistic.
  useEffect(() => {
    const value = config.targetUrl.trim() || 'https://kovio.dev';
    let alive = true;
    QRCode.toDataURL(value, { margin: 1, width: 240 })
      .then((d) => alive && setQrDataUrl(d))
      .catch(() => alive && setQrDataUrl(''));
    return () => {
      alive = false;
    };
  }, [config.targetUrl]);

  // Shared pointer-drag: `mode` decides whether we move or resize the box.
  function startDrag(mode: 'move' | 'resize', e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();

    const onMove = (ev: PointerEvent) => {
      const fx = (ev.clientX - rect.left) / rect.width;
      const fy = (ev.clientY - rect.top) / rect.height;
      if (mode === 'move') {
        // Center the box under the cursor.
        const next = clampPlacement(fx - config.size / 2, fy - config.size / 2, config.size);
        onChange({ ...config, ...next });
      } else {
        // Resize from the top-left anchor: size follows the cursor distance.
        const size = Math.max(fx - config.x, fy - config.y);
        const next = clampPlacement(config.x, config.y, size);
        onChange({ ...config, ...next });
      }
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  return (
    <div className="mt-7 rounded-lg border border-border-soft bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={labelCls}>QR code</div>
          <p className="text-sm text-ink-2">
            Overlay a scannable QR on the creative — place it beside your logo and resize to taste.
          </p>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => onChange({ ...config, enabled: e.target.checked })}
            className="accent-rust"
          />
          {config.enabled ? 'On' : 'Off'}
        </label>
      </div>

      <div className="mt-4">
        <label className={labelCls} htmlFor="qr-url">QR links to</label>
        <input
          id="qr-url"
          type="url"
          inputMode="url"
          value={config.targetUrl}
          onChange={(e) => onChange({ ...config, targetUrl: e.target.value })}
          placeholder="https://your-advertiser.com/offer"
          className={inputCls}
        />
        <p className="mt-1.5 text-xs text-ink-2">
          Scans are counted, then redirect here (via a short {`/r/…`} link).
        </p>
      </div>

      {config.enabled && (
        <div className="mt-4">
          <div className={labelCls}>Placement — drag to move, drag the corner to resize</div>
          <div
            ref={stageRef}
            className="relative aspect-video w-full select-none overflow-hidden rounded-md border border-border-soft bg-black"
          >
            {/* Creative behind, for context */}
            {preview?.type === 'video' ? (
              <video src={preview.url} muted loop autoPlay playsInline className="h-full w-full object-cover" />
            ) : preview?.type === 'image' ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview.url} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-wide text-ink-2/60">
                add a creative to preview it here
              </div>
            )}

            {/* Draggable / resizable QR box */}
            <div
              onPointerDown={(e) => startDrag('move', e)}
              className="absolute cursor-move touch-none rounded-[6px] bg-white p-[1.5%] shadow-[0_6px_24px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
              style={{
                left: `${config.x * 100}%`,
                top: `${config.y * 100}%`,
                width: `${config.size * 100}%`,
                aspectRatio: '1 / 1',
              }}
            >
              {qrDataUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrDataUrl} alt="QR preview" className="pointer-events-none block h-full w-full" draggable={false} />
              )}
              <span
                onPointerDown={(e) => startDrag('resize', e)}
                className="absolute -bottom-1.5 -right-1.5 h-4 w-4 cursor-nwse-resize touch-none rounded-full border-2 border-white bg-rust shadow"
                aria-label="Resize QR"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
