import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import React, { useMemo } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { SegmentMap } from '@/components/SegmentMap';
import { badgeStyles, colors } from '@/constants/theme';
import { formatDistance, formatDuration, formatSignedSpeed } from '@/lib/format';
import { segmentPoints } from '@/lib/geometry';
import type { Segment } from '@/lib/types';
import { CALM_THRESHOLD_KMH, legShares, scoreSegment } from '@/lib/windMath';
import { useLocation } from '@/hooks/useLocation';
import { useWind } from '@/hooks/useWind';
import { getSegmentDetail, isStravaRateLimited } from '@/services/strava';
import { useUnits } from '@/state/units';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Look for the tapped segment in the already-fetched lists (summary fallback). */
function useCachedSummary(id: number): Segment | undefined {
  const queryClient = useQueryClient();
  return useMemo(() => {
    for (const [, data] of queryClient.getQueriesData<Segment[]>({ queryKey: ['strava'] })) {
      const hit = data?.find((s) => s.id === id);
      if (hit) return hit;
    }
    return undefined;
  }, [queryClient, id]);
}

export default function SegmentDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = Number(params.id);
  const { units } = useUnits();
  const location = useLocation();
  const wind = useWind(location.coords);
  const cached = useCachedSummary(id);

  const detail = useQuery({
    queryKey: ['strava', 'segment', id],
    queryFn: () => getSegmentDetail(id),
    enabled: Number.isFinite(id),
    // Polylines never change; PR/effort counts rarely do.
    staleTime: DAY_MS,
    gcTime: 30 * DAY_MS,
    retry: false,
  });

  const segment = detail.data ?? cached;
  const points = useMemo(() => (segment ? segmentPoints(segment) : []), [segment]);
  const calm = wind.data != null && wind.data.speedKmh < CALM_THRESHOLD_KMH;

  const score = useMemo(() => {
    if (!segment || !wind.data || points.length < 2) return null;
    return scoreSegment(points, wind.data.speedKmh, wind.data.toDeg, segment.avgGrade);
  }, [segment, wind.data, points]);

  const openInStrava = async () => {
    const appUrl = `strava://segments/${id}`;
    const webUrl = `https://www.strava.com/segments/${id}`;
    try {
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return;
      }
    } catch {
      // fall through to web
    }
    Linking.openURL(webUrl).catch(() => {});
  };

  if (!segment) {
    return detail.isLoading ? (
      <ActivityIndicator style={styles.loader} color={colors.textDim} />
    ) : (
      <View style={styles.center}>
        <Text style={styles.dim}>
          {isStravaRateLimited(detail.error)
            ? 'Strava rate limit reached — try again in a few minutes.'
            : 'Couldn’t load this segment.'}
        </Text>
      </View>
    );
  }

  const badge = score ? badgeStyles[score.badge] : null;
  const shares = score ? legShares(score.legs) : null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: segment.name }} />
      <Text style={styles.name}>{segment.name}</Text>
      <Text style={styles.meta}>
        {formatDistance(segment.distanceM, units)} · {segment.avgGrade.toFixed(1)}% avg grade
        {'city' in segment && segment.city ? ` · ${segment.city}` : ''}
      </Text>

      {points.length >= 2 && (
        <View style={styles.mapCard}>
          <SegmentMap points={points} windToDeg={calm ? null : (wind.data?.toDeg ?? null)} />
          <Text style={styles.mapLegend}>
            <Text style={{ color: colors.green }}>● tailwind</Text>{'  '}
            <Text style={{ color: colors.textDim }}>● crosswind</Text>{'  '}
            <Text style={{ color: colors.red }}>● headwind</Text>
          </Text>
        </View>
      )}

      {calm ? (
        <Text style={styles.dim}>Wind is too light to matter on this segment today.</Text>
      ) : score && badge && shares ? (
        <View style={styles.scoreCard}>
          <Text style={[styles.badge, { color: badge.color }]}>
            {badge.emoji} {badge.label}
          </Text>
          <Text style={styles.scoreLine}>
            {formatSignedSpeed(score.effectiveTailwindKmh, units)} effective ·{' '}
            {Math.round(score.downwindShare * 100)}% of distance downwind
          </Text>
          <Text style={styles.shares}>
            Tail {Math.round(shares.tail * 100)}% · Cross {Math.round(shares.cross * 100)}% · Head{' '}
            {Math.round(shares.head * 100)}%
          </Text>
          {score.badge === 'strong' && <Text style={styles.hint}>Good PR conditions</Text>}
        </View>
      ) : (
        <Text style={styles.dim}>Waiting for wind data…</Text>
      )}

      <View style={styles.statsRow}>
        {segment.prElapsedS != null && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{formatDuration(segment.prElapsedS)}</Text>
            <Text style={styles.statLabel}>Your PR</Text>
          </View>
        )}
        {segment.effortCount != null && (
          <View style={styles.stat}>
            <Text style={styles.statValue}>{segment.effortCount.toLocaleString()}</Text>
            <Text style={styles.statLabel}>Efforts</Text>
          </View>
        )}
      </View>

      <Pressable onPress={openInStrava} style={styles.stravaButton}>
        <Text style={styles.stravaButtonText}>Open in Strava</Text>
      </Pressable>
      <Text style={styles.attribution}>Powered by Strava</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, alignItems: 'center' },
  loader: { marginTop: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  name: { color: colors.text, fontSize: 22, fontWeight: '800', textAlign: 'center' },
  meta: { color: colors.textDim, fontSize: 14 },
  mapCard: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 8,
    alignItems: 'center',
    gap: 6,
  },
  mapLegend: { fontSize: 12, paddingBottom: 4 },
  scoreCard: { alignItems: 'center', gap: 4 },
  badge: { fontSize: 17, fontWeight: '800' },
  scoreLine: { color: colors.text, fontSize: 15 },
  shares: { color: colors.textDim, fontSize: 13 },
  hint: { color: colors.green, fontSize: 13, fontStyle: 'italic' },
  dim: { color: colors.textDim, fontSize: 14, textAlign: 'center' },
  statsRow: { flexDirection: 'row', gap: 28 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.yellow, fontSize: 20, fontWeight: '800' },
  statLabel: { color: colors.textDim, fontSize: 12 },
  stravaButton: {
    backgroundColor: colors.strava,
    borderRadius: 10,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 6,
  },
  stravaButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  attribution: { color: colors.textDim, fontSize: 12 },
});
