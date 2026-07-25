# Privacy Policy — Beli Maps

**Last updated:** July 24, 2026

Beli Maps (“the Extension”) is an unofficial, open-source Chrome extension that shows your friends’ Beli restaurant scores on Google Maps place pages.

Beli Maps is **not** affiliated with, endorsed by, or sponsored by Beli or Google.

## What we collect

The Extension does **not** operate its own backend and does **not** sell or monetize user data.

### Account credentials (sign-in)

- You sign in with your **Beli phone number and password**.
- Credentials are sent **directly to Beli’s API** to obtain session tokens.
- Your **password is never written to disk** or to `chrome.storage`.

### Stored locally on your device

After a successful sign-in, the Extension stores in `chrome.storage.local` (on your browser/device only):

- Beli JWT **access** and **refresh** tokens
- Your Beli **user id**
- Cached profile / scores data used to render the overlay (to reduce API calls)

This data stays in your browser profile. It is not uploaded to any Beli Maps server (there isn’t one).

### Data sent to third parties

While you use the Extension, it talks to:

1. **Beli’s API** (authentication, your following list, scores, business lookup for the open Maps place)
2. **Google Maps** pages you already visit (content script reads the place UI to match restaurants)
3. **Google Fonts** (Playfair Display for the “beli” wordmark styling)

Place context used for matching (e.g. Google place id, name, address, map coordinates when available) is sent to Beli’s API so the Extension can resolve the restaurant and show friend scores.

## What we do **not** do

- We do not sell personal data
- We do not use your data for advertising
- We do not transfer your Beli password to any party other than Beli’s login endpoint
- We do not run analytics SDKs or trackers in the Extension

## Permissions

| Permission / host | Why |
| --- | --- |
| `storage` | Persist tokens and short-lived caches locally |
| `tabs` | Open/focus the sign-in page from the toolbar |
| Beli API hosts | Login, refresh, scores, following, business search |
| `google.com/maps` / `maps.google.com` | Inject the scores overlay on place pages |
| `fonts.googleapis.com` / `fonts.gstatic.com` | Load the brand typeface |

## Data retention

- Local tokens and caches remain until you **sign out** or remove the Extension / clear extension storage.
- Sign-out clears stored session data from `chrome.storage.local`.

## Children’s privacy

The Extension is not directed at children under 13. Do not use it if you are under 13.

## Changes

If this policy changes in a material way, we will update the “Last updated” date in this file in the public repository.

## Contact

Open an issue on the project’s GitHub repository, or contact the maintainer listed there.
