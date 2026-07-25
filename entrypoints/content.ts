import { BeliOverlay } from "../src/overlay/mount";
import {
  ensureOverlaySlots,
  hasPrimarySlot,
  removeOverlaySlots,
  watchPlacePanel,
} from "../src/maps/watch";
import { placeCacheKey, TtlLruCache } from "../src/shared/placeCache";
import { sendMessage } from "../src/shared/messages";
import type { OverlayErrorCode } from "../src/shared/messages";

const MAX_MOUNT_RETRIES = 40;
const CONTENT_PLACE_TTL_MS = 45 * 60 * 1000;

type OverlayView = Parameters<BeliOverlay["showResult"]>[0];

export default defineContentScript({
  matches: ["https://www.google.com/maps/*", "https://maps.google.com/*"],
  runAt: "document_idle",
  main() {
    const ui = new BeliOverlay();
    let seq = 0;
    let lastOverlay: OverlayView | null = null;
    let friendsPoll: ReturnType<typeof setInterval> | null = null;
    const viewCache = new TtlLruCache<OverlayView>(CONTENT_PLACE_TTL_MS, 40);
    const inFlight = new Map<string, Promise<OverlayView>>();

    const stopFriendsPoll = () => {
      if (friendsPoll) {
        clearInterval(friendsPoll);
        friendsPoll = null;
      }
    };

    const hide = () => {
      stopFriendsPoll();
      lastOverlay = null;
      ui.unmount();
      removeOverlaySlots();
    };

    const ensureMounted = (opts?: { repaint?: boolean }) => {
      try {
        const { slots, changed } = ensureOverlaySlots();
        if (!hasPrimarySlot(slots)) return false;
        const moved = ui.mount(slots);
        if ((changed || moved || opts?.repaint) && lastOverlay) {
          ui.showResult(lastOverlay);
        }
        return true;
      } catch {
        return false;
      }
    };

    /** Reviews section often paints late — try a few times to park friends above it. */
    const scheduleFriendsPlacement = () => {
      stopFriendsPoll();
      let n = 0;
      friendsPoll = setInterval(() => {
        n += 1;
        const { slots, changed } = ensureOverlaySlots();
        if (changed && lastOverlay) {
          ui.mount(slots);
          ui.showResult(lastOverlay);
        }
        const friends = slots.friends;
        const placed = friends?.getAttribute("data-beli-placed") === "reviews";
        if (placed || n >= 8) stopFriendsPoll();
      }, 1000);
    };

    const fetchOverlay = (
      key: string,
      ctx: {
        placeId: string;
        placeName: string | null;
        coords: string | null;
        address: string | null;
      },
    ): Promise<OverlayView> => {
      const existing = inFlight.get(key);
      if (existing) return existing;

      const pending = sendMessage({
        type: "GET_PLACE_OVERLAY",
        placeId: ctx.placeId,
        placeName: ctx.placeName ?? undefined,
        coords: ctx.coords ?? undefined,
        address: ctx.address ?? undefined,
      })
        .then((res): OverlayView => {
          if (res.ok && res.overlay) {
            return { ok: true, data: res.overlay };
          }
          const code: OverlayErrorCode = !res.ok && res.code ? res.code : "error";
          return {
            ok: false,
            error: code,
            message: res.ok === false ? res.error : "Something went wrong.",
          };
        })
        .catch((err: unknown): OverlayView => ({
          ok: false,
          error: "error",
          message: err instanceof Error ? err.message : String(err),
        }))
        .then((view) => {
          // Cache successes and not_found so quick re-opens stay quiet.
          if (view.ok || view.error === "not_found") {
            viewCache.set(key, view);
            if (view.ok && view.data.placeId.startsWith("ChIJ")) {
              viewCache.set(placeCacheKey({ placeId: view.data.placeId }), view);
            }
          }
          return view;
        })
        .finally(() => {
          inFlight.delete(key);
        });

      inFlight.set(key, pending);
      return pending;
    };

    watchPlacePanel((ctx) => {
      const mySeq = ++seq;
      if (!ctx) {
        hide();
        return;
      }

      const key = placeCacheKey(ctx);
      let retries = 0;

      const paint = (view: OverlayView) => {
        if (mySeq !== seq) return;
        if (view.ok === false && view.error === "not_found") {
          hide();
          return;
        }
        if (!ensureMounted({ repaint: false })) return;
        lastOverlay = view;
        ui.showResult(view);
        if (view.ok) scheduleFriendsPlacement();
      };

      const tryMount = () => {
        if (mySeq !== seq) return;
        if (!ensureMounted({ repaint: false })) {
          if (retries++ < MAX_MOUNT_RETRIES) requestAnimationFrame(tryMount);
          return;
        }

        const cached = viewCache.get(key);

        if (cached) {
          paint(cached);
          return;
        }

        ui.showLoading(ctx.placeName);
        void fetchOverlay(key, ctx).then(paint);
      };

      tryMount();
    });
  },
});
