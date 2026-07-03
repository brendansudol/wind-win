# Agent notes — Wind Win

Orientation for anyone (human or agent) continuing work on this app. The product/technical
spec is [spec.md](../spec.md); user-facing setup is in [README.md](../README.md). This file
holds the things that aren't obvious from either.

## State of the build (as of 2026-07-02)

Everything in the v1 spec is implemented. Verified so far: 32 unit tests over the wind/angle
math (`npm test`), clean `tsc --noEmit`, and both tabs exercised in a browser via
`expo start --web` with live Open-Meteo data. **Not yet verified:** compass rotation on a
physical device (spec §4.3 acceptance criteria — needs a real magnetometer) and the Strava
OAuth round-trip (needs API credentials in `.env` plus a dev build).

Remaining pre-release items, in rough order:

1. On-device compass smoke test (`npm run ios`).
2. Strava credentials → test OAuth, ranking, deep links against real segments.
3. Deploy `proxy/strava-token-proxy.js` (Cloudflare Worker) and switch `.env` from the
   embedded dev secret to `EXPO_PUBLIC_STRAVA_TOKEN_PROXY_URL`.
4. Replace the placeholder connect button with Strava's official brand asset
   (TODO comment in `src/components/ConnectStrava.tsx` — required by Strava guidelines).
5. Real app icon / splash (still the Expo template art).

v2 candidate features are listed in spec §13.

## Core invariants (do not break these)

- **Wind direction convention:** Open-Meteo (like all meteorology) reports where wind comes
  *FROM*. Everything internal — scoring, the compass arrow, leg classification — uses the
  *TOWARD* direction (`meteoToDir` in `src/lib/windMath.ts`). If a wind angle looks 180° off,
  this is why.
- **Angle math lives in `src/lib/angles.ts` / `windMath.ts`** — pure, no RN imports, fully
  unit-tested. Add fixtures to `src/lib/__tests__/` when touching scoring. Note the badge
  boundary: score ≥ 4 km/h is "Tailwind", and 20 km/h × 0.2 grade damping = 4.0 lands
  exactly on it (there's a test pinning this).
- **Heading pipeline** (`src/hooks/useHeading.ts`): raw headings are low-pass filtered in
  unit-vector space (sin/cos) to survive the 359°→0° wrap, then accumulated into a
  *continuous unwrapped* angle fed to a Reanimated shared value. The rose rotates by its
  negation on the UI thread. Don't route rotation through React state, and don't normalize
  the continuous angle — both reintroduce the snap the spec forbids.
- **Strava API budget:** polylines never change, so segment geometry is cached hard
  (react-query `staleTime` hours-to-days). Wind refreshes recompute scores *locally* with
  zero Strava calls. Keep it that way — unapproved apps get ~100 req/15 min.
- **Starred segment summaries have no polyline** (explore results do, via `points`).
  `segmentPoints()` falls back to a single start→end leg for ranking; the full polyline
  arrives when the detail screen fetches `GET /segments/{id}`.

## Environment & tooling gotchas (each cost real debugging time)

- **jest must stay on 29.x.** jest-expo 57's internals are built against jest 29; jest 30
  fails at runtime with `this._moduleMocker.clearMocksOnScope is not a function`.
  `@react-native/jest-preset` also has to be an explicit devDependency, and some installs
  need `--legacy-peer-deps` (jest-expo pins @react-native/jest-preset ^0.85 vs RN 0.86).
- **tsconfig has `"types": ["jest"]`** — without it, TS 6 doesn't pick up @types/jest and
  every test file errors on `describe`/`it`/`expect`.
- **react-native-svg on web:** the `rotation`/`origin` props on `<G>` emit invalid
  `transform-origin` DOM attributes. Use SVG transform strings instead:
  `transform={`rotate(${deg} ${cx} ${cy})`}`. Same story for the `pointerEvents` prop on
  Views — put it in `style`.
- **Web has no compass heading.** `useHeading` short-circuits on `Platform.OS === 'web'`
  (expo-location only logs a warning there rather than throwing, so a try/catch is not
  enough to detect it).
- **Heading accuracy units differ by platform:** degrees on iOS (bigger = worse), a 0–3
  confidence level on Android (smaller = worse). See `isAccuracyPoor` in
  `src/app/(tabs)/index.tsx`.
- **Strava OAuth cannot run in Expo Go** — the `windwin://` redirect scheme needs a dev
  build (`npm run ios` / `npm run android`). Strava also has no PKCE (hence the token
  proxy) and expects comma-separated scopes, passed as a single array entry
  (`scopes: ['read,activity:read']`) so expo-auth-session's space-joining doesn't split them.
- **`EXPO_PUBLIC_*` env vars are baked into the JS bundle at build time.** Fine for the
  client ID; the client secret must move to the proxy before any build is distributed.
  Restart `expo start` after editing `.env`.
- **`EXPO_PUBLIC_DEV_FAKE_LOCATION="lat,lon"`** (dev-only, in `.env`) substitutes a fixed
  location when permission is denied — how the app gets exercised in headless browser
  previews where geolocation is blocked.

## How to verify changes

```bash
npm test              # wind math + geometry fixtures (fast, pure TS)
npm run typecheck
npx expo start --web  # or the "wind-win-web" entry in .claude/launch.json
```

The web preview exercises: wind fetch/display, unit toggle + persistence, permission-denied
and heading-unavailable states, the Strava connect screen, and navigation. It cannot
exercise: rose rotation, the relative-wind chip (needs a heading), or anything behind
Strava auth. For those, use a physical device.
