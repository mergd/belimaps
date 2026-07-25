import type { OverlayResult, PlaceOverlay } from "../beli/types";
import type { OverlaySlots } from "../maps/watch";
import { closePhotoLightbox, openPhotoLightbox } from "./photoLightbox";

const TEAL = "#134f5c";

const FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600;700&display=swap";

function ensurePlayfair(): void {
  if (document.getElementById("beli-maps-fonts")) return;
  const link = document.createElement("link");
  link.id = "beli-maps-fonts";
  link.rel = "stylesheet";
  link.href = FONT_HREF;
  document.documentElement.appendChild(link);
}

const SCORES_STYLES = `
@import url("${FONT_HREF}");
:host {
  display: block;
  width: 100%;
  max-width: 100%;
  height: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  flex: 0 0 auto !important;
  pointer-events: auto;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --beli-teal: ${TEAL};
  --beli-muted: #5f6368;
  --beli-ink: #202124;
  --beli-green: #6fae3f;
  --beli-yellow: #d4a017;
  --beli-red: #d64545;
}
* { box-sizing: border-box; }
.wrap {
  display: block;
  padding: 0;
  margin: 0;
  max-width: 100%;
}
.line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  column-gap: 6px;
  row-gap: 0;
  padding: 0;
  margin: 0;
  font-size: 12px;
  line-height: 1.15;
  color: var(--beli-muted);
}
.pair {
  display: inline;
  white-space: normal;
  overflow-wrap: anywhere;
  word-break: break-word;
}
.label { font-weight: 500; color: var(--beli-muted); }
.value {
  font-weight: 700;
  color: var(--beli-teal);
  font-variant-numeric: tabular-nums;
  margin-left: 3px;
}
.value.green { color: var(--beli-green); }
.value.yellow { color: var(--beli-yellow); }
.value.red { color: var(--beli-red); }
.value.muted { color: var(--beli-muted); font-weight: 500; }
.sep { color: #dadce0; flex: 0 0 auto; }
.meta {
  margin-left: 3px;
  font-weight: 500;
  color: var(--beli-muted);
  font-variant-numeric: tabular-nums;
}
.blurb {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px;
  align-items: start;
  margin-top: 4px;
  max-width: min(100%, 340px);
}
.logo {
  margin: 0;
  font-family: "Playfair Display", Georgia, serif;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--beli-teal);
  text-transform: lowercase;
  line-height: 1.25;
  white-space: nowrap;
}
.text {
  margin: 0;
  font-size: 12px;
  line-height: 1.35;
  color: var(--beli-ink);
  overflow-wrap: break-word;
  word-break: break-word;
}
.state { margin: 0; padding: 0; font-size: 12px; line-height: 1.25; color: var(--beli-muted); }
.cta {
  display: inline-block;
  margin: 0;
  padding: 5px 8px;
  border: 1px solid #000;
  background: #000;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.cta:hover { background: var(--beli-teal); border-color: var(--beli-teal); }
`;

