import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { normalizeDeg, signedDelta, toDeg, toRad } from '@/lib/angles';

const ALPHA = 0.2;

/**
 * Device compass heading. `rotation` is a continuous (unwrapped) angle in
 * degrees for the Reanimated rose transform — it never snaps at 0°/360°
 * because each update accumulates the signed delta rather than the raw value.
 * `headingDeg` is the integer heading for text readouts (re-renders only when
 * the displayed degree changes).
 */
export function useHeading() {
  const rotation = useSharedValue(0);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [isTrueNorth, setIsTrueNorth] = useState(true);
  const [available, setAvailable] = useState(true);
  const filter = useRef({ sx: 0, cy: 0, continuous: 0, initialized: false });

  useEffect(() => {
    let subscription: Location.LocationSubscription | null = null;
    let cancelled = false;

    if (Platform.OS === 'web') {
      setAvailable(false);
      return;
    }

    (async () => {
      try {
        subscription = await Location.watchHeadingAsync((sample) => {
          const hasTrue = sample.trueHeading >= 0;
          const raw = hasTrue ? sample.trueHeading : sample.magHeading;
          if (typeof raw !== 'number' || raw < 0 || Number.isNaN(raw)) return;
          setIsTrueNorth(hasTrue);
          setAccuracy(sample.accuracy);

          // Low-pass filter in unit-vector space so 359°→0° wraps cleanly.
          const f = filter.current;
          const rad = toRad(raw);
          if (!f.initialized) {
            f.sx = Math.sin(rad);
            f.cy = Math.cos(rad);
            f.initialized = true;
            f.continuous = normalizeDeg(toDeg(Math.atan2(f.sx, f.cy)));
          } else {
            f.sx = ALPHA * Math.sin(rad) + (1 - ALPHA) * f.sx;
            f.cy = ALPHA * Math.cos(rad) + (1 - ALPHA) * f.cy;
          }
          const smoothed = normalizeDeg(toDeg(Math.atan2(f.sx, f.cy)));
          f.continuous += signedDelta(smoothed, normalizeDeg(f.continuous));
          rotation.value = withTiming(f.continuous, {
            duration: 120,
            easing: Easing.linear,
          });

          const deg = Math.round(smoothed) % 360;
          setHeadingDeg((prev) => (prev === deg ? prev : deg));
        });
        // Web resolves without a real subscription instead of throwing.
        if (!subscription && !cancelled) setAvailable(false);
      } catch {
        // No magnetometer (some tablets) or unsupported platform (web).
        if (!cancelled) setAvailable(false);
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [rotation]);

  return { rotation, headingDeg, accuracy, isTrueNorth, available };
}
