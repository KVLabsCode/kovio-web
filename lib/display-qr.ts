// Shared shape for the per-campaign QR overlay on OEM custom displays.
// Pure/isomorphic — safe to import from both the browser editor and the
// server-side player route. Position/size are fractions (0..1) of the
// full-screen stage so the overlay scales with any screen.

export interface DisplayQrConfig {
  enabled: boolean;
  targetUrl: string;
  x: number; // left, fraction of stage width
  y: number; // top,  fraction of stage height
  size: number; // QR box width, fraction of stage width
  linkCode: string | null; // campaign_links.code the QR encodes; null until first save
}

export const DEFAULT_DISPLAY_QR: DisplayQrConfig = {
  enabled: false,
  targetUrl: '',
  x: 0.7,
  y: 0.68,
  size: 0.22,
  linkCode: null,
};

// Clamp a placement so the QR box always stays fully on the stage.
export function clampPlacement(x: number, y: number, size: number) {
  const s = Math.min(0.6, Math.max(0.06, size));
  return {
    size: s,
    x: Math.min(1 - s, Math.max(0, x)),
    y: Math.min(1 - s, Math.max(0, y)),
  };
}
