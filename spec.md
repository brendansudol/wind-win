# Windward — Product & Technical Spec

**Working title:** Windward
**One-liner:** A cycling companion app that shows live wind conditions on a device-oriented compass and ranks nearby Strava segments by how much the current wind will help you set a PR.
**Version:** v1.0 spec, draft 1

---

## 1. Overview & Goals

Wind is the single biggest external variable in flat-road cycling performance. A 15 km/h tailwind on a 5-minute segment can be worth 20–40 seconds — often more than a year of training. Riders already chase KOMs on windy days, but doing it well requires mentally cross-referencing a weather app, a map, and Strava. Windward collapses that into one screen: point your phone, see the wind; open the second tab, see exactly which segments the wind is blowing you down today.

**Primary goals for v1:** a fluid, sensor-driven compass that shows wind direction and speed relative to where the user is standing and facing; Strava authentication; and a ranked list of nearby and starred segments scored by tailwind advantage under current conditions.

**Non-goals for v1:** route planning, forecast-based "best time to ride" prediction, live ride recording, Android Wear/watchOS, social features. These are listed as v2 candidates in §13.

## 2. Platform Decision: Expo React Native

Recommendation: **Expo (React Native) with TypeScript**, not native Swift.

Rationale: everything this app needs is well supported in the Expo SDK — `expo-location` exposes the same fused compass heading (magnetometer + gyro, declination-corrected) that CoreLocation provides to Swift apps, so there is no fidelity loss for the compass feature. Expo gives us Android for free, OTA updates via EAS Update, and a much faster iteration loop (hot reload on device). Swift would only win if we needed background sensor processing, ultra-low-latency AR-style rendering, or watchOS — none of which are in scope. The one real constraint Expo imposes is that smooth 60fps compass rotation must be driven through `react-native-reanimated` on the UI thread rather than React state updates; this is a solved pattern and is specced in §8.1.

**Stack summary:** Expo SDK 53+, TypeScript, `expo-router` (file-based tabs), `react-native-reanimated` + `react-native-svg` for the compass, `expo-location` (position + heading), `expo-auth-session` + `expo-web-browser` (Strava OAuth), `expo-secure-store` (tokens), `@tanstack/react-query` (API caching/refresh), `@mapbox/polyline` (segment geometry decoding).

## 3. Users & Core Stories

The target user is a performance-oriented cyclist with a Strava account who hunts PRs and KOMs. The two stories that define v1:

1. _"Standing with my bike, I want to see which way the wind is blowing relative to me, so I can decide which direction to ride."_ → Tab 1.
2. _"Before or during a ride, I want to know which of my target segments have a tailwind right now, so I can prioritize a PR attempt."_ → Tab 2.

A secondary story — _"I want to discover segments near me I haven't tried that are wind-favored today"_ — is served by including Strava's segment explorer results alongside the user's starred segments.

## 4. Tab 1 — Wind Compass

### 4.1 UX

Full-screen compass occupying the center of the screen. The compass behaves like a physical compass: as the user rotates their phone, the compass rose (N/E/S/W ring with degree ticks) counter-rotates so that north on screen always points to true north in the real world. Overlaid on the rose:

- **Wind arrow:** a prominent arrow fixed to the real-world direction the wind is blowing _toward_ (so the arrow shows where the wind will push you). Because it's anchored to the rose, it stays pointed at the true wind direction as the phone rotates. Arrow length/thickness scales subtly with wind speed.
- **Heading lubber line:** a fixed marker at the top of the screen indicating the direction the phone (and presumably the rider) is facing.
- **Relative wind readout:** a text chip that interprets the wind relative to the user's current facing: "Tailwind," "Headwind," "Crosswind from left," etc., with the effective head/tail component in km/h (e.g., "Headwind · −12 km/h effective"). This updates live as the user turns.

Below or around the compass: wind speed, gusts, wind direction in both degrees and cardinal ("18 km/h from SW (225°)"), location name (reverse-geocoded, coarse), and a last-updated timestamp with pull-to-refresh. Units respect a settings toggle (km/h vs mph; default from device locale).

### 4.2 Behavior & states

On first open, request when-in-use location permission with a clear rationale string. While waiting for the first fix, show the compass rotating with a skeleton wind arrow. If permission is denied, show an inline explainer with a button that deep-links to system settings; the compass still rotates (heading needs no permission on Android via magnetometer, and on iOS heading comes through `expo-location`, so on iOS a denial degrades to a static rose with an explanation).

