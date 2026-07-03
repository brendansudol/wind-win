import { useQuery } from '@tanstack/react-query';

import type { Coords } from '@/hooks/useLocation';
import { fetchWind, WIND_REFRESH_MS, windQueryKey } from '@/services/weather';

/**
 * Current wind for the user's location. Auto-refreshes every 15 min while
 * mounted; a > 5 km move changes the query key (via the location watcher)
 * which refetches immediately.
 */
export function useWind(coords: Coords | null) {
  return useQuery({
    queryKey: coords ? windQueryKey(coords.lat, coords.lon) : ['wind', 'none'],
    queryFn: () => fetchWind(coords!.lat, coords!.lon),
    enabled: coords != null,
    staleTime: WIND_REFRESH_MS,
    refetchInterval: WIND_REFRESH_MS,
  });
}
