import { AsYouType, parsePhoneNumberFromString } from "libphonenumber-js";

/** Default country when the user omits a country code (+1 is implied). */
export const DEFAULT_PHONE_COUNTRY = "US" as const;

/**
 * Normalize user input to E.164 for the Beli login API.
 * National numbers (e.g. 5551234567 or (555) 123-4567) default to US (+1).
 * Returns null when the number is not a valid phone.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, DEFAULT_PHONE_COUNTRY);
  if (!parsed?.isValid()) return null;
  return parsed.format("E.164");
}

/** As-you-type national formatting for the login field (US default). */
export function formatPhoneInput(raw: string): string {
  const trimmed = raw.trimStart();
  if (!trimmed) return "";

  // Keep international entry (+…) as typed with light formatting.
  if (trimmed.startsWith("+")) {
    return new AsYouType().input(trimmed);
  }

  return new AsYouType(DEFAULT_PHONE_COUNTRY).input(trimmed);
}