Wind data auto-refreshes every 15 minutes while the tab is foregrounded, on significant location change (> 5 km), and on pull-to-refresh. If the phone's compass accuracy degrades (heading accuracy worse than ~±20°), show a non-blocking "wave your phone in a figure-8 to calibrate" toast.

### 4.3 Acceptance criteria

The rose tracks device rotation at a perceived 60fps with no visible stutter or "snap" when crossing 0°/360°. Wind direction shown matches the weather API to the degree. The relative-wind chip flips correctly (facing 90°, wind from 270° → "Tailwind"). Works in airplane mode with stale-but-labeled wind data from cache.

## 5. Tab 2 — Segment Hunter

### 5.1 UX

If not connected to Strava: a single "Connect with Strava" screen using Strava's brand-compliant button, a one-paragraph explanation of what we read (segments and your PRs — never posting anything), and the OAuth flow on tap.

When connected: a ranked list of segments, best wind advantage first. Two source filters as pills at the top: **Starred** (the user's starred segments, anywhere) and **Nearby** (segment explorer within a ~10 km box around current location), with Starred ∪ Nearby as the default view. Each row shows:

- Segment name, distance, average grade.
- A wind badge: 🟢 _Strong tailwind_, 🟢 _Tailwind_, ⚪ _Neutral / crosswind_, 🔴 _Headwind_, driven by the score in §8.2.
- The effective tailwind component in km/h and the share of the segment that is downwind (e.g., "+14 km/h effective · 82% of distance").
- The user's PR time on that segment if available, and a rough "wind-adjusted potential" hint (v1 keeps this qualitative: "Good PR conditions").
- A small inline map thumbnail or bearing glyph showing segment direction vs. wind arrow.

Tapping a row opens a detail sheet: mini-map of the decoded polyline with the wind vector overlaid, per-section wind breakdown (which parts of the segment are tail/cross/headwind), PR and effort count, and a "Open in Strava" deep link (`strava://segments/{id}`, falling back to the web URL).

A header banner summarizes conditions: "Wind 18 km/h from SW — 6 of your segments have a tailwind right now."

### 5.2 Behavior & states

Segments and their geometry are cached aggressively (polylines never change), so day-to-day usage costs very few Strava API calls: a typical refresh is one starred-segments call and one explore call, with wind math done locally. Scores recompute locally whenever wind data refreshes — no extra Strava calls. Handle: token expiry (silent refresh), Strava rate-limit responses (show cached list with a banner), empty states (no starred segments → nudge toward Nearby; rural area with no explorer results → widen the box once, then show empty state), and revoked access (deauthorize webhook is out of scope for v1; detect 401 and return to connect screen).

### 5.3 Acceptance criteria

OAuth round-trip completes in-app without manual copy/paste. Ranking visibly reorders when wind direction changes materially. A segment that runs dead downwind ranks above an equal segment running crosswind. Deep link opens the correct segment in the Strava app.

## 6. System Architecture

The app is client-only except for one tiny serverless component required by Strava's OAuth design (§7.3).

```
┌────────────────────────── Expo App ──────────────────────────┐
│ expo-router tabs                                             │
│  ├── (tabs)/compass.tsx      ── CompassView (reanimated+svg) │
│  └── (tabs)/segments.tsx     ── SegmentList / ConnectScreen  │
│                                                              │
│ hooks/    useHeading, useWind, useStravaAuth, useSegments    │
│ services/ weather.ts (Open-Meteo)                            │
│           strava.ts (REST client + token refresh)            │
│ lib/      windMath.ts (scoring), polyline.ts, angles.ts      │
│ state/    react-query cache + expo-secure-store (tokens)     │
└──────────────┬───────────────────────┬───────────────────────┘
               │                       │
        Open-Meteo API         Strava API v3 ◄── token exchange via
        (no auth, free)                          serverless proxy
                                                 (Cloudflare Worker)
```

Directory layout follows Expo Router conventions: `app/(tabs)/_layout.tsx`, `app/(tabs)/compass.tsx`, `app/(tabs)/segments.tsx`, `app/segment/[id].tsx` for the detail sheet, plus `src/{hooks,services,lib,components}`.

## 7. External APIs

### 7.1 Weather — Open-Meteo

Open-Meteo's forecast endpoint is free for non-commercial use, needs no API key, and returns current wind at 10 m: `GET https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh`. One critical convention: **`wind_direction_10m` is the direction the wind comes FROM** (meteorological standard — a 270° wind blows west→east). All internal math converts to the "blowing toward" direction: `toDir = (fromDir + 180) % 360`. Cache responses for 15 minutes keyed on a ~1 km location grid.

### 7.2 Strava API v3

| Purpose                | Endpoint                                                                                       | Scope                           | Notes                                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Starred segments       | `GET /api/v3/segments/starred`                                                                 | `read`                          | Paginated; includes distance, avg grade, start/end latlng                                       |
| Nearby discovery       | `GET /api/v3/segments/explore?bounds={sw_lat},{sw_lng},{ne_lat},{ne_lng}&activity_type=riding` | `read`                          | Returns ≤10 segments incl. an encoded `points` polyline — enough to score without a detail call |
| Segment detail + PR    | `GET /api/v3/segments/{id}`                                                                    | `read` (`read_all` for private) | `map.polyline` for geometry; `athlete_segment_stats.pr_elapsed_time` for the user's PR          |
| Token exchange/refresh | `POST /oauth/token`                                                                            | —                               | Requires `client_secret` → proxied, see §7.3                                                    |

Rate limits for an unapproved app default to roughly 100 requests per 15 minutes and 1,000/day, which the caching strategy in §5.2 keeps us far below. Strava's brand guidelines require the official "Connect with Strava" button and a "Powered by Strava" attribution; both are in scope for v1.

### 7.3 Strava OAuth flow (the one hard part)

Strava uses authorization-code OAuth but does **not** support PKCE, so the code→token exchange requires the app's `client_secret`. Shipping that secret inside a mobile binary is extractable, so the spec calls for a ~40-line serverless proxy (Cloudflare Worker or Vercel function) that holds the secret and exposes two endpoints: `/exchange` (code → tokens) and `/refresh` (refresh_token → tokens). The mobile app never sees the secret.

Flow: app opens `https://www.strava.com/oauth/mobile/authorize?client_id=…&redirect_uri=windward://redirect&response_type=code&scope=read,activity:read` via `expo-auth-session` → Strava app or web sheet handles login/consent → redirect back with `code` → app POSTs code to the proxy → proxy returns `{access_token, refresh_token, expires_at}` → stored in `expo-secure-store`. Access tokens live ~6 hours; the Strava client wrapper transparently refreshes when `expires_at` is within 5 minutes. (If you want to skip the proxy entirely during personal-use development, embedding the secret works and the spec treats the proxy as a pre-launch requirement rather than a day-one one.)

## 8. Core Algorithms

### 8.1 Compass heading pipeline

Source: `Location.watchHeadingAsync()` from `expo-location`, which fuses magnetometer + gyro and returns `trueHeading` (declination-corrected using the location fix) plus an `accuracy` value. Fall back to `magHeading` if no location fix yet, and note the ~0–15° declination caveat in the UI only if we're stuck on magnetic north.

Smoothing must handle the 359°→0° wraparound. Rather than filtering degrees directly, convert each reading to a unit vector and low-pass filter in vector space:

```
sx ← α·sin(θ) + (1−α)·sx        α ≈ 0.15–0.25
cy ← α·cos(θ) + (1−α)·cy
smoothed θ = atan2(sx, cy)
```

The smoothed heading feeds a `useSharedValue` in Reanimated; the SVG rose rotates via an animated transform on the UI thread, so React re-renders (which happen only when the displayed integer degree changes) never block rotation. Relative wind for the readout chip is `signedDelta(windToDir, heading)` where `signedDelta` returns −180…+180: |Δ| ≤ 45° → tailwind, ≥ 135° → headwind, otherwise crosswind (left/right by sign), with effective component `windSpeed · cos(Δ)`.

### 8.2 Wind-advantage scoring for a segment

A segment is rarely a straight line, so scoring uses the full geometry:

1. Decode the segment polyline into points `p₀…pₙ`.
2. For each leg `i`, compute its bearing `βᵢ` (great-circle initial bearing) and length `dᵢ`.
3. Per-leg tailwind component: `tᵢ = v_wind · cos(βᵢ − windToDir)` — positive is tailwind, negative headwind.
4. **Effective tailwind** = distance-weighted mean `Σ(tᵢ·dᵢ) / Σdᵢ`, and **downwind share** = `Σ(dᵢ where |βᵢ − windToDir| ≤ 60°) / Σdᵢ`.
5. **Grade damping:** aero drag dominates when you're fast; on steep climbs wind barely matters. Multiply the effective tailwind by `g = clamp(1 − avgGrade/8, 0.2, 1)` (an 8% grade segment keeps only ~20% of its wind score). This keeps a windy day from surfacing climbs where the tailwind is irrelevant.
6. **Score** = damped effective tailwind in km/h. Badges: ≥ 10 → Strong tailwind, ≥ 4 → Tailwind, > −4 → Neutral/crosswind, else Headwind. Sort descending; tiebreak by downwind share.

All angle math lives in a pure `lib/windMath.ts` with unit tests covering wraparound, meteorological-direction conversion, and known fixtures (e.g., due-north segment, 20 km/h wind from 180° → +20 effective).

## 9. Data Models (TypeScript)

```ts
interface Wind {
  speedKmh: number
  gustKmh: number
  fromDeg: number
  toDeg: number
  fetchedAt: number
  lat: number
  lon: number
}

interface Segment {
  id: number
  name: string
  distanceM: number
  avgGrade: number
  polyline: string
  source: "starred" | "explore"
  prElapsedS?: number
  effortCount?: number
}

interface ScoredSegment extends Segment {
  effectiveTailwindKmh: number
  downwindShare: number
  badge: "strong" | "tail" | "neutral" | "head"
}

interface StravaTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  athleteId: number
}
```

## 10. Permissions, Privacy & Compliance

Location is when-in-use only, used for weather lookup and the explorer bounding box; never stored server-side (there is no server beyond the stateless token proxy). Strava scopes are the minimum (`read`, optionally `activity:read` for PR stats); the app is read-only and never writes to Strava. Tokens live exclusively in the device secure enclave via `expo-secure-store`. iOS `Info.plist` needs `NSLocationWhenInUseUsageDescription`; Android needs `ACCESS_FINE_LOCATION`. A "Disconnect Strava" action in settings deletes tokens and calls Strava's `/oauth/deauthorize`.

## 11. Edge Cases & Error Handling

Notable cases the implementation must handle: heading unavailable (some Android tablets lack magnetometers → show static rose + wind card); calm conditions (< 5 km/h → compass shows "Calm", segment tab shows "Wind too light to matter today" and ranks by neutral order); user far from starred segments (starred segments still scored using wind fetched _at the segment's start latlng_ when > 30 km from the user — one extra Open-Meteo call per distinct area, still free); Strava 429 (serve cache + banner); offline (both tabs render last cache with staleness labels); loop segments (net bearing ~0 → naturally score near zero via leg-weighted math, which is the correct answer).

## 12. Build Plan

**M1 — Skeleton + Compass (days 1–3):** Expo scaffold, tabs, heading hook, animated rose. Exit: rose tracks rotation smoothly on a physical device.
**M2 — Wind (days 3–5):** Open-Meteo service, wind arrow + relative-wind chip, refresh logic. Exit: Tab 1 acceptance criteria pass.
**M3 — Strava Auth (days 5–8):** Strava API app registration, token proxy, OAuth flow, secure storage, refresh. Exit: round-trip auth on device.
**M4 — Segment Hunter (days 8–12):** starred + explore fetching, polyline scoring, ranked list, detail sheet, deep links. Exit: Tab 2 acceptance criteria pass.
**M5 — Polish (days 12–15):** empty/error/offline states, units toggle, Strava branding, calibration toast, unit tests for `windMath`.

## 13. Open Questions & v2 Candidates

Open for decision now: (a) do you already have a Strava API application registered (client ID/secret)? (b) proxy or embedded secret for development? (c) iOS-first or ship Android simultaneously?

v2 ideas parked: forecast mode ("best hour today for this segment"), wind-adjusted PR time prediction using a physics model (CdA + power estimate), altitude-adjusted wind (10 m vs. rider height, terrain sheltering), push notification when a starred segment goes green, map view of all segments colored by score.
