import * as Location from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';

export type LocationPermission = 'pending' | 'granted' | 'denied';

export interface Coords {
  lat: number;
  lon: number;
}

const SIGNIFICANT_MOVE_M = 5000;

/** Dev-only escape hatch: "lat,lon" used when real location is unavailable
 * (e.g. web preview with geolocation blocked). Set in .env. */
function devFakeCoords(): Coords | null {
  const raw = process.env.EXPO_PUBLIC_DEV_FAKE_LOCATION;
  if (!raw || !__DEV__) return null;
  const [lat, lon] = raw.split(',').map(Number);
  return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
}

/**
 * When-in-use location: one fix on mount, then updates on significant moves
 * (> 5 km), plus a coarse reverse-geocoded place name where supported.
 */
export function useLocation() {
  const [permission, setPermission] = useState<LocationPermission>('pending');
  const [coords, setCoords] = useState<Coords | null>(null);
  const [placeName, setPlaceName] = useState<string | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const applyPosition = useCallback((position: Location.LocationObject) => {
    const next = { lat: position.coords.latitude, lon: position.coords.longitude };
    setCoords(next);
    Location.reverseGeocodeAsync({ latitude: next.lat, longitude: next.lon })
      .then((results) => {
        const place = results[0];
        const name = place?.city ?? place?.subregion ?? place?.region ?? null;
        setPlaceName(name);
      })
      .catch(() => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      applyPosition(position);
    } catch {
      // keep last coords
    }
  }, [applyPosition]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== 'granted') {
        const fake = devFakeCoords();
        if (fake) {
          setPermission('granted');
          setCoords(fake);
          return;
        }
        setPermission('denied');
        return;
      }
      setPermission('granted');
      await refresh();
      try {
        watchRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, distanceInterval: SIGNIFICANT_MOVE_M },
          applyPosition,
        );
      } catch {
        // one-shot fix is enough
      }
    })();
    return () => {
      cancelled = true;
      watchRef.current?.remove();
    };
  }, [applyPosition, refresh]);

  return { permission, coords, placeName, refresh };
}
