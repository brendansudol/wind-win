import { haversineM, initialBearingDeg, normalizeDeg, signedDelta, toRad } from './angles';

/**
 * Open-Meteo (and meteorology generally) reports the direction wind comes FROM.
 * All internal math uses the direction wind blows TOWARD.
 */
export const meteoToDir = (fromDeg: number) => normalizeDeg(fromDeg + 180);

/** Below this speed the wind is treated as calm and scoring is meaningless. */
export const CALM_THRESHOLD_KMH = 5;

export type RelativeWindKind = 'tail' | 'head' | 'cross-left' | 'cross-right' | 'calm';

export interface RelativeWind {
  kind: RelativeWindKind;
  /** Head/tail component along the rider's heading; positive is a tailwind. */
  effectiveKmh: number;
  /** Signed angle from heading to the wind's TOWARD direction, in (-180, 180]. */
  deltaDeg: number;
}

/** Interpret the wind relative to the direction the rider is facing. */
export function relativeWind(
  headingDeg: number,
  windToDeg: number,
  windSpeedKmh: number,
): RelativeWind {
  const deltaDeg = signedDelta(windToDeg, headingDeg);
  if (windSpeedKmh < CALM_THRESHOLD_KMH) {
    return { kind: 'calm', effectiveKmh: 0, deltaDeg };
  }
  const effectiveKmh = windSpeedKmh * Math.cos(toRad(deltaDeg));
  const abs = Math.abs(deltaDeg);
  // Wind blowing toward the rider's right (positive delta) comes FROM the left.
  const kind: RelativeWindKind =
    abs <= 45 ? 'tail' : abs >= 135 ? 'head' : deltaDeg > 0 ? 'cross-left' : 'cross-right';
  return { kind, effectiveKmh, deltaDeg };
}

export type BadgeKind = 'strong' | 'tail' | 'neutral' | 'head';

export const badgeForScore = (scoreKmh: number): BadgeKind =>
  scoreKmh >= 10 ? 'strong' : scoreKmh >= 4 ? 'tail' : scoreKmh > -4 ? 'neutral' : 'head';

export type LegKind = 'tail' | 'cross' | 'head';

/** Classify one leg of a segment by its angle to the wind's TOWARD direction. */
export const classifyLeg = (bearingDeg: number, windToDeg: number): LegKind => {
  const abs = Math.abs(signedDelta(bearingDeg, windToDeg));
  return abs <= 60 ? 'tail' : abs >= 120 ? 'head' : 'cross';
};

export interface ScoredLeg {
  bearingDeg: number;
  lengthM: number;
  tailwindKmh: number;
  kind: LegKind;
}

export interface SegmentScore {
  /** Grade-damped effective tailwind — the ranking score, in km/h. */
  effectiveTailwindKmh: number;
  /** Distance-weighted mean tailwind component before grade damping, in km/h. */
  rawTailwindKmh: number;
  /** Share of segment distance whose bearing is within 60° of downwind, 0..1. */
  downwindShare: number;
  badge: BadgeKind;
  legs: ScoredLeg[];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Aero drag dominates on the flat; on steep climbs wind barely matters. */
export const gradeDamping = (avgGradePct: number) => clamp(1 - avgGradePct / 8, 0.2, 1);

/**
 * Score a segment's wind advantage from its full geometry.
 * `points` are [lat, lon] pairs; `windToDeg` is the direction wind blows toward.
 */
export function scoreSegment(
  points: Array<[number, number]>,
  windSpeedKmh: number,
  windToDeg: number,
  avgGradePct: number,
): SegmentScore {
  const legs: ScoredLeg[] = [];
  let totalM = 0;
  let weightedTail = 0;
  let downwindM = 0;

  for (let i = 1; i < points.length; i++) {
    const [lat1, lon1] = points[i - 1];
    const [lat2, lon2] = points[i];
    const lengthM = haversineM(lat1, lon1, lat2, lon2);
    if (lengthM <= 0) continue;
    const bearingDeg = initialBearingDeg(lat1, lon1, lat2, lon2);
    const delta = signedDelta(bearingDeg, windToDeg);
    const tailwindKmh = windSpeedKmh * Math.cos(toRad(delta));
    if (Math.abs(delta) <= 60) downwindM += lengthM;
    totalM += lengthM;
    weightedTail += tailwindKmh * lengthM;
    legs.push({ bearingDeg, lengthM, tailwindKmh, kind: classifyLeg(bearingDeg, windToDeg) });
  }

  if (totalM === 0) {
    return { effectiveTailwindKmh: 0, rawTailwindKmh: 0, downwindShare: 0, badge: 'neutral', legs };
  }

  const rawTailwindKmh = weightedTail / totalM;
  const effectiveTailwindKmh = rawTailwindKmh * gradeDamping(avgGradePct);
  return {
    effectiveTailwindKmh,
    rawTailwindKmh,
    downwindShare: downwindM / totalM,
    badge: badgeForScore(effectiveTailwindKmh),
    legs,
  };
}

/** Distance shares of tail / cross / head legs, for the detail breakdown. */
export function legShares(legs: ScoredLeg[]) {
  const total = legs.reduce((s, l) => s + l.lengthM, 0);
  const share = (kind: LegKind) =>
    total === 0 ? 0 : legs.filter((l) => l.kind === kind).reduce((s, l) => s + l.lengthM, 0) / total;
  return { tail: share('tail'), cross: share('cross'), head: share('head') };
}
