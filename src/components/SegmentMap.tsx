import React, { useMemo } from 'react';
import Svg, { Circle, G, Line, Polygon, Polyline as SvgPolyline, Text as SvgText } from 'react-native-svg';

import { colors } from '@/constants/theme';
import { initialBearingDeg, toRad } from '@/lib/angles';
import { classifyLeg, type LegKind } from '@/lib/windMath';

const LEG_COLORS: Record<LegKind, string> = {
  tail: colors.green,
  cross: colors.textDim,
  head: colors.red,
};

interface Props {
  /** Decoded [lat, lon] points. */
  points: Array<[number, number]>;
  /** Direction wind blows toward; null hides the wind overlay. */
  windToDeg: number | null;
  width?: number;
  height?: number;
}

/**
 * Mini-map of a segment polyline, each leg colored by tail/cross/head wind,
 * with a wind vector and north indicator overlaid.
 */
export function SegmentMap({ points, windToDeg, width = 340, height = 220 }: Props) {
  const projected = useMemo(() => {
    if (points.length < 2) return null;
    const midLat = points.reduce((s, p) => s + p[0], 0) / points.length;
    const cosLat = Math.cos(toRad(midLat));
    // Equirectangular projection: x east, y north (flipped for screen space).
    const xy = points.map(([lat, lon]) => [lon * cosLat, -lat] as const);
    const xs = xy.map((p) => p[0]);
    const ys = xy.map((p) => p[1]);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const spanX = Math.max(...xs) - minX || 1e-9;
    const spanY = Math.max(...ys) - minY || 1e-9;
    const pad = 24;
    const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
    const offsetX = (width - spanX * scale) / 2;
    const offsetY = (height - spanY * scale) / 2;
    return xy.map(
      ([x, y]) => [(x - minX) * scale + offsetX, (y - minY) * scale + offsetY] as const,
    );
  }, [points, width, height]);

  if (!projected) return null;

  return (
    <Svg width={width} height={height}>
      {projected.slice(1).map((point, i) => {
        const prev = projected[i];
        const kind =
          windToDeg == null
            ? 'cross'
            : classifyLeg(
                initialBearingDeg(points[i][0], points[i][1], points[i + 1][0], points[i + 1][1]),
                windToDeg,
              );
        return (
          <Line
            key={i}
            x1={prev[0]}
            y1={prev[1]}
            x2={point[0]}
            y2={point[1]}
            stroke={LEG_COLORS[kind]}
            strokeWidth={4}
            strokeLinecap="round"
          />
        );
      })}
      {/* start and finish markers */}
      <Circle cx={projected[0][0]} cy={projected[0][1]} r={6} fill={colors.text} />
      <Circle
        cx={projected[projected.length - 1][0]}
        cy={projected[projected.length - 1][1]}
        r={6}
        fill={colors.background}
        stroke={colors.text}
        strokeWidth={2}
      />
      {/* north indicator, top-left */}
      <SvgText x={16} y={22} fontSize={13} fontWeight="700" fill={colors.north} textAnchor="middle">
        N
      </SvgText>
      <Line x1={16} y1={40} x2={16} y2={27} stroke={colors.north} strokeWidth={2} />
      {/* wind vector, top-right */}
      {windToDeg != null && (
        <G transform={`rotate(${windToDeg} ${width - 28} 30)`}>
          <Line x1={width - 28} y1={46} x2={width - 28} y2={20} stroke={colors.accent} strokeWidth={3} strokeLinecap="round" />
          <Polygon
            points={`${width - 34},24 ${width - 28},12 ${width - 22},24`}
            fill={colors.accent}
          />
        </G>
      )}
    </Svg>
  );
}
