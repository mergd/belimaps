/** Fullscreen photo preview over Maps (outside Shadow DOM for stacking). */

export interface LightboxPhoto {
  src: string;
  alt?: string | null;
}

const HOST_ID = "beli-maps-lightbox";

let openState: {
  photos: LightboxPhoto[];
  index: number;
  onKey: (e: KeyboardEvent) => void;
} | null = null;

function ensureHost(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (host) return host;

  host = document.createElement("div");
  host.id = HOST_ID;
  host.style.cssText = "all: initial; position: fixed; inset: 0; z-index: 2147483646;";
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
:host { all: initial; }
* { box-sizing: border-box; }
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.84);
  display: grid;
  grid-template-rows: auto 1fr auto;
  align-items: stretch;
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
  color: #fff;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px 8px;
}
.caption {
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.3;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.count {
  flex: 0 0 auto;
  font-size: 12px;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}
.close {
  flex: 0 0 auto;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.12);
  color: #fff;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
}
.close:hover { background: rgba(255,255,255,0.22); }
.stage {
  position: relative;
  min-height: 0;
  display: grid;
  place-items: center;
  padding: 8px 56px 12px;
}
.stage img {
  max-width: min(100%, 920px);
  max-height: calc(100vh - 140px);
  width: auto;
  height: auto;
  object-fit: contain;
  border-radius: 8px;
  background: #111;
  box-shadow: 0 8px 40px rgba(0,0,0,0.45);
}
.nav {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 50%;
  background: rgba(255,255,255,0.14);
  color: #fff;
  font-size: 22px;
  cursor: pointer;
}
.nav:hover { background: rgba(255,255,255,0.26); }
.nav.prev { left: 10px; }
.nav.next { right: 10px; }
.nav[hidden] { display: none; }
.hint {
  margin: 0;
  padding: 0 16px 16px;
  text-align: center;
  font-size: 11px;
  opacity: 0.55;
}
`;
  root.appendChild(style);
  document.documentElement.appendChild(host);
  return host;
}

function render(): void {
  if (!openState) return;
  const host = ensureHost();
  const root = host.shadowRoot;
  if (!root) return;

  const { photos, index } = openState;
  const photo = photos[index];
  if (!photo) {
    closePhotoLightbox();
    return;
  }

  const multi = photos.length > 1;
  const caption = photo.alt?.trim() || "";

  let shell = root.querySelector(".backdrop") as HTMLElement | null;
  if (!shell) {
    shell = document.createElement("div");
    shell.className = "backdrop";
    shell.setAttribute("role", "dialog");
    shell.setAttribute("aria-modal", "true");
    shell.innerHTML = `
      <div class="top">
        <p class="caption"></p>
        <span class="count"></span>
        <button class="close" type="button" aria-label="Close">×</button>
      </div>
      <div class="stage">
        <button class="nav prev" type="button" aria-label="Previous">‹</button>
        <img alt="" />
        <button class="nav next" type="button" aria-label="Next">›</button>
      </div>
      <p class="hint">Esc to close · ← → to browse</p>
    `;
    root.appendChild(shell);

    shell.addEventListener("click", (e) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      if (t.classList.contains("backdrop") || t.classList.contains("stage")) {
        closePhotoLightbox();
      }
    });
    shell.querySelector(".close")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closePhotoLightbox();
    });
    shell.querySelector(".prev")?.addEventListener("click", (e) => {
      e.stopPropagation();
      step(-1);
    });
    shell.querySelector(".next")?.addEventListener("click", (e) => {
      e.stopPropagation();
      step(1);
    });
    shell.querySelector("img")?.addEventListener("click", (e) => e.stopPropagation());
  }

  const img = shell.querySelector("img") as HTMLImageElement;
  const captionEl = shell.querySelector(".caption") as HTMLElement;
  const countEl = shell.querySelector(".count") as HTMLElement;
  const prev = shell.querySelector(".prev") as HTMLButtonElement;
  const next = shell.querySelector(".next") as HTMLButtonElement;

  img.src = photo.src;
  img.alt = caption;
  captionEl.textContent = caption;
  countEl.textContent = multi ? `${index + 1} / ${photos.length}` : "";
  prev.hidden = !multi;
  next.hidden = !multi;
}

function step(delta: number): void {
  if (!openState || openState.photos.length < 2) return;
  const n = openState.photos.length;
  openState.index = (openState.index + delta + n) % n;
  render();
}

export function openPhotoLightbox(photos: LightboxPhoto[], startIndex = 0): void {
  const cleaned = photos.filter((p) => Boolean(p.src));
  if (cleaned.length === 0) return;

  if (openState) {
    document.removeEventListener("keydown", openState.onKey, true);
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closePhotoLightbox();
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  };

  openState = {
    photos: cleaned,
    index: Math.max(0, Math.min(startIndex, cleaned.length - 1)),
    onKey,
  };
  document.addEventListener("keydown", onKey, true);
  render();
}

export function closePhotoLightbox(): void {
  if (openState) {
    document.removeEventListener("keydown", openState.onKey, true);
    openState = null;
  }
  document.getElementById(HOST_ID)?.remove();
}
