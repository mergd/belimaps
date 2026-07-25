/** Types aligned with openapi/beli.yaml schemas. */

export type Uuid = string;
export type IntId = number;
export type PlaceId = string;
export type Category = "RES" | "BAR" | "COFFEE" | "BAKERY" | "DESSERT" | "OTHER" | "BAK";

export interface LoginRequest {
  phone_no: string;
  password: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
}

export interface RefreshResponse {
  access: string;
}

export interface LoggedInUser {
  id: Uuid;
  username: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  phone_no?: string;
  email?: string | null;
  home_city?: string | null;
  profile_photo?: string | null;
  [key: string]: unknown;
}

export interface LoggedInResponse {
  results: LoggedInUser[];
}

export interface Business {
  id: IntId;
  place_id?: string | null;
  name: string;
  status?: string;
  city?: string | null;
  borough?: string | null;
  neighborhood?: string | null;
  country?: string | null;
  lat?: number | null;
  lng?: number | null;
  price?: number | null;
  price_key?: string | null;
  website?: string | null;
  phone_number?: string | null;
  cuisines?: string[];
  quick_link?: string | null;
  tz?: string | null;
  default_category?: string;
  summary?: string | null;
  [key: string]: unknown;
}

export type BusinessResponse = { results: Business[] } | Business;

export interface SearchPrediction {
  place_id: PlaceId;
  business?: number | null;
  distance_meters?: number | null;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  [key: string]: unknown;
}

export interface SearchResponse {
  predictions: SearchPrediction[];
}

export interface MemberSummary {
  id: Uuid;
  username: string;
  full_name?: string | null;
  first_name?: string;
  last_name?: string;
  profile_photo?: string | null;
  photo?: string | null;
  [key: string]: unknown;
}

export interface MemberListResponse {
  results: MemberSummary[];
}

export interface NetworkScore {
  user_id: Uuid;
  business_id: IntId;
  value: number;
  category: string;
  num_visits?: number;
  labels?: string[];
  [key: string]: unknown;
}

export interface RecItem {
  business_id: IntId;
  expected_percentile: number;
}

export interface RankingListItem {
  id: IntId;
  user: Uuid;
  business: Business;
  score?: number | null;
  value?: number | null;
  category?: string;
  visit_dates?: string[];
  created_dt?: string;
  [key: string]: unknown;
}

export interface RankingListResponse {
  results: RankingListItem[];
}

export interface Session {
  access: string;
  refresh: string;
  userId: string;
  accessExp: number;
}

export interface FriendPhoto {
  id: number;
  image: string | null;
  thumbnail: string | null;
  description: string | null;
}

export interface FriendScore {
  userId: string;
  username: string;
  fullName: string;
  profilePhoto: string | null;
  score: number;
  category: string;
  /** Dish captions / photo descriptions — closest thing to review copy. */
  note: string | null;
  photos: FriendPhoto[];
}

export interface UserBusinessPhoto {
  id: number;
  image?: string | null;
  thumbnail?: string | null;
  bb_image?: string | null;
  bb_thumbnail?: string | null;
  description?: string | null;
  order?: number | null;
  status?: string | null;
  user?: string;
  business?: number;
  [key: string]: unknown;
}

export interface PhotoListResponse {
  results: UserBusinessPhoto[] | UserBusinessPhoto;
}

export interface PlaceOverlay {
  placeId: string;
  businessId: number;
  businessName: string;
  neighborhood?: string | null;
  /** Business blurb from Beli (closest thing we have to a global summary). */
  summary?: string | null;
  /** Your Been score for this business, if ranked. */
  myScore: number | null;
  /** 1-based rank on your Been list (highest score = #1). */
  myRank: number | null;
  /** Total restaurants on your Been list. */
  myRankTotal: number | null;
  /** Personalized suggested score from /api/recs (expected_percentile). */
  suggestedScore: number | null;
  friends: FriendScore[];
  /** Average of friend scores for this business. */
  avgScore: number | null;
  /** Community average when available. */
  communityScore: number | null;
  /** Total people who ranked this spot (community). */
  communityCount: number | null;
}

export type OverlayResult =
  | { ok: true; data: PlaceOverlay }
  | { ok: false; error: "unauthenticated" | "not_found" | "rate_limited" | "error"; message: string };
