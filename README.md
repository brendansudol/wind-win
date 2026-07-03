# Wind Win 🌬️🚴

A cycling companion app (a play on "win-win"): point your phone to see live wind on a
device-oriented compass, and rank your Strava segments by how much today's wind will help
you set a PR. Built with Expo (React Native) + TypeScript per [spec.md](spec.md).

## Tabs

- **Compass** — a rose that counter-rotates with the device so north stays true, a wind
  arrow anchored to the real-world direction the wind blows *toward*, and a live
  "Tailwind / Headwind / Crosswind" chip with the effective head/tail component.
- **Segments** — after connecting Strava, your starred segments plus nearby discoveries,
  ranked by grade-damped effective tailwind, with per-leg tail/cross/head map coloring in
  the detail sheet and an "Open in Strava" deep link.

## Getting started

```bash
npm install
npx expo start        # compass tab works in Expo Go
npm run ios           # dev build — required for the Strava OAuth flow
```

The compass needs a physical device (simulators have no magnetometer). Wind data comes
from Open-Meteo — free, no API key. The Strava login round-trip needs a dev build
(`expo run:ios` / `run:android`) because the `windwin://` redirect scheme isn't
available inside Expo Go.

### Strava setup

1. Create an API application at <https://www.strava.com/settings/api>
   (set Authorization Callback Domain to `redirect`).
2. `cp .env.example .env` and fill in `EXPO_PUBLIC_STRAVA_CLIENT_ID`.
3. For personal development, also set `EXPO_PUBLIC_STRAVA_CLIENT_SECRET`.
   Before shipping, deploy the ~40-line token proxy instead
   (`npx wrangler deploy proxy/strava-token-proxy.js`) and set
   `EXPO_PUBLIC_STRAVA_TOKEN_PROXY_URL` — a secret in the binary is extractable.
4. Restart `expo start` after changing `.env`.

Before release: swap the connect button for Strava's official
["Connect with Strava"](https://developers.strava.com/guidelines/) brand asset.

## Verification

```bash
npm run typecheck     # tsc --noEmit
npm test              # unit tests for the wind/angle math (spec §8 fixtures)
```

## Layout

```
src/
  app/            expo-router screens: (tabs)/index (compass), (tabs)/segments,
                  segment/[id] (detail sheet)
  components/     CompassView, RelativeWindChip, SegmentRow, SegmentMap, ConnectStrava
  hooks/          useHeading (smoothed, wrap-free), useLocation, useWind,
                  useStravaAuth, useSegments (fetch + score + rank)
  lib/            angles, windMath (scoring per spec §8.2), geometry, format, types
  services/       weather (Open-Meteo + offline cache), strava (REST), stravaAuth (tokens)
proxy/            Cloudflare Worker holding the Strava client secret
```
