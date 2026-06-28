// Shared types mirroring the kovio-api advertiser endpoints.

// How a creative_url should be rendered (on the robot screen / tablet player /
// dashboard preview). 'html' is the legacy default for bundled/external pages.
export type CreativeType = 'image' | 'video' | 'html';

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
  creative_type: CreativeType;
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
  // Real per-campaign rollups from the impressions table (present on the
  // /advertiser/v1/campaigns list response; optional elsewhere).
  impressions_total?: number;
  walked_by_total?: number;
  attended_total?: number;
  attention_rate?: number;
}

export interface RecentImpression {
  campaign_id: string;
  campaign_name: string;
  cost_cents: number;
  timestamp: string;
}

// Anonymous LiDAR audience telemetry, aggregated over a window. Powers the
// reach / attention / dwell / proximity panels on both dashboards.
export interface AudienceSummary {
  samples: number;
  avg_reach: number;
  peak_reach: number;
  avg_attended: number;
  // Sentinel: 0 means "no dwell data yet" (no column) — guard on the value.
  avg_dwell_s: number;
  // Closest LiDAR approach (metres) during ads in the window; null => "—".
  nearest_m: number | null;
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
  audience_30d: AudienceSummary;
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
    walked_by_total: number;
    attended_total: number;
    by_day: CampaignDayStat[];
    audience_30d: AudienceSummary;
  };
}

export interface ApiError {
  status: number;
  code?: string;
  detail?: string;
}

export type Result<T> = { data: T | null; error: ApiError | null };

// --- OEM portal ---------------------------------------------------------------
export interface OemOrg {
  id: string;
  name: string;
  slug: string;
  kind: string;
  pending_payout_cents: number;
  lifetime_payout_cents: number;
  stripe_connect_id: string | null;
  created_at: string;
}

export interface OemMeResponse {
  user: AdvertiserUser;
  org: OemOrg;
}

export interface OemDayStat {
  date: string;
  impressions: number;
  revenue_cents: number;
}

export interface OemFleetStat {
  fleet_id: string;
  fleet_name: string;
  impressions_30d: number;
  revenue_30d_cents: number;
  avg_reach_30d: number;
  avg_attended_30d: number;
}

export interface OemRecentImpression {
  id: string;
  campaign_name: string;
  campaign_advertiser: string;
  fleet_name: string;
  robot_external_id: string;
  revenue_to_oem_cents: number;
  timestamp: string;
}

export interface OemDashboard {
  pending_payout_cents: number;
  lifetime_payout_cents: number;
  impressions_24h: number;
  impressions_30d: number;
  revenue_24h_cents: number;
  revenue_30d_cents: number;
  total_fleets: number;
  total_robots: number;
  active_robots: number;
  audience_30d: AudienceSummary;
  by_day: OemDayStat[];
  by_fleet: OemFleetStat[];
  recent_impressions: OemRecentImpression[];
}

export interface Fleet {
  id: string;
  name: string;
  region: string | null;
  blocked_categories: string[];
  blocked_advertisers: string[];
  revenue_share_pct: number;
  created_at: string;
  robot_count?: number;
  impressions_24h?: number;
  revenue_24h_cents?: number;
}

export interface FleetRobot {
  id: string;
  external_id: string;
  status: string;
  last_heartbeat: string | null;
  created_at: string;
}

export interface ApiKeyMeta {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

export interface MintedApiKey extends ApiKeyMeta {
  secret: string;
}

export interface FleetDetail {
  fleet: Fleet;
  robots: FleetRobot[];
  api_keys: ApiKeyMeta[];
  stats: {
    impressions_24h: number;
    impressions_30d: number;
    revenue_24h_cents: number;
    revenue_30d_cents: number;
    by_day: OemDayStat[];
    audience_30d: AudienceSummary;
  };
}

// --- OEM custom displays ------------------------------------------------------
// A standalone, looping screen the OEM points a robot at (/display/<code>).
export type DisplayStatus = 'active' | 'paused';

export interface CustomDisplayItem {
  id?: string;
  media_url: string;
  media_type: 'image' | 'video';
  // Seconds an image is shown; null => use the display default. Videos ignore it.
  duration_seconds: number | null;
  position?: number;
}

export interface CustomDisplay {
  id: string;
  code: string;
  public_path: string; // e.g. "/display/abc123"
  name: string;
  advertiser_name: string | null;
  fleet_id: string | null;
  status: DisplayStatus;
  default_image_seconds: number;
  item_count?: number;
  items?: CustomDisplayItem[];
  created_at: string;
  updated_at: string;
}
