import { makeRedirectUri, ResponseType, useAuthRequest } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useState } from 'react';

import { isStravaConfigured, STRAVA_CLIENT_ID } from '@/lib/config';
import type { StravaTokens } from '@/lib/types';
import { disconnectStrava, exchangeCode, getStoredTokens } from '@/services/stravaAuth';

WebBrowser.maybeCompleteAuthSession();

const discovery = {
  // The /mobile/ endpoint lets the Strava app handle consent when installed.
  authorizationEndpoint: 'https://www.strava.com/oauth/mobile/authorize',
  tokenEndpoint: 'https://www.strava.com/oauth/token',
};

const redirectUri = makeRedirectUri({ scheme: 'windwin', path: 'redirect' });

export function useStravaAuth() {
  // undefined = still loading from secure storage
  const [tokens, setTokens] = useState<StravaTokens | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);

  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: STRAVA_CLIENT_ID,
      // Strava expects comma-separated scopes; pass as one entry so the
      // space-joined encoding doesn't split them.
      scopes: ['read,activity:read'],
      redirectUri,
      responseType: ResponseType.Code,
      usePKCE: false, // Strava does not support PKCE
    },
    discovery,
  );

  const reload = useCallback(() => {
    getStoredTokens().then(setTokens);
  }, []);

  useEffect(reload, [reload]);

  useEffect(() => {
    if (response?.type === 'success' && response.params.code) {
      setExchanging(true);
      setError(null);
      exchangeCode(response.params.code)
        .then(setTokens)
        .catch((e: Error) => setError(e.message))
        .finally(() => setExchanging(false));
    } else if (response?.type === 'error') {
      setError(response.error?.message ?? 'Strava authorization failed');
    }
  }, [response]);

  const connect = useCallback(() => {
    setError(null);
    promptAsync();
  }, [promptAsync]);

  const disconnect = useCallback(async () => {
    await disconnectStrava();
    setTokens(null);
  }, []);

  return {
    isConfigured: isStravaConfigured(),
    isLoading: tokens === undefined,
    isConnected: tokens != null,
    exchanging,
    canPrompt: request != null,
    error,
    connect,
    disconnect,
    /** Re-read tokens from storage (e.g. after a 401 cleared them). */
    reload,
  };
}
