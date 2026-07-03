import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ConnectStrava } from '@/components/ConnectStrava';
import { SegmentRow } from '@/components/SegmentRow';
import { colors } from '@/constants/theme';
import { cardinalFromDeg } from '@/lib/angles';
import { formatSpeed } from '@/lib/format';
import { CALM_THRESHOLD_KMH } from '@/lib/windMath';
import {
  mergeSegments,
  useNearbySegments,
  useScoredSegments,
  useStarredSegments,
  type SegmentFilter,
} from '@/hooks/useSegments';
import { useLocation } from '@/hooks/useLocation';
import { useStravaAuth } from '@/hooks/useStravaAuth';
import { useWind } from '@/hooks/useWind';
import { isStravaAuthError, isStravaRateLimited } from '@/services/strava';
import { useUnits } from '@/state/units';

const FILTERS: Array<{ key: SegmentFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'starred', label: 'Starred' },
  { key: 'nearby', label: 'Nearby' },
];

export default function SegmentsScreen() {
  const router = useRouter();
  const auth = useStravaAuth();
  const { units } = useUnits();
  const location = useLocation();
  const wind = useWind(location.coords);
  const [filter, setFilter] = useState<SegmentFilter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const starred = useStarredSegments(auth.isConnected);
  const nearby = useNearbySegments(auth.isConnected, location.coords);

  // A 401 means access was revoked — tokens were cleared, drop back to connect.
  useEffect(() => {
    if (isStravaAuthError(starred.error) || isStravaAuthError(nearby.error)) auth.reload();
  }, [starred.error, nearby.error, auth]);

  const segments = useMemo(() => {
    const starredList = filter === 'nearby' ? [] : (starred.data ?? []);
    const nearbyList = filter === 'starred' ? [] : (nearby.data ?? []);
    return mergeSegments(starredList, nearbyList);
  }, [starred.data, nearby.data, filter]);

  const scored = useScoredSegments(segments, wind.data, location.coords);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([wind.refetch(), starred.refetch(), nearby.refetch()]);
    setRefreshing(false);
  }, [wind, starred, nearby]);

  if (auth.isLoading) {
    return <ActivityIndicator style={styles.loader} color={colors.textDim} />;
  }

  if (!auth.isConnected) {
    return (
      <ConnectStrava
        onConnect={auth.connect}
        disabled={!auth.canPrompt}
        busy={auth.exchanging}
        error={auth.error}
        configured={auth.isConfigured}
      />
    );
  }

  const calm = wind.data != null && wind.data.speedKmh < CALM_THRESHOLD_KMH;
  const rateLimited = isStravaRateLimited(starred.error) || isStravaRateLimited(nearby.error);
  const tailwindCount = (scored.data ?? []).filter(
    (s) => s.badge === 'tail' || s.badge === 'strong',
  ).length;
  const loading = starred.isLoading || nearby.isLoading || scored.isLoading;

  const emptyText =
    filter === 'starred'
      ? 'No starred segments yet — star some on Strava, or try Nearby.'
      : filter === 'nearby'
        ? location.permission === 'denied'
          ? 'Location is needed to find nearby segments.'
          : 'No rideable segments found around here.'
        : 'No segments yet. Star segments on Strava or check Nearby discovery.';

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {FILTERS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setFilter(key)}
            style={[styles.pill, filter === key && styles.pillActive]}
          >
            <Text style={[styles.pillText, filter === key && styles.pillTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {wind.data && (
        <Text style={styles.banner}>
          {calm
            ? 'Wind too light to matter today — showing neutral order.'
            : `Wind ${formatSpeed(wind.data.speedKmh, units)} from ${cardinalFromDeg(wind.data.fromDeg)} — ${tailwindCount} segment${tailwindCount === 1 ? '' : 's'} with a tailwind right now.`}
        </Text>
      )}

      {rateLimited && (
        <Text style={styles.rateLimit}>Strava rate limit reached — showing cached data.</Text>
      )}

      <FlatList
        data={scored.data ?? []}
        keyExtractor={(s) => String(s.id)}
        renderItem={({ item }) => (
          <SegmentRow
            segment={item}
            windToDeg={wind.data?.toDeg ?? 0}
            units={units}
            calm={calm}
            onPress={() =>
              router.push({ pathname: '/segment/[id]', params: { id: String(item.id) } })
            }
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loader} color={colors.textDim} />
          ) : (
            <Text style={styles.empty}>{emptyText}</Text>
          )
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Text style={styles.attribution}>Powered by Strava</Text>
            <Pressable onPress={auth.disconnect}>
              <Text style={styles.disconnect}>Disconnect Strava</Text>
            </Pressable>
          </View>
        }
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 48 },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  pill: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  pillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  pillText: { color: colors.textDim, fontWeight: '600', fontSize: 14 },
  pillTextActive: { color: colors.background },
  banner: {
    color: colors.text,
    fontSize: 14,
    paddingHorizontal: 16,
    paddingBottom: 10,
    lineHeight: 20,
  },
  rateLimit: {
    color: colors.yellow,
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  empty: {
    color: colors.textDim,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
    lineHeight: 20,
  },
  listContent: { paddingBottom: 24 },
  footer: { alignItems: 'center', gap: 8, paddingTop: 20 },
  attribution: { color: colors.textDim, fontSize: 12 },
  disconnect: { color: colors.red, fontSize: 13 },
});
