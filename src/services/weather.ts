import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Wind } from '@/lib/types';
import { meteoToDir } from '@/lib/windMath';

/** ~1 km grid so nearby fixes share a cache entry. */
export const windGridKey = (lat: number, lon: number) => `${lat.toFixed(2)},${lon.toFixed(2)}`;

export const windQueryKey = (lat: number, lon: number) => ['wind', windGridKey(lat, lon)] as const;

export const WIND_REFRESH_MS = 15 * 60 * 1000;

const CACHE_PREFIX = 'wind-cache:';

/**
 * Fetch current wind at 10 m from Open-Meteo. On network failure, falls back to
 * the last cached reading for this grid cell (any age — callers label staleness
 * via `fetchedAt`).
 */
export async function fetchWind(lat: number, lon: number): Promise<Wind> {
  const cacheKey = CACHE_PREFIX + windGridKey(lat, lon);
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
    const json = await res.json();
    const current = json?.current;
    if (
      typeof current?.wind_speed_10m !== 'number' ||
      typeof current?.wind_direction_10m !== 'number'
    ) {
      throw new Error('Open-Meteo response missing wind fields');
    }
    const wind: Wind = {
      speedKmh: current.wind_speed_10m,
      gustKmh: typeof current.wind_gusts_10m === 'number' ? current.wind_gusts_10m : current.wind_speed_10m,
      fromDeg: current.wind_direction_10m,
      toDeg: meteoToDir(current.wind_direction_10m),
      fetchedAt: Date.now(),
      lat,
      lon,
    };
    AsyncStorage.setItem(cacheKey, JSON.stringify(wind)).catch(() => {});
    return wind;
  } catch (err) {
    const cached = await AsyncStorage.getItem(cacheKey).catch(() => null);
    if (cached) return JSON.parse(cached) as Wind;
    throw err;
  }
}
