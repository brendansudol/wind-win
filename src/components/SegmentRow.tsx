import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Polygon } from 'react-native-svg';

import { badgeStyles, colors } from '@/constants/theme';
import { initialBearingDeg } from '@/lib/angles';
import { formatDistance, formatDuration, formatSignedSpeed, type Units } from '@/lib/format';
import { segmentPoints } from '@/lib/geometry';
import type { ScoredSegment } from '@/lib/types';

/** Tiny glyph: segment net direction (white) vs wind direction (blue). */
function BearingGlyph({ segment, windToDeg }: { segment: ScoredSegment; windToDeg: number }) {
  const points = segmentPoints(segment);
  if (points.length < 2) return null;
  const [aLat, aLon] = points[0];
  const [bLat, bLon] = points[points.length - 1];
  const segBearing = initialBearingDeg(aLat, aLon, bLat, bLon);
  const arrow = (deg: number, color: string, r: number) => (
    <G transform={`rotate(${deg} 20 20)`}>
      <Line x1={20} y1={20 + r} x2={20} y2={20 - r + 6} stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      <Polygon points={`${16},${20 - r + 8} 20,${20 - r} ${24},${20 - r + 8}`} fill={color} />
    </G>
  );
  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      {arrow(windToDeg, colors.accent, 16)}
      {arrow(segBearing, colors.text, 10)}
    </Svg>
  );
}

interface Props {
  segment: ScoredSegment;
  windToDeg: number;
  units: Units;
  calm: boolean;
  onPress: () => void;
}

export function SegmentRow({ segment, windToDeg, units, calm, onPress }: Props) {
  const badge = badgeStyles[segment.badge];
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {segment.name}
        </Text>
        <Text style={styles.meta}>
          {formatDistance(segment.distanceM, units)} · {segment.avgGrade.toFixed(1)}%
          {segment.source === 'starred' ? ' · ★' : ''}
        </Text>
        {!calm && (
          <View style={styles.badgeRow}>
            <Text style={[styles.badgeLabel, { color: badge.color }]}>
              {badge.emoji} {badge.label}
            </Text>
            <Text style={styles.effective}>
              {formatSignedSpeed(segment.effectiveTailwindKmh, units)} effective ·{' '}
              {Math.round(segment.downwindShare * 100)}% downwind
            </Text>
          </View>
        )}
        <View style={styles.badgeRow}>
          {segment.prElapsedS != null && (
            <Text style={styles.pr}>PR {formatDuration(segment.prElapsedS)}</Text>
          )}
          {!calm && segment.badge === 'strong' && (
            <Text style={styles.hint}>Good PR conditions</Text>
          )}
        </View>
      </View>
      {!calm && <BearingGlyph segment={segment} windToDeg={windToDeg} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 10,
  },
  main: { flex: 1, gap: 3 },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  meta: { color: colors.textDim, fontSize: 13 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  badgeLabel: { fontSize: 13, fontWeight: '700' },
  effective: { color: colors.text, fontSize: 13 },
  pr: { color: colors.yellow, fontSize: 13, fontWeight: '600' },
  hint: { color: colors.green, fontSize: 13, fontStyle: 'italic' },
});