const FRIENDS_STYLES = `
:host {
  display: block;
  width: 100%;
  max-width: 100%;
  pointer-events: auto;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  --beli-teal: ${TEAL};
  --beli-ink: #202124;
  --beli-muted: #70757a;
  --beli-line: #e8eaed;
  --beli-green: #6fae3f;
  --beli-yellow: #d4a017;
  --beli-red: #d64545;
  background: #fff;
}
* { box-sizing: border-box; }
.section {
  display: block;
  padding: 16px 20px 18px;
  margin: 0;
  border-top: 1px solid var(--beli-line);
  background: #fff;
}
.subheader {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.25;
  color: var(--beli-ink);
}
.list { list-style: none; margin: 0; padding: 0; }
.item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 10px 0;
  border-top: 1px solid var(--beli-line);
}
.item:first-of-type { border-top: none; padding-top: 2px; }
.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: #f1f3f4;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--beli-teal);
  margin-top: 1px;
}
.avatar img { width: 100%; height: 100%; object-fit: cover; }
.meta { min-width: 0; }
.name {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.25;
  color: var(--beli-ink);
  overflow-wrap: anywhere;
  word-break: break-word;
}
.handle { font-size: 12px; color: var(--beli-muted); margin-top: 1px; }
.score {
  font-size: 14px;
  font-weight: 700;
  color: var(--beli-teal);
  font-variant-numeric: tabular-nums;
  line-height: 1.25;
  padding-top: 1px;
}
.score.green { color: var(--beli-green); }
.score.yellow { color: var(--beli-yellow); }
.score.red { color: var(--beli-red); }
.note {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.4;
  color: var(--beli-ink);
  overflow-wrap: anywhere;
  word-break: break-word;
}
.photos {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  margin-top: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: thin;
}
.photos button.thumb {
  display: block;
  width: 64px;
  height: 64px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  overflow: hidden;
  flex: 0 0 auto;
  background: #f1f3f4;
  cursor: zoom-in;
}
.photos button.thumb:hover { outline: 2px solid var(--beli-teal); outline-offset: 1px; }
.photos button.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  pointer-events: none;
}
.state {
  margin: 4px 0 0;
  font-size: 12px;
  line-height: 1.3;
  color: var(--beli-muted);
  overflow-wrap: anywhere;
  word-break: break-word;
}
`;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function formatScore(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Beli score bands: red < 3.5, yellow < 6.7, else green. */
function scoreTone(n: number): "green" | "yellow" | "red" {
  if (n < 3.5) return "red";
  if (n < 6.7) return "yellow";
  return "green";
}

function scorePair(label: string, value: number | null, meta?: string): string {
  const v =
    value != null
      ? `<span class="value ${scoreTone(value)}">${formatScore(value)}</span>`
      : `<span class="value muted">—</span>`;
  const m = meta ? `<span class="meta">${escapeHtml(meta)}</span>` : "";
  return `<span class="pair"><span class="label">${escapeHtml(label)}</span>${v}${m}</span>`;
}

class ShadowMount {
  readonly host: HTMLElement;
  private root: ShadowRoot;
  private attachedSlot: HTMLElement | null = null;

  constructor(tag: string, styles: string) {
    this.host = document.createElement(tag);
    this.host.style.display = "block";
    this.host.style.width = "100%";
    this.host.style.height = "auto";
    this.host.style.minHeight = "0";
    this.host.style.flex = "0 0 auto";
    this.root = this.host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = styles;
    this.root.appendChild(style);
  }

  /** Attach only when a slot exists. Never detach just because a slot is missing this tick. */
  attach(slot: HTMLElement | null): boolean {
    if (!slot) return false;
    if (this.host.parentElement === slot && this.host.isConnected) {
      this.attachedSlot = slot;
      return false;
    }
    this.host.remove();
    slot.appendChild(this.host);
    this.attachedSlot = slot;
    return true;
  }

  clear(): void {
    for (const child of [...this.root.children]) {
      if (child.tagName !== "STYLE") child.remove();
    }
  }

  render(html: string): void {
    this.clear();
    const wrap = document.createElement("div");
    wrap.innerHTML = html.trim();
    for (const child of [...wrap.children]) {
      this.root.appendChild(child);
    }
  }

  query(sel: string): Element | null {
    return this.root.querySelector(sel);
  }

  unmount(): void {
    this.host.remove();
    this.attachedSlot = null;
    this.clear();
  }
}

export class BeliOverlay {
  private scores = new ShadowMount("beli-maps-scores", SCORES_STYLES);
  private friends = new ShadowMount("beli-maps-friends", FRIENDS_STYLES);

  constructor() {
    ensurePlayfair();
  }

  /** Returns true if any host was moved to a new slot. */
  mount(slots: OverlaySlots): boolean {
    ensurePlayfair();
    // Drop legacy info-table summary slots — description lives under scores now.
    slots.summary?.remove();
    const a = this.scores.attach(slots.scores);
    const c = this.friends.attach(slots.friends);
    return a || c;
  }

  unmount(): void {
    closePhotoLightbox();
    this.scores.unmount();
    this.friends.unmount();
  }

  showLoading(placeName: string | null): void {
    this.scores.render(`
      <p class="state">Loading scores${placeName ? ` for <strong>${escapeHtml(placeName)}</strong>` : ""}…</p>
    `);
  }

  showResult(result: OverlayResult): void {
    if (!result.ok) {
      this.showError(result.error, result.message);
      return;
    }
    this.showOverlay(result.data);
  }

  showError(code: string, message: string): void {
    const cta =
      code === "unauthenticated"
        ? `<button class="cta" type="button" data-action="open-login">Sign in</button>`
        : "";
    this.scores.render(`
      <p class="state">${escapeHtml(message)}</p>
      ${cta}
    `);
    this.friends.clear();
    this.bindCta();
  }

  showOverlay(data: PlaceOverlay): void {
    const friendsMeta = `(${data.friends.length})`;
    const third =
      data.communityScore != null
        ? scorePair(
            "Average",
            data.communityScore,
            data.communityCount != null ? `(${data.communityCount})` : undefined,
          )
        : scorePair("Suggested", data.suggestedScore);

    const blurb = data.summary
      ? `<div class="blurb">
          <div class="logo" aria-hidden="true">beli</div>
          <p class="text">${escapeHtml(data.summary)}</p>
        </div>`
      : "";

    this.scores.render(`
      <div class="wrap">
        <div class="line">
          ${scorePair("Yours", data.myScore)}
          <span class="sep">·</span>
          ${scorePair("Friends", data.avgScore, friendsMeta)}
          <span class="sep">·</span>
          ${third}
        </div>
        ${blurb}
      </div>
    `);

    const friendRows =
      data.friends.length === 0
        ? `<p class="state">None of your friends have ranked this spot yet.</p>`
        : `<ul class="list">${data.friends
            .map((f) => {
              const avatar = f.profilePhoto
                ? `<div class="avatar"><img src="${escapeAttr(f.profilePhoto)}" alt="" /></div>`
                : `<div class="avatar">${escapeHtml(initials(f.fullName || f.username))}</div>`;
              const note = f.note
                ? `<p class="note">${escapeHtml(f.note)}</p>`
                : "";
              const photos =
                f.photos?.length > 0
                  ? `<div class="photos">${f.photos
                      .map((p, i) => {
                        const thumb = p.thumbnail || p.image;
                        const full = p.image || p.thumbnail;
                        if (!thumb || !full) return "";
                        const alt = p.description ? escapeAttr(p.description) : "";
                        return `<button class="thumb" type="button" data-photo-index="${i}" data-full="${escapeAttr(full)}" aria-label="${alt || "View photo"}">
                          <img src="${escapeAttr(thumb)}" alt="${alt}" loading="lazy" />
                        </button>`;
                      })
                      .join("")}</div>`
                  : "";
              return `
                <li class="item">
                  ${avatar}
                  <div class="meta">
                    <div class="name">${escapeHtml(f.fullName || f.username)}</div>
                    <div class="handle">@${escapeHtml(f.username)}</div>
                    ${note}
                    ${photos}
                  </div>
                  <div class="score ${scoreTone(f.score)}">${formatScore(f.score)}</div>
                </li>
              `;
            })
            .join("")}</ul>`;

    this.friends.render(`
      <section class="section">
        <h2 class="subheader">Friend reviews</h2>
        ${friendRows}
      </section>
    `);
    this.bindPhotoPreview();
  }

  private bindPhotoPreview(): void {
    const section = this.friends.query(".section");
    if (!section) return;
    section.addEventListener("click", (e) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      const btn = t.closest("button.thumb") as HTMLButtonElement | null;
      if (!btn || !section.contains(btn)) return;
      e.preventDefault();
      e.stopPropagation();

      const item = btn.closest("li.item");
      if (!item) return;
      const thumbs = [...item.querySelectorAll<HTMLButtonElement>("button.thumb[data-full]")];
      const photos = thumbs.map((el) => ({
        src: el.getAttribute("data-full") || "",
        alt: el.querySelector("img")?.getAttribute("alt") || el.getAttribute("aria-label") || "",
      }));
      const start = Number(btn.getAttribute("data-photo-index") || "0");
      openPhotoLightbox(photos, Number.isFinite(start) ? start : 0);
    });
  }

  private bindCta(): void {
    this.scores.query("[data-action='open-login']")?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      void chrome.runtime.sendMessage({ type: "OPEN_LOGIN" });
    });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}
