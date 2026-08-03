# Beli Maps

Chrome extension that shows **friends’ Beli scores** on Google Maps restaurant place pages.

Unofficial. Uses Beli’s private API (see [`openapi/beli.yaml`](openapi/beli.yaml)). Rate-limit politely. Not affiliated with Beli or Google.

**License:** [MIT](LICENSE) · **Privacy:** [PRIVACY.md](PRIVACY.md) · **Store listing draft:** [STORE.md](STORE.md)

## Load unpacked

```bash
bun install
bun run build
```

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `.output/chrome-mv3`
4. Click the **Beli Maps** toolbar icon — opens a full **sign-in page** (not a tiny popup)
5. Open a restaurant on [Google Maps](https://www.google.com/maps) — friend scores show **inline** above Reviews

Dev loop: `bun run dev` (WXT reloads the extension).

Store updates: bump `manifest.version` in `wxt.config.ts`, tag `vX.Y.Z`, push — GitHub Actions publishes to the Chrome Web Store (see [STORE.md](STORE.md)).

## Auth

- Login is a dedicated extension page (`login.html`) opened from the toolbar icon or the overlay “Sign in” link
- Only JWT `access` / `refresh` / `userId` are stored in `chrome.storage.local`
- Password is never persisted
- Access tokens refresh automatically when stale (~20 minutes); overlay/login validate via refresh before asking you to sign in again
- Phone login accepts US national numbers (+1 implied) or full `+` international via `libphonenumber-js`
## How overlay data works

1. Detect `/maps/place/…` and extract a Google `ChIJ…` place id
2. Resolve via `GET /api/business/?place_id=`
3. Use a **session-cached** `GET /api/scores/{me}/` + `GET /api/following/{me}/` (not per place)
4. Filter scores by `business_id` and join friend profiles

This avoids fan-out / 429s from fetching every friend’s Been list.

## Contract

| File | Purpose |
|------|---------|
| [`openapi/beli.yaml`](openapi/beli.yaml) | OpenAPI 3.1 source of truth |
| [`research/endpoints.md`](research/endpoints.md) | Living probe notes |
| [`src/beli/`](src/beli/) | Typed client implementing the contract |

Regenerate types (optional): `bun run gen:types`

## Chrome Web Store

```bash
bun run zip   # → .output/belimaps-*-chrome.zip
```

Listing copy + privacy dashboard answers: [`STORE.md`](STORE.md)  
Promo tile: [`store/promo-small-440x280.png`](store/promo-small-440x280.png)  
Screenshots: [`store/screenshots/`](store/screenshots/)

After the repo is public, set the store privacy URL to:

`https://github.com/mergd/belimaps/blob/main/PRIVACY.md`

## Notes

- Only place-detail panels for now (no map-wide pins / search scraping)
- Easy to hit Beli `429` if you probe aggressively — the extension throttles (~350ms) and caches scores for 1 hour
- Review **notes/text** are not in `/api/scores` yet; scores + friend identity only in v1
