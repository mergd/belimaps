import { BeliApiError, BeliClient } from "../beli/client";
import { businessMatchesAddress, pickSearchPrediction } from "../beli/match";
import { placeCacheKey, TtlLruCache } from "../shared/placeCache";
import type {
  Business,
  FriendPhoto,
  FriendScore,
  MemberSummary,
  NetworkScore,
  OverlayResult,
  PlaceOverlay,
  RankingListItem,
  RecItem,
  UserBusinessPhoto,
} from "../beli/types";

const SCORES_TTL_MS = 60 * 60 * 1000;
const PLACE_TTL_MS = 45 * 60 * 1000;
const NOT_FOUND_TTL_MS = 10 * 60 * 1000;
const PHOTOS_TTL_MS = 45 * 60 * 1000;
/** Cap photo fan-out per place to stay under rate limits. */
const MAX_FRIEND_PHOTO_FETCHES = 8;
const MAX_PHOTOS_PER_FRIEND = 6;

interface CacheEntry<T> {
  at: number;
  value: T;
}

function photoUrl(p: UserBusinessPhoto): string | null {
  return p.thumbnail || p.bb_thumbnail || p.image || p.bb_image || null;
}

function photoFullUrl(p: UserBusinessPhoto): string | null {
  return p.image || p.bb_image || p.thumbnail || p.bb_thumbnail || null;
}

function toFriendPhotos(list: UserBusinessPhoto[]): FriendPhoto[] {
  return list
    .slice()
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .slice(0, MAX_PHOTOS_PER_FRIEND)
    .map((p) => ({
      id: p.id,
      image: photoFullUrl(p),
      thumbnail: photoUrl(p),
      description: typeof p.description === "string" && p.description.trim() ? p.description.trim() : null,
    }))
    .filter((p) => p.thumbnail || p.image);
}

export class OverlayService {
  private scoresCache: CacheEntry<NetworkScore[]> | null = null;
  private followingCache: CacheEntry<Map<string, MemberSummary>> | null = null;
  private myScoresCache: CacheEntry<{
    byId: Map<number, RankingListItem>;
    order: number[];
  }> | null = null;
  private recsCache: CacheEntry<Map<number, number>> | null = null;
  private placeCache = new TtlLruCache<PlaceOverlay>(PLACE_TTL_MS, 60);
  private notFoundCache = new TtlLruCache<true>(NOT_FOUND_TTL_MS, 80);
  private photoCache = new TtlLruCache<FriendPhoto[]>(PHOTOS_TTL_MS, 200);
  private placeInFlight = new Map<string, Promise<OverlayResult>>();
  private scoresInFlight: Promise<NetworkScore[]> | null = null;
  private followingInFlight: Promise<Map<string, MemberSummary>> | null = null;
  private myScoresInFlight: Promise<{
    byId: Map<number, RankingListItem>;
    order: number[];
  }> | null = null;
  private recsInFlight: Promise<Map<number, number>> | null = null;

  constructor(private client: BeliClient) {}

  clearCaches(): void {
    this.scoresCache = null;
    this.followingCache = null;
    this.myScoresCache = null;
    this.recsCache = null;
    this.placeCache.clear();
    this.notFoundCache.clear();
    this.photoCache.clear();
    this.placeInFlight.clear();
    this.scoresInFlight = null;
    this.followingInFlight = null;
    this.myScoresInFlight = null;
    this.recsInFlight = null;
  }

  async getPlaceOverlay(
    placeId: string,
    placeName?: string,
    coords?: string,
    address?: string,
  ): Promise<OverlayResult> {
    if (!this.client.isAuthenticated()) {
      return {
        ok: false,
        error: "unauthenticated",
        message: "Sign in with Beli to see friend scores.",
      };
    }

    const key = placeCacheKey({ placeId, placeName, address });
    const cached =
      this.placeCache.get(key) ??
      (placeId.startsWith("ChIJ")
        ? this.placeCache.get(placeCacheKey({ placeId }))
        : null);
    if (cached) return { ok: true, data: cached };
    if (this.notFoundCache.get(key)) {
      return {
        ok: false,
        error: "not_found",
        message: "This place isn’t on Beli yet.",
      };
    }

    const existing = this.placeInFlight.get(key);
    if (existing) return existing;

    const pending = this.fetchPlaceOverlay(placeId, placeName, coords, address, key).finally(
      () => {
        this.placeInFlight.delete(key);
      },
    );
    this.placeInFlight.set(key, pending);
    return pending;
  }

