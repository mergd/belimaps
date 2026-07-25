import { extractPlaceHeading, extractPlaceIdFromDom, isPlaceUrl } from "./placeId";
import { extractPlaceCategory, shouldShowBeliForPlace } from "./category";

export interface PlaceContext {
  placeId: string;
  placeName: string | null;
  coords: string | null;
  address: string | null;
  category: string | null;
}

export type SlotKind = "scores" | "summary" | "friends";

export interface OverlaySlots {
  scores: HTMLElement | null;
  summary: HTMLElement | null;
  friends: HTMLElement | null;
}

export interface SlotEnsureResult {
  slots: OverlaySlots;
  changed: boolean;
}

const SLOT_ATTR = "data-beli-maps-slot";
const PLACED_ATTR = "data-beli-placed";

type Listener = (ctx: PlaceContext | null) => void;

function extractCoordsFromUrl(url: string): string | null {
  const m = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (!m) return null;
  return `${m[1]},${m[2]}`;
}

function looksLikeAddress(text: string): boolean {
  const t = text.trim();
  if (t.length < 8 || t.length > 160) return false;
  return /^\d+\s+\w+/.test(t) || /\b\d{5}(?:-\d{4})?\b/.test(t);
}

function isVisible(el: Element): boolean {
  const r = (el as HTMLElement).getBoundingClientRect?.();
  return Boolean(r && r.width > 0 && r.height > 0);
}

function isInTabChrome(el: Element): boolean {
  return Boolean(
    el.closest('[role="tablist"], [role="tab"], [role="tabpanel"]') ||
      el.getAttribute("role") === "tab" ||
      el.getAttribute("role") === "tablist",
  );
}

function isInSearchResults(el: Element): boolean {
  // Only the list feed — not a floating place card that may use role=article.
  return Boolean(el.closest('[role="feed"]'));
}

/** Closest place-pane root for a title (floating card or docked sidebar). */
function placeRootFor(h1: HTMLElement): HTMLElement {
  const main = h1.closest<HTMLElement>('[role="main"]');
  if (main && !main.querySelector('[role="feed"]')) return main;

  let root: HTMLElement = h1;
  for (let i = 0; i < 10 && root.parentElement; i++) {
    root = root.parentElement;
    const r = root.getBoundingClientRect();
    if (r.width > 280 && r.height > 320) break;
  }
  return root;
}

export function findPlaceDetailH1(): HTMLElement | null {
  const scored: { h1: HTMLElement; score: number; x: number }[] = [];

  for (const h1 of document.querySelectorAll<HTMLElement>("h1")) {
    if (!isVisible(h1) || isInTabChrome(h1)) continue;
    // Ignore list feeds (Results / Recents) — keep floating place cards.
    if (h1.closest('[role="feed"]')) continue;

    const title = (h1.textContent || "").replace(/\s+/g, " ").trim();
    if (!title || /^(Results|Recents|Saved)$/i.test(title)) continue;

    const root = placeRootFor(h1);
    if (root.querySelector(':scope > [role="feed"], [role="feed"][aria-label*="Results" i]')) {
      // List sidebar main that also wraps a feed — not a place card.
      if (!root.querySelector('[data-value="Directions"]')) continue;
    }

    const hasDirections = Boolean(
      root.querySelector(
        '[data-value="Directions"], button[aria-label*="Directions" i], button[aria-label*="Direction" i]',
      ),
    );
    const tablist = root.querySelector('[role="tablist"]');
    const tabText = (tablist?.textContent || "").replace(/\s+/g, " ");
    // Floating cards often show Overview/About (or Menu) before Reviews paints.
    const hasPlaceTabs =
      /\bOverview\b/i.test(tabText) &&
      /\b(Reviews|About|Menu)\b/i.test(tabText);

    let score = 0;
    if (hasDirections) score += 3;
    if (hasPlaceTabs) score += 2;
    if (root.querySelector('[data-item-id="address"]')) score += 1;
    if (root.getAttribute("aria-label") === title) score += 1;
    if (score === 0 && isPlaceUrl(location.href)) score += 1;
    if (score === 0) continue;

    scored.push({ h1, score, x: h1.getBoundingClientRect().x });
  }

  // Prefer the strongest place chrome; on ties, prefer the card to the right of Recents/Results.
  scored.sort((a, b) => b.score - a.score || b.x - a.x);
  return scored[0]?.h1 ?? null;
}

export function findPlaceDetailRoot(): HTMLElement | null {
  const h1 = findPlaceDetailH1();
  if (!h1) return null;
  return placeRootFor(h1);
}

