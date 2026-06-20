import { describe, it, expect } from 'vitest';
import { creativeUrlFor, buildCampaignBody } from '@/lib/campaign-draft';

const base = {
  name: 'Summer Launch', company: 'Acme Inc', category: 'retail',
  budget: '500', start: '2026-07-01', duration: 14, code: 'XyZ12345',
};

describe('creativeUrlFor', () => {
  it('builds the hosted creative url', () => {
    expect(creativeUrlFor('https://app.kovio.ai', 'abc')).toBe('https://app.kovio.ai/creative/abc');
  });
});

describe('buildCampaignBody', () => {
  it('uses company as advertiser and the hosted creative url', () => {
    const body = buildCampaignBody({ draft: base, mode: 'paid', origin: 'https://app.kovio.ai' });
    expect(body.advertiser).toBe('Acme Inc');
    expect(body.creative_url).toBe('https://app.kovio.ai/creative/XyZ12345');
    expect(body.name).toBe('Summer Launch');
    expect(body.category).toBe('retail');
    expect(body.budget_total_cents).toBe(50000);
    expect(body.campaign_id.startsWith('summer-launch-')).toBe(true);
  });

  it('forces 7 days and 50000 cents in trial mode', () => {
    const body = buildCampaignBody({ draft: base, mode: 'trial', origin: 'https://app.kovio.ai' });
    expect(body.budget_total_cents).toBe(50000);
    const days = (new Date(body.end_at!).getTime() - new Date(body.start_at).getTime()) / 86400000;
    expect(Math.round(days)).toBe(7);
  });

  it('falls back to Brand when company is empty', () => {
    const body = buildCampaignBody({ draft: { ...base, company: '' }, mode: 'paid', origin: 'https://x' });
    expect(body.advertiser).toBe('Brand');
  });
});
