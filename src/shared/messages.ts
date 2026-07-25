import type { LoggedInUser, PlaceOverlay, Session } from "../beli/types";

export type Message =
  | { type: "LOGIN"; phone: string; password: string }
  | { type: "LOGOUT" }
  | { type: "WHOAMI" }
  | { type: "AUTH_STATUS" }
  | {
      type: "GET_PLACE_OVERLAY";
      placeId: string;
      placeName?: string;
      coords?: string;
      address?: string;
    }
  | { type: "OPEN_LOGIN" };

export type OverlayErrorCode = "unauthenticated" | "not_found" | "rate_limited" | "error";

export type MessageResponse =
  | {
      ok: true;
      session?: Session;
      user?: LoggedInUser;
      authenticated: boolean;
      overlay?: PlaceOverlay;
    }
  | { ok: false; error: string; code?: OverlayErrorCode };

export async function sendMessage<T extends MessageResponse = MessageResponse>(
  message: Message,
): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