export function extractPlaceAddress(root: ParentNode = document): string | null {
  const byItem = root.querySelector<HTMLElement>(
    'button[data-item-id="address"], [data-item-id="address"]',
  );
  if (byItem && !isInSearchResults(byItem)) {
    const labeled =
      byItem.getAttribute("aria-label") ||
      byItem.getAttribute("data-tooltip") ||
      byItem.textContent ||
      "";
    const cleaned = labeled
      .replace(/^(Address:\s*)/i, "")
      .replace(/\s*·\s*.*$/, "")
      .trim();
    if (looksLikeAddress(cleaned)) return cleaned;
  }
  return null;
}

export function watchPlacePanel(onChange: Listener): () => void {
  let lastKey = "";
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const emit = () => {
    const h1 = findPlaceDetailH1();

    // Prefer a real place card (works with Recents + floating card). Fall back to URL.
    if (!h1) {
      if (!isPlaceUrl(location.href) && lastKey !== "") {
        lastKey = "";
        onChange(null);
      }
      return;
    }

    const panel = findPlaceDetailRoot() ?? h1.parentElement ?? h1;
    // Prefer ChIJ from the open place card — Recents/Results also contain place links.
    const placeId =
      extractPlaceIdFromDom(panel) ?? extractPlaceIdFromDom(document);
    const placeName = h1.textContent?.trim() || extractPlaceHeading(panel);
    if (!placeId && !placeName) return;

    const category = extractPlaceCategory(panel);
    if (
      (category != null && !shouldShowBeliForPlace(category)) ||
      !shouldShowBeliForPlace(placeName)
    ) {
      if (lastKey !== "") {
        lastKey = "";
        onChange(null);
      }
      return;
    }

    const id = placeId ?? `name:${placeName}`;
    const coords = extractCoordsFromUrl(location.href);
    const address = extractPlaceAddress(panel);
    const key = `${id}|${placeName ?? ""}|${address ?? ""}|${category ?? ""}`;
    if (key === lastKey) return;
    lastKey = key;
    onChange({ placeId: id, placeName, coords, address, category });
  };

  const schedule = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(emit, 750);
  };

  const obs = new MutationObserver(schedule);
  obs.observe(document.documentElement, { childList: true, subtree: true });

  window.addEventListener("popstate", schedule);

  const hist = history as History & { __beliMapsPatched?: boolean };
  if (!hist.__beliMapsPatched) {
    hist.__beliMapsPatched = true;
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    history.pushState = (...args) => {
      push(...args);
      schedule();
    };
    history.replaceState = (...args) => {
      replace(...args);
      schedule();
    };
  }

  schedule();

  return () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    obs.disconnect();
    window.removeEventListener("popstate", schedule);
  };
}

function createSlot(kind: SlotKind): HTMLElement {
  const slot = document.createElement("div");
  slot.setAttribute(SLOT_ATTR, kind);
  // Content-sized only — Maps info lists often flex-grow bare divs (causes huge gaps).
  slot.style.display = "block";
  slot.style.width = "100%";
  slot.style.flex = "0 0 auto";
  slot.style.flexGrow = "0";
  slot.style.flexShrink = "0";
  slot.style.flexBasis = "auto";
  slot.style.alignSelf = "stretch";
  slot.style.height = "auto";
  slot.style.minHeight = "0";
  slot.style.maxHeight = "none";
  slot.style.minWidth = "0";
  slot.style.boxSizing = "border-box";
  slot.style.position = "relative";
  slot.style.zIndex = "0";
  slot.style.overflow = "hidden";
  slot.style.margin = "0";
  slot.style.padding = "0";
  return slot;
}

