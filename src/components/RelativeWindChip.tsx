import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/constants/theme';
import { formatSignedSpeed, type Units } from '@/lib/format';
import type { Wind } from '@/lib/types';
import { relativeWind, type RelativeWindKind } from '@/lib/windMath';

const LABELS: Record<RelativeWindKind, string> = {
  tail: 'Tailwind',
  head: 'Headwind',
  'cross-left': 'Crosswind from left',
  'cross-right': 'Crosswind from right',
  calm: 'Calm',
};

const chipColor = (kind: RelativeWindKind) =>
  kind === 'tail' ? colors.green : kind === 'head' ? colors.red : colors.textDim;

interface Props {
  headingDeg: number | null;
  wind: Wind | null;
  units: Units;
}

/** Live interpretation of the wind relative to the direction the user faces. */
export function RelativeWindChip({ headingDeg, wind, units }: Props) {
  if (wind == null || headingDeg == null) return null;
  const rel = relativeWind(headingDeg, wind.toDeg, wind.speedKmh);
  const color = chipColor(rel.kind);
  return (
    <View style={[styles.chip, { borderColor: color }]}>
      <Text style={[styles.kind, { color }]}>{LABELS[rel.kind]}</Text>
      {rel.kind !== 'calm' && (
        <Text style={styles.effective}>
          {' · '}
          {formatSignedSpeed(rel.effectiveKmh, units)} effective
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 1.5,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  kind: {
    fontSize: 16,
    fontWeight: '700',
  },
  effective: {
    color: colors.text,
    fontSize: 15,
  },
});
