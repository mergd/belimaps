import { BeliClient, BeliApiError } from "../src/beli/client";
import { OverlayService } from "../src/beli/overlay";
import { normalizePhone } from "../src/beli/phone";
import { loadCachedUser } from "../src/beli/session";
import type { Message, MessageResponse } from "../src/shared/messages";

const client = new BeliClient();
const overlay = new OverlayService(client);
let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!ready) {
    ready = client.init().then(() => undefined);
  }
  return ready ?? Promise.resolve();
}

async function openLoginPage(): Promise<void> {
  const url = chrome.runtime.getURL("/login.html");
  const existing = await chrome.tabs.query({ url });
  if (existing[0]?.id) {
    await chrome.tabs.update(existing[0].id, { active: true });
    if (existing[0].windowId != null) {
      await chrome.windows.update(existing[0].windowId, { focused: true });
    }
    return;
  }
  await chrome.tabs.create({ url });
}

export default defineBackground(() => {
  // No default_popup — toolbar click opens the full login/account page.
  chrome.action.onClicked.addListener(() => {
    void openLoginPage();
  });

  chrome.runtime.onMessage.addListener(
    (
      message: Message & { type: string },
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: MessageResponse) => void,
    ) => {
      void handle(message)
        .then(sendResponse)
        .catch((err: unknown) => {
          sendResponse({
            ok: false,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      return true;
    },
  );
});

async function handle(message: Message & { type: string }): Promise<MessageResponse> {
  await ensureReady();

  switch (message.type) {
    case "AUTH_STATUS": {
      const authenticated = await client.ensureFreshAuth();
      return { ok: true, authenticated };
    }
    case "LOGIN": {
      const phone = normalizePhone(message.phone);
      if (!phone) {
        return { ok: false, error: "Enter a valid US phone number (or +country code)." };
      }
      try {
        const session = await client.login({ phone_no: phone, password: message.password });
        overlay.clearCaches();
        const user = await client.me();
        return { ok: true, authenticated: true, session, user };
      } catch (err: unknown) {
        if (err instanceof BeliApiError && (err.status === 401 || err.status === 400)) {
          return { ok: false, error: "Invalid phone or password." };
        }
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
    }
    case "LOGOUT": {
      await client.logout();
      overlay.clearCaches();
      return { ok: true, authenticated: false };
    }
    case "WHOAMI": {
      if (!(await client.ensureFreshAuth())) {
        return { ok: true, authenticated: false };
      }
      try {
        const user = await client.me();
        return { ok: true, authenticated: true, user };
      } catch (err) {
        if (err instanceof BeliApiError && (err.status === 401 || err.status === 400)) {
          return { ok: true, authenticated: false };
        }
        const cached = await loadCachedUser();
        if (cached) return { ok: true, authenticated: true, user: cached };
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    case "GET_PLACE_OVERLAY": {
      const result = await overlay.getPlaceOverlay(
        message.placeId,
        message.placeName,
        message.coords,
        message.address,
      );
      if (!result.ok) {
        return { ok: false, error: result.message, code: result.error };
      }
      return { ok: true, authenticated: true, overlay: result.data };
    }
    case "OPEN_LOGIN": {
      await openLoginPage();
      return { ok: true, authenticated: await client.ensureFreshAuth() };
    }
    default:
      return { ok: false, error: `Unknown message ${(message as Message).type}` };
  }
}
