/** Tiny TTL LRU for place overlays (content + service worker). */

export interface TimedEntry<T> {
  at: number;
  value: T;
}

export class TtlLruCache<T> {
  private map = new Map<string, TimedEntry<T>>();

  constructor(
    private ttlMs: number,
    private maxSize = 40,
  ) {}

  get(key: string): T | null {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (Date.now() - entry.at >= this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    // refresh LRU order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.map.delete(key);
    this.map.set(key, { at: Date.now(), value });
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value;
      if (oldest == null) break;
      this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/** Bump when overlay payload shape changes (invalidates stale content/SW caches). */
const CACHE_VERSION = "v2";

/** Stable key — prefer ChIJ; fall back to name+address (ignore volatile map coords). */
export function placeCacheKey(opts: {
  placeId: string;
  placeName?: string | null;
  address?: string | null;
}): string {
  const id = opts.placeId.trim();
  if (id.startsWith("ChIJ")) return `${CACHE_VERSION}:${id}`;
  const name = (opts.placeName ?? "").replace(/^name:/, "").trim().toLowerCase();
  const address = (opts.address ?? "").trim().toLowerCase();
  return `${CACHE_VERSION}:name:${name}|${address}`;
}
