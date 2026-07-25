/** Extract Google place_id from a Maps place URL or page state. */

const CHIJ_RE = /ChIJ[\w-]+/;
const DATA_PLACE_RE = /!1s(0x[\da-f]+:0x[\da-f]+)/i;
const PLACE_PATH_RE = /\/maps\/place\//i;

export function isPlaceUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return PLACE_PATH_RE.test(u.pathname + u.search);
  } catch {
    return false;
  }
}

export function extractPlaceIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const href = u.href;

    const chij = href.match(CHIJ_RE);
    if (chij) return chij[0];

    // Maps often encodes place as !1s0x…:0x… — Beli wants ChIJ-style when possible.
    // Fall through to DOM/meta extraction for ChIJ.
    const data = href.match(DATA_PLACE_RE);
    if (data?.[1]) return data[1];

    return null;
  } catch {
    return null;
  }
}

export function extractPlaceNameFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const match = u.pathname.match(/\/maps\/place\/([^/]+)/);
    if (!match?.[1]) return null;
    return decodeURIComponent(match[1].replace(/\+/g, " "));
  } catch {
    return null;
  }
}

/** Best-effort ChIJ from the open place panel DOM. */
export function extractPlaceIdFromDom(root: ParentNode = document): string | null {
  const links = root.querySelectorAll<HTMLAnchorElement>('a[href*="ChIJ"], a[href*="/maps/place/"]');
  for (const a of links) {
    const fromHref = extractPlaceIdFromUrl(a.href);
    if (fromHref?.startsWith("ChIJ")) return fromHref;
  }

  const meta = root.querySelector('meta[property="og:url"], link[rel="canonical"]');
  if (meta) {
    const content =
      meta.getAttribute("content") || meta.getAttribute("href") || "";
    const id = extractPlaceIdFromUrl(content);
    if (id?.startsWith("ChIJ")) return id;
  }

  return extractPlaceIdFromUrl(location.href);
}

export function extractPlaceHeading(root: ParentNode = document): string | null {
  const h1 = root.querySelector("h1");
  const text = h1?.textContent?.trim();
  return text || extractPlaceNameFromUrl(location.href);
}
