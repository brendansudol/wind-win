import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';

import { haversineM } from '@/lib/angles';
import { boundsAround, segmentPoints } from '@/lib/geometry';
import type { Coords } from '@/hooks/useLocation';
import type { ScoredSegment, Segment, Wind } from '@/lib/types';
import { CALM_THRESHOLD_KMH, scoreSegment } from '@/lib/windMath';
import { exploreSegments, getStarredSegments } from '@/services/strava';
import { fetchWind, WIND_REFRESH_MS, windGridKey, windQueryKey } from '@/services/weather';

export type SegmentFilter = 'all' | 'starred' | 'nearby';

const EXPLORE_RADIUS_M = 5000; // ~10 km box
const REMOTE_WIND_THRESHOLD_M = 30_000;

const DAY_MS = 24 * 60 * 60 * 1000;

export function useStarredSegments(enabled: boolean) {
  return useQuery({
    queryKey: ['strava', 'starred'],
    queryFn: getStarredSegments,
    enabled,
    staleTime: 6 * 60 * 60 * 1000,
    gcTime: 7 * DAY_MS,
    retry: false,
  });
}

export function useNearbySegments(enabled: boolean, coords: Coords | null) {
  return useQuery({
    queryKey: ['strava', 'explore', coords ? windGridKey(coords.lat, coords.lon) : 'none'],
    queryFn: async () => {
      const found = await exploreSegments(boundsAround(coords!.lat, coords!.lon, EXPLORE_RADIUS_M));
      if (found.length > 0) return found;
      // Rural area: widen the box once before giving up.
      return exploreSegments(boundsAround(coords!.lat, coords!.lon, EXPLORE_RADIUS_M * 2));
    },
    enabled: enabled && coords != null,
    staleTime: 60 * 60 * 1000,
    gcTime: DAY_MS,
    retry: false,
  });
}

/** Starred ∪ Nearby, deduped by id (starred wins, but keeps explore geometry). */
export function mergeSegments(starred: Segment[], nearby: Segment[]): Segment[] {
  const byId = new Map<number, Segment>();
  for (const s of nearby) byId.set(s.id, s);
  for (const s of starred) {
    const existing = byId.get(s.id);
    byId.set(s.id, existing ? { ...existing, ...s, polyline: s.polyline ?? existing.polyline } : s);
  }
  return [...byId.values()];
}

/**
 * Wind used to score one segment: local wind normally, but wind fetched at the
 * segment's start when it is > 30 km from the user (a starred segment across
 * the country should be scored with its own weather).
 */
async function windForSegment(
  segment: Segment,
  localWind: Wind,
  coords: Coords | null,
  queryClient: QueryClient,
): Promise<Wind> {
  const start = segment.startLatlng ?? segmentPoints(segment)[0];
  if (!start || !coords) return localWind;
  if (haversineM(coords.lat, coords.lon, start[0], start[1]) <= REMOTE_WIND_THRESHOLD_M) {
    return localWind;
  }
  try {
    return await queryClient.fetchQuery({
      queryKey: windQueryKey(start[0], start[1]),
      queryFn: () => fetchWind(start[0], start[1]),
      staleTime: WIND_REFRESH_MS,
    });
  } catch {
    return localWind;
  }
}

export function scoreOne(segment: Segment, wind: Wind): ScoredSegment {
  const score = scoreSegment(segmentPoints(segment), wind.speedKmh, wind.toDeg, segment.avgGrade);
  return {
    ...segment,
    effectiveTailwindKmh: score.effectiveTailwindKmh,
    downwindShare: score.downwindShare,
    badge: score.badge,
    score,
  };
}

/**
 * Score and rank segments under current conditions. Scoring is local math —
 * it recomputes when wind refreshes with no extra Strava calls. In calm
 * conditions the incoming (neutral) order is preserved.
 */
export function useScoredSegments(segments: Segment[], wind: Wind | undefined, coords: Coords | null) {
  const queryClient = useQueryClient();
  const ids = segments.map((s) => s.id).join(',');
  return useQuery({
    queryKey: ['scored', wind ? `${windGridKey(wind.lat, wind.lon)}:${wind.fetchedAt}` : 'none', ids],
    enabled: wind != null && segments.length > 0,
    queryFn: async (): Promise<ScoredSegment[]> => {
      const scored = await Promise.all(
        segments.map(async (segment) => {
          const w = await windForSegment(segment, wind!, coords, queryClient);
          return scoreOne(segment, w);
        }),
      );
      if (wind!.speedKmh < CALM_THRESHOLD_KMH) return scored;
      return scored.sort(
        (a, b) =>
          b.effectiveTailwindKmh - a.effectiveTailwindKmh || b.downwindShare - a.downwindShare,
      );
    },
  });
}
