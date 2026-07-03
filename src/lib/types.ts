import type { BadgeKind, SegmentScore } from './windMath';

export interface Wind {
  speedKmh: number;
  gustKmh: number;
  /** Meteorological direction — where the wind comes FROM. */
  fromDeg: number;
  /** Where the wind blows TOWARD (fromDeg + 180). */
  toDeg: number;
  fetchedAt: number;
  lat: number;
  lon: number;
}

export interface Segment {
  id: number;
  name: string;
  distanceM: number;
  avgGrade: number;
  /** Encoded polyline; explore results include one, starred summaries may not. */
  polyline?: string;
  startLatlng?: [number, number];
  endLatlng?: [number, number];
  source: 'starred' | 'explore';
  prElapsedS?: number;
  effortCount?: number;
}

export interface ScoredSegment extends Segment {
  effectiveTailwindKmh: number;
  downwindShare: number;
  badge: BadgeKind;
  score: SegmentScore;
}

export interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix seconds. */
  expiresAt: number;
  athleteId: number;
}
