export const toRad = (deg: number) => (deg * Math.PI) / 180;
export const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Normalize any angle to [0, 360). */
export const normalizeDeg = (deg: number) => ((deg % 360) + 360) % 360;

/**
 * Signed smallest rotation from `from` to `to`, in (-180, 180].
 * signedDelta(10, 350) === 20; signedDelta(350, 10) === -20.
 */
export const signedDelta = (to: number, from: number) => {
  const d = normalizeDeg(to - from);
  return d > 180 ? d - 360 : d;
};

const CARDINALS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW',
] as const;

export const cardinalFromDeg = (deg: number) =>
  CARDINALS[Math.round(normalizeDeg(deg) / 22.5) % 16];

const EARTH_RADIUS_M = 6371000;

/** Great-circle distance in meters. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

/** Great-circle initial bearing from point 1 to point 2, in [0, 360). */
export function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number) {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dLon);
  return normalizeDeg(toDeg(Math.atan2(y, x)));
}
