import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, ThemeProvider } from 'expo-router';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

import { colors } from '@/constants/theme';
import { UnitsProvider } from '@/state/units';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
});

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.background,
    text: colors.text,
    border: colors.cardBorder,
    primary: colors.accent,
  },
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <UnitsProvider>
        <ThemeProvider value={navTheme}>
          <StatusBar style="light" />
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="segment/[id]"
              options={{ presentation: 'modal', title: 'Segment' }}
            />
          </Stack>
        </ThemeProvider>
      </UnitsProvider>
    </QueryClientProvider>
  );
}
