/**
 * Strava app credentials. Set these in a `.env` file (see `.env.example`).
 *
 * For personal-use development you may set EXPO_PUBLIC_STRAVA_CLIENT_SECRET and
 * the app will exchange tokens directly with Strava. Before any real release,
 * deploy the token proxy in `proxy/` and set EXPO_PUBLIC_STRAVA_TOKEN_PROXY_URL
 * instead — a secret shipped in an app binary is extractable.
 */
export const STRAVA_CLIENT_ID = process.env.EXPO_PUBLIC_STRAVA_CLIENT_ID ?? '';
export const STRAVA_CLIENT_SECRET = process.env.EXPO_PUBLIC_STRAVA_CLIENT_SECRET ?? '';
export const STRAVA_TOKEN_PROXY_URL = process.env.EXPO_PUBLIC_STRAVA_TOKEN_PROXY_URL ?? '';

export const isStravaConfigured = () =>
  STRAVA_CLIENT_ID.length > 0 && (STRAVA_CLIENT_SECRET.length > 0 || STRAVA_TOKEN_PROXY_URL.length > 0);
