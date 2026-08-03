import { HOSTS, META, type HostKey } from "./hosts";
import { clearSession, loadSession, saveCachedUser, saveSession } from "./session";
import type {
  Business,
  BusinessResponse,
  LoggedInResponse,
  LoggedInUser,
  LoginRequest,
  MemberListResponse,
  NetworkScore,
  PhotoListResponse,
  RankingListResponse,
  RecItem,
  RefreshResponse,
  SearchResponse,
  Session,
  TokenPair,
  UserBusinessPhoto,
} from "./types";

export class BeliApiError extends Error {
  constructor(
    readonly status: number,
    readonly endpoint: string,
    readonly body: string,
  ) {
    super(`Beli API ${endpoint} → ${status}: ${body.slice(0, 300)}`);
    this.name = "BeliApiError";
  }
}

function baseHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    Origin: META.requiredHeaders.Origin,
    Referer: META.requiredHeaders.Referer,
    "User-Agent": META.userAgent,
  };
}

function buildUrl(
  host: HostKey,
  path: string,
  query?: Record<string, string | number | boolean | undefined | null>,
): string {
  const url = new URL(HOSTS[host] + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function readAccessExp(access: string): number {
  try {
    const payload = access.split(".")[1];
    if (!payload) return 0;
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
      user_id?: string;
    };
    return json.exp ?? 0;
  } catch {
    return 0;
  }
}

function readUserId(access: string): string | null {
  try {
    const payload = access.split(".")[1];
    if (!payload) return null;
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/"))) as {
      user_id?: string;
    };
    return json.user_id ?? null;
  } catch {
    return null;
  }
}

