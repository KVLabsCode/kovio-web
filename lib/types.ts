// Shared types mirroring the kovio-api advertiser endpoints.

export type CampaignStatus =
  | 'draft'
  | 'pending_review'
  | 'active'
  | 'paused'
  | 'completed'
  | 'rejected';

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
  balance_cents: number;
  created_at: string;
}

export interface AdvertiserUser {
  id: string;
  email: string;
  role: string;
}

export interface MeResponse {
  user: AdvertiserUser;
  org: OrgSummary;
}

export interface Campaign {
  id: string;
  campaign_id: string;
  name: string;
  advertiser: string;
  creative_url: string;
  targeting: Array<Record<string, unknown>>;
  category: string | null;
  status: CampaignStatus;
  enabled: boolean;
  priority: number;
  encounter_cap_seconds: number;
  budget_total_cents: number;
  budget_spent_cents: number;
  cost_per_impression_cents: number;
  cost_per_attended_cents: number;
  cost_per_engagement_cents: number;
  start_at: string;
  end_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecentImpression {
  campaign_id: string;
  campaign_name: string;
  cost_cents: number;
  timestamp: string;
}

export interface Dashboard {
  balance_cents: number;
  total_campaigns: number;
  active_campaigns: number;
  paused_campaigns: number;
  impressions_24h: number;
  impressions_30d: number;
  spent_24h_cents: number;
  spent_30d_cents: number;
  recent_impressions: RecentImpression[];
}

export interface CampaignDayStat {
  date: string;
  impressions: number;
  spent_cents: number;
}

export interface CampaignDetail {
  campaign: Campaign;
  stats: {
    impressions_total: number;
    spent_cents_total: number;
    remaining_cents: number;
    by_day: CampaignDayStat[];
  };
}

export interface ApiError {
  status: number;
  code?: string;
  detail?: string;
}

export type Result<T> = { data: T | null; error: ApiError | null };
