# Release runbook — getting Wind Win into the App Store

The path is: personal dev build → TestFlight → App Store review. Android/Play Store is the
same shape via EAS and can wait. Items marked ⚠️ are external accounts/approvals with lead
time — start those first.

## 0. Prerequisites (one-time)

- ⚠️ **Apple Developer Program** ($99/yr) — needed for TestFlight and the App Store.
  The bundle ID is already set (`com.brendansudol.windwin` in app.json); register it in the
  developer portal (EAS can do this automatically on first build).
- **Expo account + EAS CLI** — `npm i -g eas-cli && eas login && eas build:configure`
  (creates `eas.json` with development/preview/production profiles).
- ⚠️ **Strava production readiness** — two separate things:
  1. *Rate/athlete capacity:* new Strava API apps run in "single-player mode" (only the
     app owner can authorize). Distributing to anyone else requires requesting increased
     athlete capacity from Strava — this is a review with real lead time. Personal
     TestFlight use is fine without it.
  2. *Brand compliance:* the official "Connect with Strava" button asset and "Powered by
     Strava" attribution are required (see the TODO in `src/components/ConnectStrava.tsx`).
- **Open-Meteo licensing** — free tier is non-commercial. Fine for a free app; if the app
  ever charges, budget for their paid API plan.

## 1. Before the first store build

- [ ] Deploy the token proxy: `npx wrangler deploy proxy/strava-token-proxy.js`, set the
      two secrets, then put the worker URL in `EXPO_PUBLIC_STRAVA_TOKEN_PROXY_URL` and
      **remove** `EXPO_PUBLIC_STRAVA_CLIENT_SECRET`. `EXPO_PUBLIC_*` values are baked into
      the bundle — a secret in a store build is public.
- [ ] Move env vars into EAS: `eas env:create` (or `eas.json` `env` blocks) so CI builds
      get the client ID / proxy URL without a local `.env`.
- [ ] Real app icon + splash (still Expo template art: `assets/images/`, `assets/expo.icon/`).
- [ ] Swap in the official Strava connect button asset.
- [ ] Complete the on-device acceptance criteria from spec §4.3/§5.3 (compass smoothness,
      OAuth round-trip, ranking sanity) — App Review will exercise the app on hardware.

## 2. TestFlight

```bash
eas build --platform ios --profile production
eas submit --platform ios          # uploads to App Store Connect
```

In App Store Connect: create the app record (name "Wind Win" — check availability early),
add yourself + friends as internal testers. Iterate here until the compass and rankings
hold up on real rides. OTA fixes for JS-only changes can ship via `eas update` without a
new build/review.

## 3. App Store review specifics for this app

- **App Privacy questionnaire:** declares Location (approximate/precise, not linked to
  identity, used for app functionality only — weather + nearby segments, never stored
  server-side) and the Strava account linkage. The honest answer is "data not collected"
  for everything except what Strava's own OAuth implies.
- **Purpose strings:** already set (`NSLocationWhenInUseUsageDescription` in app.json) —
  review rejects vague ones, ours states the concrete use.
- **Sign-in:** Strava OAuth is fine without "Sign in with Apple" because it's not a
  general login — the app works (compass tab) with no account at all. Make sure the
  reviewer can see Tab 1 works without connecting Strava; add App Review notes explaining
  the Strava connection is optional and read-only.
- **Demo for review:** App Review may not have a Strava account. In the review notes,
  offer a test account or point out the Segments tab's disconnected state is by design.
- **Deep link:** `strava://` needs `LSApplicationQueriesSchemes` on iOS for
  `canOpenURL` — already set in app.json; keep it if the infoPlist block is ever reworked.

## 4. After approval

- Request Strava athlete-capacity increase before announcing anywhere (see step 0).
- Watch Strava rate limits (100 req/15 min shared across all users of one client ID —
  the aggressive caching in the app is what keeps this viable; don't weaken it).
- Set up `eas update` channels so JS fixes ship OTA; native/module changes still need a
  new build + review.