function getSlot(kind: SlotKind): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SLOT_ATTR}="${kind}"]`);
}

/** Insert once. Never reshuffle an already-placed slot (that twitches the Maps panel). */
function placeSlotAfter(kind: SlotKind, target: HTMLElement): HTMLElement {
  const existing = getSlot(kind);
  if (existing?.isConnected && !isInSearchResults(existing)) return existing;

  existing?.remove();
  const slot = createSlot(kind);
  target.insertAdjacentElement("afterend", slot);
  return slot;
}

function placeSlotBefore(kind: SlotKind, target: HTMLElement): HTMLElement {
  const existing = getSlot(kind);
  if (existing?.isConnected && !isInSearchResults(existing)) {
    // Allow a one-time upgrade to the Reviews anchor.
    if (existing.getAttribute(PLACED_ATTR) === "reviews") return existing;
    if (existing.nextElementSibling === target) {
      existing.setAttribute(PLACED_ATTR, "reviews");
      return existing;
    }
  }

  existing?.remove();
  const slot = createSlot(kind);
  target.parentElement?.insertBefore(slot, target);
  slot.setAttribute(PLACED_ATTR, "reviews");
  return slot;
}

function scrubMisplacedSlots(): void {
  document.querySelectorAll<HTMLElement>(`[${SLOT_ATTR}]`).forEach((el) => {
    if (isInSearchResults(el)) {
      el.remove();
      return;
    }
    // Description no longer uses an info-table slot — remove leftovers that caused the gap.
    if (el.getAttribute(SLOT_ATTR) === "summary") {
      el.remove();
    }
  });
}

function ensureScoresSlot(h1: HTMLElement): HTMLElement | null {
  const titleBlock = h1.parentElement ?? h1;
  return placeSlotAfter("scores", titleBlock);
}

/**
 * Google Reviews section start inside the place pane (not the Reviews tab).
 */
function findReviewsAnchor(panel: HTMLElement): HTMLElement | null {
  // "Edit your review" sits just above the Reviews block — insert after it when present.
  for (const el of panel.querySelectorAll<HTMLElement>("button")) {
    if (!isVisible(el) || isInSearchResults(el) || isInTabChrome(el)) continue;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^(Edit your review|Write a review)$/i.test(text)) continue;
    if (el.getBoundingClientRect().width < 120) continue;
    // Use a full-width wrapper if the button is nested.
    let block: HTMLElement = el;
    const parent = el.parentElement;
    if (parent && panel.contains(parent) && parent.getBoundingClientRect().width > el.getBoundingClientRect().width + 40) {
      block = parent;
    }
    return block;
  }

  for (const el of panel.querySelectorAll<HTMLElement>("h2, h3, [role='heading']")) {
    if (!isVisible(el) || isInTabChrome(el) || isInSearchResults(el)) continue;
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text !== "Reviews") continue;

    // Prefer inserting before the Reviews+Sort toolbar row.
    let cur: HTMLElement = el;
    for (let i = 0; i < 5; i++) {
      const parent = cur.parentElement;
      if (!(parent instanceof HTMLElement) || !panel.contains(parent)) break;
      const t = (parent.textContent || "").replace(/\s+/g, " ");
      const h = parent.getBoundingClientRect().height;
      if (/\bSort\b/.test(t) && h > 0 && h < 100) return parent;
      cur = parent;
    }
    return el;
  }

  return null;
}

function ensureFriendsSlot(panel: HTMLElement): HTMLElement | null {
  const existing = getSlot("friends");
  if (existing?.isConnected && !isInSearchResults(existing) && existing.getAttribute(PLACED_ATTR) === "reviews") {
    return existing;
  }

  const anchor = findReviewsAnchor(panel);
  if (!anchor) return existing?.isConnected ? existing : null;

  // After "Edit your review" wrapper → placeSlotAfter; before Reviews heading → placeSlotBefore.
  const text = (anchor.textContent || "").replace(/\s+/g, " ").trim();
  const afterCta = /^(Edit your review|Write a review)/i.test(text) || Boolean(
    anchor.querySelector?.("button") &&
      /Edit your review|Write a review/i.test(anchor.textContent || ""),
  );

  if (afterCta && !/^Reviews$/i.test(text)) {
    // Insert after CTA — but placeSlotAfter won't move existing. Force one-time place.
    if (existing?.isConnected && existing.getAttribute(PLACED_ATTR) === "reviews") return existing;
    existing?.remove();
    const slot = createSlot("friends");
    anchor.insertAdjacentElement("afterend", slot);
    slot.setAttribute(PLACED_ATTR, "reviews");
    return slot;
  }

  return placeSlotBefore("friends", anchor);
}

export function ensureOverlaySlots(): SlotEnsureResult {
  scrubMisplacedSlots();

  const before = {
    scores: getSlot("scores"),
    summary: getSlot("summary"),
    friends: getSlot("friends"),
  };

  const h1 = findPlaceDetailH1();
  if (!h1) return { slots: before, changed: false };

  const panel = findPlaceDetailRoot() ?? (h1.parentElement as HTMLElement) ?? h1;
  const scores = ensureScoresSlot(h1) ?? before.scores;
  const friends = ensureFriendsSlot(panel) ?? before.friends;
  const slots = { scores, summary: null, friends };

  const changed =
    slots.scores !== before.scores ||
    slots.friends !== before.friends ||
    before.summary != null;

  return { slots, changed };
}

export function hasPrimarySlot(slots: OverlaySlots): boolean {
  return Boolean(slots.scores?.isConnected && !isInSearchResults(slots.scores));
}

export function removeOverlaySlots(): void {
  document.querySelectorAll(`[${SLOT_ATTR}]`).forEach((el) => el.remove());
}
