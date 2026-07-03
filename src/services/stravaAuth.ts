import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import { STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET, STRAVA_TOKEN_PROXY_URL } from '@/lib/config';
import type { StravaTokens } from '@/lib/types';

const TOKENS_KEY = 'strava-tokens';

// SecureStore is unavailable on web; fall back to AsyncStorage there (dev only).
const store = {
  get: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.getItem(key) : SecureStore.getItemAsync(key),
  set: (key: string, value: string) =>
    Platform.OS === 'web' ? AsyncStorage.setItem(key, value) : SecureStore.setItemAsync(key, value),
  delete: (key: string) =>
    Platform.OS === 'web' ? AsyncStorage.removeItem(key) : SecureStore.deleteItemAsync(key),
};

export async function getStoredTokens(): Promise<StravaTokens | null> {
  try {
    const raw = await store.get(TOKENS_KEY);
    return raw ? (JSON.parse(raw) as StravaTokens) : null;
  } catch {
    return null;
  }
}

export async function storeTokens(tokens: StravaTokens) {
  await store.set(TOKENS_KEY, JSON.stringify(tokens));
}

export async function clearTokens() {
  await store.delete(TOKENS_KEY).catch(() => {});
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}

/**
 * Exchange or refresh via the token proxy when configured, otherwise directly
 * against Strava using the embedded dev secret (see lib/config.ts).
 */
async function tokenRequest(
  kind: 'exchange' | 'refresh',
  params: Record<string, string>,
): Promise<TokenResponse> {
  let res: Response;
  if (STRAVA_TOKEN_PROXY_URL) {
    res = await fetch(`${STRAVA_TOKEN_PROXY_URL.replace(/\/$/, '')}/${kind}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
  } else {
    const body = new URLSearchParams({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      ...params,
      grant_type: kind === 'exchange' ? 'authorization_code' : 'refresh_token',
    });
    res = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  }
  if (!res.ok) throw new Error(`Strava token ${kind} failed (${res.status})`);
  return (await res.json()) as TokenResponse;
}

export async function exchangeCode(code: string): Promise<StravaTokens> {
  const json = await tokenRequest('exchange', { code });
  const tokens: StravaTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at,
    athleteId: json.athlete?.id ?? 0,
  };
  await storeTokens(tokens);
  return tokens;
}

export async function refreshTokens(current: StravaTokens): Promise<StravaTokens> {
  const json = await tokenRequest('refresh', { refresh_token: current.refreshToken });
  const tokens: StravaTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: json.expires_at,
    athleteId: current.athleteId,
  };
  await storeTokens(tokens);
  return tokens;
}

const REFRESH_MARGIN_S = 5 * 60;

/** Valid access token, transparently refreshing when within 5 min of expiry. */
export async function getValidAccessToken(): Promise<string | null> {
  let tokens = await getStoredTokens();
  if (!tokens) return null;
  if (tokens.expiresAt - Date.now() / 1000 < REFRESH_MARGIN_S) {
    try {
      tokens = await refreshTokens(tokens);
    } catch {
      return null;
    }
  }
  return tokens.accessToken;
}

/** Revoke access on Strava's side (best effort) and forget local tokens. */
export async function disconnectStrava() {
  const tokens = await getStoredTokens();
  if (tokens) {
    fetch(`https://www.strava.com/oauth/deauthorize?access_token=${tokens.accessToken}`, {
      method: 'POST',
    }).catch(() => {});
  }
  await clearTokens();
}
