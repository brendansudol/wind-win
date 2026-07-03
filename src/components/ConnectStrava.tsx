import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';

interface Props {
  onConnect: () => void;
  disabled: boolean;
  busy: boolean;
  error: string | null;
  configured: boolean;
}

export function ConnectStrava({ onConnect, disabled, busy, error, configured }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Find today’s tailwinds</Text>
      <Text style={styles.body}>
        Wind Win reads your starred segments and PRs to rank which ones the current wind will
        help you on. It never posts anything to Strava.
      </Text>
      {configured ? (
        <Pressable
          onPress={onConnect}
          disabled={disabled || busy}
          style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.7 }]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            // TODO: replace with the official "Connect with Strava" button asset
            // (required by Strava brand guidelines before release).
            <Text style={styles.buttonText}>Connect with Strava</Text>
          )}
        </Pressable>
      ) : (
        <View style={styles.configBox}>
          <Text style={styles.configText}>
            Strava isn’t configured yet. Add EXPO_PUBLIC_STRAVA_CLIENT_ID (and a client secret or
            token-proxy URL) to a .env file — see .env.example.
          </Text>
        </View>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      <Text style={styles.attribution}>Powered by Strava</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: { color: colors.text, fontSize: 24, fontWeight: '800' },
  body: { color: colors.textDim, fontSize: 15, textAlign: 'center', lineHeight: 22 },
  button: {
    backgroundColor: colors.strava,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    minWidth: 240,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  configBox: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
  },
  configText: { color: colors.yellow, fontSize: 14, lineHeight: 20 },
  error: { color: colors.red, fontSize: 14, textAlign: 'center' },
  attribution: { color: colors.textDim, fontSize: 12, marginTop: 24 },
});
