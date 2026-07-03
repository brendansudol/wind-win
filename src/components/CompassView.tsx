import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, G, Line, Polygon, Text as SvgText } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { cardinalFromDeg } from '@/lib/angles';

interface Props {
  /** Continuous device heading in degrees (unwrapped); the rose rotates by its negation. */
  rotation: SharedValue<number>;
  headingDeg: number | null;
  /** Direction the wind blows TOWARD, or null while loading. */
  windToDeg: number | null;
  windSpeedKmh: number;
  calm: boolean;
  size?: number;
}

const CARDINAL_POINTS = [
  { deg: 0, label: 'N' },
  { deg: 90, label: 'E' },
  { deg: 180, label: 'S' },
  { deg: 270, label: 'W' },
];

function RoseTicks() {
  const ticks = [];
  for (let deg = 0; deg < 360; deg += 5) {
    const major = deg % 30 === 0;
    const rad = (deg * Math.PI) / 180;
    const r1 = major ? 84 : 88;
    const r2 = 93;
    ticks.push(
      <Line
        key={deg}
        x1={100 + r1 * Math.sin(rad)}
        y1={100 - r1 * Math.cos(rad)}
        x2={100 + r2 * Math.sin(rad)}
        y2={100 - r2 * Math.cos(rad)}
        stroke={major ? colors.textDim : colors.cardBorder}
        strokeWidth={major ? 1.6 : 0.8}
      />,
    );
  }
  return <>{ticks}</>;
}

function WindArrow({ windToDeg, windSpeedKmh, calm }: Pick<Props, 'windToDeg' | 'windSpeedKmh' | 'calm'>) {
  if (calm) return null;
  const loading = windToDeg == null;
  // Subtle size scaling: 10 km/h → thin arrow, 40+ km/h → beefy one.
  const speedNorm = Math.min(Math.max(windSpeedKmh, 0), 40) / 40;
  const strokeWidth = 3 + speedNorm * 4;
  const headHalf = 6 + speedNorm * 4;
  const color = loading ? colors.cardBorder : colors.accent;
  return (
    <G transform={`rotate(${loading ? 45 : windToDeg!} 100 100)`} opacity={loading ? 0.6 : 0.95}>
      <Line
        x1={100}
        y1={142}
        x2={100}
        y2={52}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={loading ? '6 6' : undefined}
      />
      <Polygon
        points={`${100 - headHalf},${56} 100,${34} ${100 + headHalf},${56}`}
        fill={color}
      />
      {/* tail feathers */}
      <Line x1={92} y1={142} x2={108} y2={142} stroke={color} strokeWidth={strokeWidth * 0.7} strokeLinecap="round" />
    </G>
  );
}

export function CompassView({ rotation, headingDeg, windToDeg, windSpeedKmh, calm, size = 320 }: Props) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${-rotation.value}deg` }],
  }));

  const rose = useMemo(
    () => (
      <Svg width={size} height={size} viewBox="0 0 200 200">
        <Circle cx={100} cy={100} r={96} stroke={colors.cardBorder} strokeWidth={1.5} fill={colors.card} />
        <RoseTicks />
        {CARDINAL_POINTS.map(({ deg, label }) => {
          const rad = (deg * Math.PI) / 180;
          return (
            <SvgText
              key={label}
              x={100 + 72 * Math.sin(rad)}
              y={100 - 72 * Math.cos(rad) + 7}
              fontSize={20}
              fontWeight="700"
              textAnchor="middle"
              fill={label === 'N' ? colors.north : colors.text}
            >
              {label}
            </SvgText>
          );
        })}
        <WindArrow windToDeg={windToDeg} windSpeedKmh={windSpeedKmh} calm={calm} />
        <Circle cx={100} cy={100} r={5} fill={colors.background} stroke={colors.textDim} strokeWidth={1} />
      </Svg>
    ),
    [size, windToDeg, windSpeedKmh, calm],
  );

  return (
    <View style={{ width: size, alignItems: 'center' }}>
      {/* Lubber line: fixed marker for the direction the phone is facing */}
      <View style={styles.lubber}>
        <View style={styles.lubberTriangle} />
      </View>
      <Animated.View style={animatedStyle}>{rose}</Animated.View>
      <View style={[StyleSheet.absoluteFill, styles.centerOverlay, { pointerEvents: 'none' }]}>
        {calm ? (
          <View style={styles.calmChip}>
            <Text style={styles.calmText}>Calm</Text>
          </View>
        ) : (
          <Text style={styles.headingText}>
            {headingDeg != null ? `${headingDeg}° ${cardinalFromDeg(headingDeg)}` : '—'}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lubber: {
    alignItems: 'center',
    marginBottom: -6,
    zIndex: 2,
  },
  lubberTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.yellow,
  },
  centerOverlay: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headingText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '700',
    backgroundColor: `${colors.background}CC`,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    overflow: 'hidden',
  },
  calmChip: {
    backgroundColor: `${colors.background}E0`,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  calmText: {
    color: colors.textDim,
    fontSize: 18,
    fontWeight: '600',
  },
});
