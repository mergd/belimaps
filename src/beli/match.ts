import type { Business, SearchPrediction } from "./types";

export function parseCoords(coords?: string | null): { lat: number; lng: number } | null {
  if (!coords) return null;
  const m = coords.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (!m) return null;
  return { lat: Number(m[1]), lng: Number(m[2]) };
}

function normName(s: string): string {
  return s
    .toLowerCase()
    .replace(/^name:/, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Tokens useful for address matching: street numbers, zip, significant words. */
export function addressTokens(s: string): string[] {
  return normName(s)
    .split(" ")
    .filter((t) => t.length > 1)
    .filter((t) => !STOP.has(t));
}

const STOP = new Set([
  "san",
  "francisco",
  "ca",
  "usa",
  "united",
  "states",
  "st",
  "street",
  "ste",
  "suite",
  "ave",
  "avenue",
  "blvd",
  "road",
  "rd",
  "dr",
  "drive",
  "fl",
  "floor",
  "the",
  "and",
  "of",
]);

/** Higher is better. Street numbers / zips weigh more than soft words. */
export function scoreAddressOverlap(mapsAddress: string, candidate: string): number {
  const want = addressTokens(mapsAddress);
  if (!want.length) return 0;
  const have = new Set(addressTokens(candidate));
  let score = 0;
  for (const t of want) {
    if (!have.has(t)) continue;
    if (/^\d+$/.test(t)) score += t.length >= 5 ? 8 : 5; // zip vs street #
    else score += 1;
  }
  return score;
}

export function businessMatchesAddress(business: Business, mapsAddress: string): boolean {
  if (!mapsAddress.trim()) return true;
  const blob = [
    business.neighborhood,
    business.borough,
    business.city,
    typeof business.address === "string" ? business.address : "",
    typeof business.street === "string" ? business.street : "",
  ]
    .filter(Boolean)
    .join(" ");
  // Soft: any numeric token overlap (street # / zip) is enough to trust place_id.
  const score = scoreAddressOverlap(mapsAddress, blob);
  if (score >= 5) return true;
  // No address fields on business — can't confirm; treat as unmatched so search can win.
  if (!blob.trim()) return false;
  return false;
}

/**
 * Pick the best Beli search prediction for a Maps place.
 * Prefer exact Google place_id, then address overlap, then exact name + distance.
 */
export function pickSearchPrediction(
  predictions: SearchPrediction[],
  opts: {
    placeId?: string | null;
    placeName?: string | null;
    address?: string | null;
  },
): SearchPrediction | null {
  if (!predictions.length) return null;

  const placeId = opts.placeId?.startsWith("ChIJ") ? opts.placeId : null;
  if (placeId) {
    const byId = predictions.find((p) => p.place_id === placeId);
    if (byId) return byId;
  }

  const want = opts.placeName ? normName(opts.placeName) : "";
  const address = opts.address?.trim() ?? "";

  const scored = predictions.map((p, index) => {
    const main = normName(p.structured_formatting?.main_text ?? "");
    const secondary = p.structured_formatting?.secondary_text ?? "";
    const exactName = want && main === want ? 0 : want && main.includes(want) ? 1 : 2;
    const addressScore = address ? scoreAddressOverlap(address, secondary) : 0;
    const distance =
      typeof p.distance_meters === "number" ? p.distance_meters : Number.POSITIVE_INFINITY;
    return { p, exactName, addressScore, distance, index };
  });

  scored.sort((a, b) => {
    // Strong address hit (street # / zip) beats name order.
    if (a.addressScore !== b.addressScore) return b.addressScore - a.addressScore;
    if (a.exactName !== b.exactName) return a.exactName - b.exactName;
    if (a.distance !== b.distance) return a.distance - b.distance;
    return a.index - b.index;
  });

  return scored[0]?.p ?? null;
}
