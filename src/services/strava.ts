import type { Segment } from '@/lib/types';
import { clearTokens, getValidAccessToken } from './stravaAuth';

const BASE_URL = 'https://www.strava.com/api/v3';

export class StravaError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StravaError';
  }
}

export const isStravaAuthError = (err: unknown) =>
  err instanceof StravaError && err.status === 401;

export const isStravaRateLimited = (err: unknown) =>
  err instanceof StravaError && err.status === 429;

async function stravaFetch<T>(path: string): Promise<T> {
  const token = await getValidAccessToken();
  if (!token) throw new StravaError(401, 'Not connected to Strava');
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    // Token revoked or scope withdrawn — forget it so the UI returns to connect.
    await clearTokens();
    throw new StravaError(401, 'Strava access revoked');
  }
  if (res.status === 429) throw new StravaError(429, 'Strava rate limit reached');
  if (!res.ok) throw new StravaError(res.status, `Strava responded ${res.status}`);
  return (await res.json()) as T;
}

interface SummarySegment {
  id: number;
  name: string;
  distance: number;
  average_grade: number;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
  map?: { polyline?: string };
  athlete_segment_stats?: { pr_elapsed_time?: number | null };
  effort_count?: number;
  athlete_count?: number;
}

const latlng = (v: unknown): [number, number] | undefined =>
  Array.isArray(v) && v.length === 2 ? [v[0], v[1]] : undefined;

export async function getStarredSegments(): Promise<Segment[]> {
  const all: Segment[] = [];
  for (let page = 1; page <= 3; page++) {
    const batch = await stravaFetch<SummarySegment[]>(
      `/segments/starred?page=${page}&per_page=50`,
    );
    all.push(
      ...batch.map(
        (s): Segment => ({
          id: s.id,
          name: s.name,
          distanceM: s.distance,
          avgGrade: s.average_grade,
          polyline: s.map?.polyline,
          startLatlng: latlng(s.start_latlng),
          endLatlng: latlng(s.end_latlng),
          source: 'starred',
          prElapsedS: s.athlete_segment_stats?.pr_elapsed_time ?? undefined,
        }),
      ),
    );
    if (batch.length < 50) break;
  }
  return all;
}

interface ExploreSegment {
  id: number;
  name: string;
  distance: number;
  avg_grade: number;
  points: string;
  start_latlng?: [number, number];
  end_latlng?: [number, number];
}

export async function exploreSegments(bounds: {
  swLat: number;
  swLon: number;
  neLat: number;
  neLon: number;
}): Promise<Segment[]> {
  const boundsParam = [bounds.swLat, bounds.swLon, bounds.neLat, bounds.neLon]
    .map((n) => n.toFixed(5))
    .join(',');
  const json = await stravaFetch<{ segments: ExploreSegment[] }>(
    `/segments/explore?bounds=${boundsParam}&activity_type=riding`,
  );
  return (json.segments ?? []).map(
    (s): Segment => ({
      id: s.id,
      name: s.name,
      distanceM: s.distance,
      avgGrade: s.avg_grade,
      polyline: s.points,
      startLatlng: latlng(s.start_latlng),
      endLatlng: latlng(s.end_latlng),
      source: 'explore',
    }),
  );
}

export interface SegmentDetail extends Segment {
  athleteCount?: number;
  city?: string;
}

export async function getSegmentDetail(id: number): Promise<SegmentDetail> {
  const s = await stravaFetch<SummarySegment & { city?: string }>(`/segments/${id}`);
  return {
    id: s.id,
    name: s.name,
    distanceM: s.distance,
    avgGrade: s.average_grade,
    polyline: s.map?.polyline,
    startLatlng: latlng(s.start_latlng),
    endLatlng: latlng(s.end_latlng),
    source: 'starred',
    prElapsedS: s.athlete_segment_stats?.pr_elapsed_time ?? undefined,
    effortCount: s.effort_count,
    athleteCount: s.athlete_count,
    city: s.city,
  };
}
