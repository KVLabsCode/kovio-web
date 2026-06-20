import { describe, it, expect } from 'vitest';
import { qrSvg } from '@/lib/qr';

describe('qrSvg', () => {
  it('returns an svg string', async () => {
    const svg = await qrSvg('https://kovio.example/r/abc123');
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
  });
  it('produces different output for different urls', async () => {
    const a = await qrSvg('https://kovio.example/r/aaa');
    const b = await qrSvg('https://kovio.example/r/bbb');
    expect(a).not.toBe(b);
  });
});