  private async fetchPlaceOverlay(
    placeId: string,
    placeName: string | undefined,
    coords: string | undefined,
    address: string | undefined,
    key: string,
  ): Promise<OverlayResult> {
    try {
      const business = await this.resolveBusiness(placeId, placeName, coords, address);
      const [scores, following, myScores, recs] = await Promise.all([
        this.getScores(),
        this.getFollowingMap(),
        this.getMyScores(),
        this.getRecsMap(),
      ]);

      const friendsBase: FriendScore[] = scores
        .filter((s) => s.business_id === business.id)
        .map((s) => {
          const member = following.get(s.user_id);
          return {
            userId: s.user_id,
            username: member?.username ?? s.user_id.slice(0, 8),
            fullName:
              member?.full_name ||
              [member?.first_name, member?.last_name].filter(Boolean).join(" ") ||
              member?.username ||
              "Friend",
            profilePhoto: member?.profile_photo || member?.photo || null,
            score: s.value,
            category: s.category,
            note: null,
            photos: [],
          };
        })
        .sort((a, b) => b.score - a.score);

      const friends = await this.enrichFriendsWithPhotos(friendsBase, business.id);
      const community = await this.client.getAverageScore(business.id);

      const mine = myScores.byId.get(business.id);
      const myScore =
        typeof mine?.score === "number"
          ? mine.score
          : typeof mine?.value === "number"
            ? mine.value
            : null;
      const rankIndex = myScores.order.indexOf(business.id);
      const myRank = rankIndex >= 0 ? rankIndex + 1 : null;
      const myRankTotal = myScores.order.length > 0 ? myScores.order.length : null;
      const suggestedScore = recs.get(business.id) ?? null;

      const avgScore =
        friends.length > 0
          ? friends.reduce((sum, f) => sum + f.score, 0) / friends.length
          : null;

      const data: PlaceOverlay = {
        placeId: business.place_id || placeId,
        businessId: business.id,
        businessName: business.name,
        neighborhood: business.neighborhood ?? null,
        summary: typeof business.summary === "string" ? business.summary : null,
        myScore,
        myRank,
        myRankTotal,
        suggestedScore,
        friends,
        avgScore,
        communityScore: community?.average ?? null,
        communityCount: community?.count ?? null,
      };

      this.placeCache.set(key, data);
      if (business.place_id) {
        this.placeCache.set(placeCacheKey({ placeId: business.place_id }), data);
      }
      return { ok: true, data };
    } catch (err) {
      if (err instanceof BeliApiError) {
        if (err.status === 401) {
          return {
            ok: false,
            error: "unauthenticated",
            message: "Session expired. Sign in again.",
          };
        }
        if (err.status === 429) {
          return {
            ok: false,
            error: "rate_limited",
            message: "Beli rate-limited us. Try again in a bit.",
          };
        }
        if (err.status === 400 || err.status === 404) {
          this.notFoundCache.set(key, true);
          return {
            ok: false,
            error: "not_found",
            message: "This place isn’t on Beli yet.",
          };
        }
      }
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: "error", message };
    }
  }

  /**
   * Matching order:
   * 1) Exact Google ChIJ place_id → /api/business/?place_id= (only if address agrees)
   * 2) Beli search-app by name + coords; prefer place_id, then address overlap, then distance
   */
  private async resolveBusiness(
    placeId: string,
    placeName?: string,
    coords?: string,
    address?: string,
  ): Promise<Business> {
    let byPlaceId: Business | null = null;
    if (placeId.startsWith("ChIJ")) {
      try {
        byPlaceId = await this.client.businessByPlaceId(placeId);
      } catch {
        byPlaceId = null;
      }
    }

    if (byPlaceId && businessMatchesAddress(byPlaceId, address ?? "")) {
      return byPlaceId;
    }

    const term = (placeName ?? "").replace(/^name:/, "").trim();
    if (!term) {
      if (byPlaceId) return byPlaceId;
      return this.client.businessByPlaceId(placeId);
    }

    const search = await this.client.searchPlaces(term, "", coords ?? " ");
    const pick = pickSearchPrediction(search.predictions, {
      placeId: placeId.startsWith("ChIJ") ? placeId : null,
      placeName: term,
      address,
    });

    if (pick?.business != null) {
      return this.client.businessById(pick.business);
    }
    if (pick?.place_id) {
      return this.client.businessByPlaceId(pick.place_id);
    }

    if (byPlaceId) return byPlaceId;
    throw new BeliApiError(404, "searchPlaces", `no Beli match for ${term}`);
  }

  private async getScores(): Promise<NetworkScore[]> {
    if (this.scoresCache && Date.now() - this.scoresCache.at < SCORES_TTL_MS) {
      return this.scoresCache.value;
    }
    if (this.scoresInFlight) return this.scoresInFlight;
    this.scoresInFlight = this.client
      .getNetworkScores()
      .then((value) => {
        this.scoresCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        this.scoresInFlight = null;
      });
    return this.scoresInFlight;
  }

  private async getFollowingMap(): Promise<Map<string, MemberSummary>> {
    if (this.followingCache && Date.now() - this.followingCache.at < SCORES_TTL_MS) {
      return this.followingCache.value;
    }
    if (this.followingInFlight) return this.followingInFlight;
    this.followingInFlight = this.client
      .getFollowing()
      .then((res) => {
        const map = new Map<string, MemberSummary>();
        for (const m of res.results ?? []) map.set(m.id, m);
        this.followingCache = { at: Date.now(), value: map };
        return map;
      })
      .finally(() => {
        this.followingInFlight = null;
      });
    return this.followingInFlight;
  }

  private async getMyScores(): Promise<{
    byId: Map<number, RankingListItem>;
    order: number[];
  }> {
    if (this.myScoresCache && Date.now() - this.myScoresCache.at < SCORES_TTL_MS) {
      return this.myScoresCache.value;
    }
    if (this.myScoresInFlight) return this.myScoresInFlight;
    this.myScoresInFlight = this.client
      .getRanking("RES")
      .then((res) => {
        const byId = new Map<number, RankingListItem>();
        const order: number[] = [];
        // API returns Been list high→low; preserve that for #N rank.
        for (const item of res.results ?? []) {
          const id = item.business?.id;
          if (typeof id !== "number") continue;
          byId.set(id, item);
          order.push(id);
        }
        const value = { byId, order };
        this.myScoresCache = { at: Date.now(), value };
        return value;
      })
      .finally(() => {
        this.myScoresInFlight = null;
      });
    return this.myScoresInFlight;
  }

  private async getRecsMap(): Promise<Map<number, number>> {
    if (this.recsCache && Date.now() - this.recsCache.at < SCORES_TTL_MS) {
      return this.recsCache.value;
    }
    if (this.recsInFlight) return this.recsInFlight;
    this.recsInFlight = this.client
      .getRecs()
      .then((items: RecItem[]) => {
        const map = new Map<number, number>();
        for (const item of items) {
          map.set(item.business_id, item.expected_percentile);
        }
        this.recsCache = { at: Date.now(), value: map };
        return map;
      })
      .finally(() => {
        this.recsInFlight = null;
      });
    return this.recsInFlight;
  }

  private async enrichFriendsWithPhotos(
    friends: FriendScore[],
    businessId: number,
  ): Promise<FriendScore[]> {
    if (friends.length === 0) return friends;

    const head = friends.slice(0, MAX_FRIEND_PHOTO_FETCHES);
    const tail = friends.slice(MAX_FRIEND_PHOTO_FETCHES);
    const enriched = await Promise.all(
      head.map(async (f) => {
        const photos = await this.getFriendPhotos(f.userId, businessId);
        const captions = photos
          .map((p) => p.description)
          .filter((d): d is string => Boolean(d));
        return {
          ...f,
          photos,
          note: captions.length > 0 ? captions.join(" · ") : null,
        };
      }),
    );
    return [...enriched, ...tail];
  }

  private async getFriendPhotos(userId: string, businessId: number): Promise<FriendPhoto[]> {
    const key = `${userId}|${businessId}`;
    const cached = this.photoCache.get(key);
    if (cached) return cached;
    try {
      const raw = await this.client.listUserBusinessPhotos(userId, businessId);
      const photos = toFriendPhotos(raw);
      this.photoCache.set(key, photos);
      return photos;
    } catch {
      this.photoCache.set(key, []);
      return [];
    }
  }
}