function normalizeBusiness(res: BusinessResponse): Business {
  if ("results" in res && Array.isArray(res.results)) {
    const first = res.results[0];
    if (!first) throw new BeliApiError(404, "getBusiness", "empty results");
    return first;
  }
  return res as Business;
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Best-effort parse for /api/average-score/ shapes once the route stops 500ing. */
export function parseAverageScore(
  res: unknown,
  businessId: number,
): { average: number; count: number | null } | null {
  if (res == null) return null;

  const fromObj = (obj: Record<string, unknown>) => {
    const average =
      asNumber(obj.average) ??
      asNumber(obj.avg) ??
      asNumber(obj.score) ??
      asNumber(obj.value) ??
      asNumber(obj.mean);
    if (average == null) return null;
    const count =
      asNumber(obj.count) ??
      asNumber(obj.num_ratings) ??
      asNumber(obj.rating_count) ??
      asNumber(obj.num_ranks) ??
      asNumber(obj.rank_count) ??
      asNumber(obj.total) ??
      asNumber(obj.n);
    return { average, count };
  };

  if (Array.isArray(res)) {
    for (const item of res) {
      if (!item || typeof item !== "object") continue;
      const obj = item as Record<string, unknown>;
      const id = asNumber(obj.business_id) ?? asNumber(obj.business) ?? asNumber(obj.id);
      if (id != null && id !== businessId) continue;
      const parsed = fromObj(obj);
      if (parsed) return parsed;
    }
    return null;
  }

  if (typeof res !== "object") return null;
  const root = res as Record<string, unknown>;

  if (Array.isArray(root.results)) {
    return parseAverageScore(root.results, businessId);
  }

  return fromObj(root);
}

export class BeliClient {
  private session: Session | null = null;
  private lastCall = 0;
  private refreshInFlight: Promise<void> | null = null;

  async init(): Promise<void> {
    this.session = await loadSession();
  }

  get userId(): string | null {
    return this.session?.userId ?? null;
  }

  isAuthenticated(): boolean {
    return Boolean(this.session?.access || this.session?.refresh);
  }

  /**
   * Ensure we have a usable access token — refresh if missing/stale.
   * Returns false only when there is no session or refresh was rejected.
   * Transient network errors still return true if tokens exist so callers
   * aren't bounced to "Sign in" on a blip.
   */
  async ensureFreshAuth(): Promise<boolean> {
    if (!this.session) this.session = await loadSession();
    if (!this.session?.refresh && !this.session?.access) {
      return false;
    }
    try {
      await this.ensureAuth();
      return true;
    } catch (err) {
      if (err instanceof BeliApiError && (err.status === 401 || err.status === 400)) {
        return false;
      }
      return Boolean(this.session?.access || this.session?.refresh);
    }
  }

  async login(creds: LoginRequest): Promise<Session> {
    const tok = await this.rawRequest<TokenPair>("ONBOARD", "/api/token/", {
      method: "POST",
      body: creds,
      auth: false,
    });
    const userId = readUserId(tok.access);
    if (!userId) throw new Error("login response missing user_id claim");
    this.session = {
      access: tok.access,
      refresh: tok.refresh,
      userId,
      accessExp: readAccessExp(tok.access),
    };
    await saveSession(this.session);
    return this.session;
  }

  async logout(): Promise<void> {
    this.session = null;
    await clearSession();
  }

  async me(): Promise<LoggedInUser> {
    await this.ensureAuth();
    const res = await this.request<LoggedInResponse>("ONBOARD", "/api/user/logged-in/");
    const user = res.results[0];
    if (!user) throw new Error("logged-in returned no user");
    await saveCachedUser(user);
    return user;
  }

  async searchPlaces(term: string, city = "", coords = " "): Promise<SearchResponse> {
    await this.ensureAuth();
    return this.request("API", "/api/search-app/", {
      query: { term, city, coords, user: this.requireUserId() },
    });
  }

  async businessByPlaceId(placeId: string): Promise<Business> {
    await this.ensureAuth();
    const res = await this.request<BusinessResponse>("API", "/api/business/", {
      query: { place_id: placeId, from_business_page: "true" },
    });
    return normalizeBusiness(res);
  }

  async businessById(id: number): Promise<Business> {
    await this.ensureAuth();
    const res = await this.request<BusinessResponse>("API", "/api/business/", {
      query: { id, from_business_page: "true" },
    });
    return normalizeBusiness(res);
  }

  async getFollowing(userId?: string): Promise<MemberListResponse> {
    await this.ensureAuth();
    const id = userId ?? this.requireUserId();
    return this.request("API", `/api/following/${id}/`);
  }

  async getFollowers(userId?: string): Promise<MemberListResponse> {
    await this.ensureAuth();
    const id = userId ?? this.requireUserId();
    return this.request("API", `/api/followers/${id}/`);
  }

  async getNetworkScores(userId?: string): Promise<NetworkScore[]> {
    await this.ensureAuth();
    const id = userId ?? this.requireUserId();
    return this.request("API", `/api/scores/${id}/`);
  }

  async getRecs(userId?: string): Promise<RecItem[]> {
    await this.ensureAuth();
    const id = userId ?? this.requireUserId();
    return this.request("RECS", `/api/recs/${id}/`);
  }

  async getRanking(category = "RES", userId?: string): Promise<RankingListResponse> {
    await this.ensureAuth();
    return this.request("API", "/api/get-ranking/", {
      query: { user: userId ?? this.requireUserId(), category },
    });
  }

  /** Photos (+ dish captions) a user posted for a business. */
  async listUserBusinessPhotos(
    userId: string,
    businessId: number,
  ): Promise<UserBusinessPhoto[]> {
    await this.ensureAuth();
    const res = await this.request<PhotoListResponse>("API", "/api/user-business-photo/", {
      query: { user: userId, business: businessId },
    });
    const raw = res.results;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return list.filter((p) => (p.status ?? "ACTIVE") !== "DELETED");
  }

  /**
   * Community average + rating count for a business.
   * Endpoint exists but has been 500ing (2026-07-24); returns null when broken.
   */
  async getAverageScore(
    businessId: number,
  ): Promise<{ average: number; count: number | null } | null> {
    await this.ensureAuth();
    try {
      const res = await this.request<unknown>("API", "/api/average-score/", {
        query: { business: businessId },
      });
      return parseAverageScore(res, businessId);
    } catch (err) {
      if (err instanceof BeliApiError && (err.status === 500 || err.status === 404)) {
        return null;
      }
      throw err;
    }
  }

  private requireUserId(): string {
    if (!this.session?.userId) throw new Error("not authenticated");
    return this.session.userId;
  }

  private async ensureAuth(): Promise<void> {
    if (!this.session) this.session = await loadSession();
    if (!this.session?.refresh && !this.session?.access) {
      throw new BeliApiError(401, "auth", "not authenticated");
    }
    const exp = this.session.accessExp || readAccessExp(this.session.access);
    if (!this.session.access || exp * 1000 < Date.now() + META.accessSkewMs) {
      await this.refreshAccess();
    }
  }

  private async refreshAccess(): Promise<void> {
    if (this.refreshInFlight) return this.refreshInFlight;
    this.refreshInFlight = (async () => {
      if (!this.session?.refresh) throw new BeliApiError(401, "refresh", "no refresh token");
      try {
        const res = await this.rawRequest<RefreshResponse>("ONBOARD", "/api/token/refresh/", {
          method: "POST",
          body: { refresh: this.session.refresh },
          auth: false,
        });
        this.session = {
          ...this.session,
          access: res.access,
          accessExp: readAccessExp(res.access),
        };
        await saveSession(this.session);
      } catch (err) {
        if (err instanceof BeliApiError && (err.status === 401 || err.status === 400)) {
          await this.logout();
        }
        throw err;
      } finally {
        this.refreshInFlight = null;
      }
    })();
    return this.refreshInFlight;
  }

  private async throttle(): Promise<void> {
    const wait = this.lastCall + META.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.lastCall = Date.now();
  }

  private async request<T>(
    host: HostKey,
    path: string,
    opts: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    await this.throttle();
    try {
      return await this.rawRequest<T>(host, path, { ...opts, auth: true });
    } catch (err) {
      if (err instanceof BeliApiError && err.status === 401) {
        await this.refreshAccess();
        return this.rawRequest<T>(host, path, { ...opts, auth: true });
      }
      throw err;
    }
  }

  private async rawRequest<T>(
    host: HostKey,
    path: string,
    opts: {
      method?: string;
      query?: Record<string, string | number | boolean | undefined | null>;
      body?: unknown;
      auth?: boolean;
    },
  ): Promise<T> {
    const headers = baseHeaders();
    if (opts.auth !== false && this.session?.access) {
      headers.Authorization = `Bearer ${this.session.access}`;
    }
    const init: RequestInit = { method: opts.method ?? "GET", headers };
    if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(opts.body);
    }
    const res = await fetch(buildUrl(host, path, opts.query), init);
    const text = await res.text();
    if (!res.ok) throw new BeliApiError(res.status, path, text);
    return (text ? JSON.parse(text) : {}) as T;
  }
}
