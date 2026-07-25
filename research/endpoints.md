# Beli API endpoint catalog

Living notes feeding [`openapi/beli.yaml`](../openapi/beli.yaml). Unofficial; reverse-engineered.

## Hosts

| Key | Base URL |
|-----|----------|
| ONBOARD | `https://backoffice-service-onboarding-t57o3dxfca-nn.a.run.app` |
| API | `https://backoffice-service-t57o3dxfca-nn.a.run.app` |
| RECS | `https://backoffice-service-recs-t57o3dxfca-nn.a.run.app` |
| ACTIVITY | `https://activity-service-978733420956.northamerica-northeast1.run.app` |

Every request needs `Origin: https://localhost`, `Referer: https://localhost/`, browser-like `User-Agent`. Missing Origin → 403.

API and RECS often serve the **same** routes. Prefer API for reads; use RECS for `/api/recs/{userId}/`.

## Confirmed routes (2026-07-24)

### Auth (ONBOARD)

| Method | Path | Notes |
|--------|------|-------|
| POST | `/api/token/` | Body `{ phone_no, password }` E.164. → `{ access, refresh }` |
| POST | `/api/token/refresh/` | Body `{ refresh }` → `{ access }` (refresh not rotated). Access ~20m, refresh ~7d |
| GET | `/api/user/logged-in/` | Bearer → `{ results: [user] }` |

### Discovery (API)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/search-app/` | `term`, `city`, `coords`, `user` → predictions (+ inline `business` id when known) |
| GET | `/api/business/` | `id` **or** `place_id`; optional `from_business_page=true`. ~25 place fields; **no** friend scores embedded |

### Social (API)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/following/{userId}/` | People you follow |
| GET | `/api/followers/{userId}/` | Followers |
| GET | `/api/follow/` | Exists; 400 without args (write path TBD) |
| GET | `/api/user/search/{viewer}/{query}/` | Member search; `include_followed` |

### Scores / recs

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/scores/{userId}/` | Large flat list of network scores. **Query params do not filter.** Client-filter by `business_id`. Cache per session |
| GET | `/api/average-score/` | **Exists but 500s** (even with no args, 2026-07-24). Intended for community average + rating count (e.g. Barra ~327). Client wired; falls back to Suggested until fixed |
| GET | `/api/rank-count/` | Leaderboard of users by # of places ranked — **not** per-business review count |

### Lists / photos

| Method | Path | Notes |
|--------|------|-------|
| GET | `/api/get-ranking/` | Requires `user` + `category`. Ignores `business` / `business_id` query |
| GET | `/api/get-bookmark/` | Want to Try; category-keyed object |
| GET | `/api/user-business-photo/` | List by `user` + `business` |
| GET | `/api/user-business-photo/{id}/` | Single photo / cover object |

## Overlay strategy

1. Prefer exact Google `ChIJ…` `place_id` → `GET /api/business/?place_id=` **only if** Maps street address agrees (street # / ZIP overlap with Beli neighborhood/address fields)
2. Else `GET /api/search-app/` by restaurant **name** + map **coords**
3. Pick prediction by: matching `place_id` → **address overlap** on `secondary_text` (street # / ZIP) → exact name → lowest `distance_meters`
4. Session-cache:
   - `GET /api/scores/{me}/` → friend scores (filter by `business_id`)
   - `GET /api/following/{me}/` → names/avatars
   - `GET /api/get-ranking/?user=me` → **your** score
   - `GET /api/recs/{me}/` → **suggested** score (`expected_percentile`)
5. Show business `summary` as a global blurb when present
6. For each friend score, optionally `GET /api/user-business-photo/?user=&business=` (capped) — dish captions + thumbnails are the review body (no free-text note field on scores)
7. UI mounts **above** the Google Maps “Reviews” heading when present
8. Score strip: **Yours · Friends (n) · Average (count)** when `/api/average-score/` works; else **Suggested**. Score colors: red &lt; 3.5, yellow &lt; 6.7, green ≥ 6.7

### Ebiko note (2026-07-24)

Name-only / weak place_id matching ranked Belden Place (`2842913`) first; SoMa is `100 1st St Ste 160` (`1214340`). Address tokens (`100`, `94105`) on search `secondary_text` disambiguate. Network `/api/scores` may still have **0** friend rows — empty friends is real data.

## Rate limits

Aggressive path probing hit `429 Request was throttled` on RECS. Throttle outbound calls (~350ms+), cache scores, never fan-out per map pin.

## Still unknown

- Working params/shape for `/api/average-score/` (route 500s; needed for community count like Barra’s 327)
- Free-text review notes (scores have no note; photo `description` is dish caption only)
- Exact `/api/follow/` write body
- ACTIVITY host routes (analytics sink)
- Whether native business page uses scores dump vs a tighter endpoint

## Captures

Add raw HAR / mitm dumps under `research/captures/` (gitignored if sensitive).
