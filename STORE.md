# Chrome Web Store listing draft

Paste these into the Developer Dashboard. Replace the privacy URL after the repo is public.

## Listing

**Name:** Beli Maps

**Summary (short):** See friends' Beli scores on Google Maps place pages

**Detailed description:**

```
Beli Maps shows your friends’ Beli restaurant scores right on Google Maps place pages.

How it works
1. Click the toolbar icon and sign in with your Beli phone number
2. Open a restaurant on Google Maps
3. Friend scores appear inline above Reviews

Notes
• Unofficial — not affiliated with Beli or Google
• Password is never stored; only session tokens stay in chrome.storage
• Uses Beli’s API and rate-limits / caches to avoid hammering it

Open source. Feedback and PRs welcome on GitHub.
```

**Category:** Productivity  
**Language:** English

## Privacy practices (dashboard)

**Single purpose:**  
Display the signed-in user’s friends’ Beli scores on Google Maps restaurant place pages.

**Remote code:** No

**Permission justifications**

- `storage` — Store JWT access/refresh tokens and short-lived score caches on device only.
- `tabs` — Open or focus the extension sign-in page when the toolbar icon is clicked.

**Host permission justifications**

- Beli API hosts — Authenticate, refresh tokens, fetch following/scores, and resolve businesses by Google place id.
- `https://www.google.com/maps/*` and `https://maps.google.com/*` — Inject the overlay on place detail panels.
- Google Fonts hosts — Load Playfair Display for the overlay wordmark.

**Data use disclosures (typical checkboxes)**  
Personally identifiable information / authentication info (tokens, user id). Certify limited use / no sale / no credit decisions, etc. as shown in the dashboard.

**Privacy policy URL:**

```
https://github.com/mergd/belimaps/blob/main/PRIVACY.md
```

## Package / publish

```bash
bun run zip
# → .output/belimaps-*-chrome.zip
```

### Chrome Web Store (CLI / CI)

Uses the shared GCP service account `chrome-webstore@podads-wxuan.iam.gserviceaccount.com` and Chrome Web Store API v2.

**Local** (via `ap`):

```bash
ap run -- bun run cws:status     # live / pending status
ap run -- bun run cws:upload     # zip + upload only
ap run -- bun run cws:publish    # zip + upload + submit for review
```

**CI:** push a version tag that matches `wxt.config.ts` `manifest.version`:

```bash
# bump version in wxt.config.ts first, commit, then:
git tag v0.1.3
git push origin v0.1.3
```

That runs `.github/workflows/publish-chrome.yml` (typecheck → zip → upload → publish). Manual runs are available from the Actions tab (`workflow_dispatch`, optional upload-only).

Required GitHub secrets: `CWS_SERVICE_ACCOUNT_JSON`, `CWS_PUBLISHER_ID`, `CWS_EXTENSION_ID`.

**Extension ID:** `fljjhnhomodeaaagknnpnkdcnaklaoam`  
**Store:** https://chromewebstore.google.com/detail/fljjhnhomodeaaagknnpnkdcnaklaoam

## Assets

| Asset | Path | Status |
| --- | --- | --- |
| Extension icons | built into zip via `@wxt-dev/auto-icons` | ✅ |
| Small promo 440×280 | `store/promo-small-440x280.png` (edit via `.html`) | ✅ |
| Screenshots 1280×800 | `store/screenshots/overlay-1280x800.png` | ✅ overlay; optional: login page |
