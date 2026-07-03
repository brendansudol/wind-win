import React, { useCallback, useMemo, useState } from 'react';
import {
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { CompassView } from '@/components/CompassView';
import { RelativeWindChip } from '@/components/RelativeWindChip';
import { colors } from '@/constants/theme';
import { cardinalFromDeg } from '@/lib/angles';
import { formatSpeed, formatTimeAgo } from '@/lib/format';
import { CALM_THRESHOLD_KMH } from '@/lib/windMath';
import { useHeading } from '@/hooks/useHeading';
import { useLocation } from '@/hooks/useLocation';
import { useWind } from '@/hooks/useWind';
import { useUnits } from '@/state/units';

const STALE_AFTER_MS = 20 * 60 * 1000;

/** Heading accuracy is degrees on iOS, a 0–3 confidence level on Android. */
const isAccuracyPoor = (accuracy: number | null) =>
  accuracy != null && (Platform.OS === 'ios' ? accuracy > 20 : accuracy <= 1);

export default function CompassScreen() {
  const { units, setUnits } = useUnits();
  const location = useLocation();
  const heading = useHeading();
  const wind = useWind(location.coords);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await location.refresh();
    await wind.refetch();
    setRefreshing(false);
  }, [location, wind]);

  const calm = wind.data != null && wind.data.speedKmh < CALM_THRESHOLD_KMH;
  const stale = wind.data != null && Date.now() - wind.data.fetchedAt > STALE_AFTER_MS;

  const windSummary = useMemo(() => {
    if (!wind.data) return null;
    return `${formatSpeed(wind.data.speedKmh, units)} from ${cardinalFromDeg(wind.data.fromDeg)} (${Math.round(wind.data.fromDeg)}°)`;
  }, [wind.data, units]);

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textDim} />
      }
    >
      {location.permission === 'denied' && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Wind Win needs your location to look up local wind conditions. The compass still
            works without it.
          </Text>
          <Pressable onPress={() => Linking.openSettings()} style={styles.noticeButton}>
            <Text style={styles.noticeButtonText}>Open Settings</Text>
          </Pressable>
        </View>
      )}

      {!heading.available && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            Compass heading isn’t available on this device, so the rose is fixed with north up.
          </Text>
        </View>
      )}

      {isAccuracyPoor(heading.accuracy) && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>
            Compass accuracy is low — wave your phone in a figure-8 to calibrate.
          </Text>
        </View>
      )}

      <View style={styles.compassWrap}>
        <CompassView
          rotation={heading.rotation}
          headingDeg={heading.headingDeg}
          windToDeg={wind.data?.toDeg ?? null}
          windSpeedKmh={wind.data?.speedKmh ?? 0}
          calm={calm}
        />
      </View>

      <RelativeWindChip headingDeg={heading.headingDeg} wind={wind.data ?? null} units={units} />

      <View style={styles.statsCard}>
        {wind.data ? (
          <>
            <Text style={styles.windMain}>{windSummary}</Text>
            <Text style={styles.windSub}>
              Gusts {formatSpeed(wind.data.gustKmh, units)}
              {location.placeName ? ` · ${location.placeName}` : ''}
            </Text>
            <Text style={[styles.updated, stale && { color: colors.yellow }]}>
              Updated {formatTimeAgo(wind.data.fetchedAt)}
              {stale ? ' — may be stale' : ''}
            </Text>
          </>
        ) : wind.isError ? (
          <Text style={styles.windSub}>
            Couldn’t load wind data{location.permission === 'denied' ? ' (location needed)' : ''}.
            Pull to retry.
          </Text>
        ) : (
          <Text style={styles.windSub}>
            {location.permission === 'pending' ? 'Waiting for location…' : 'Loading wind…'}
          </Text>
        )}
      </View>

      <View style={styles.unitsRow}>
        {(['kmh', 'mph'] as const).map((u) => (
          <Pressable
            key={u}
            onPress={() => setUnits(u)}
            style={[styles.unitPill, units === u && styles.unitPillActive]}
          >
            <Text style={[styles.unitText, units === u && styles.unitTextActive]}>
              {u === 'kmh' ? 'km/h' : 'mph'}
            </Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
    gap: 18,
    flexGrow: 1,
    justifyContent: 'center',
  },
  compassWrap: { alignItems: 'center' },
  notice: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    alignSelf: 'stretch',
  },
  noticeText: { color: colors.text, fontSize: 14, lineHeight: 20 },
  noticeButton: {
    backgroundColor: colors.accent,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  noticeButtonText: { color: colors.background, fontWeight: '700' },
  toast: {
    backgroundColor: `${colors.yellow}22`,
    borderColor: colors.yellow,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignSelf: 'stretch',
  },
  toastText: { color: colors.yellow, fontSize: 13, textAlign: 'center' },
  statsCard: { alignItems: 'center', gap: 4 },
  windMain: { color: colors.text, fontSize: 20, fontWeight: '800' },
  windSub: { color: colors.textDim, fontSize: 14 },
  updated: { color: colors.textDim, fontSize: 12 },
  unitsRow: { flexDirection: 'row', gap: 8 },
  unitPill: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  unitPillActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  unitText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  unitTextActive: { color: colors.background },
});
