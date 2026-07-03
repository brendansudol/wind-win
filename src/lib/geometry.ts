import polyline from '@mapbox/polyline';

import type { Segment } from './types';

/**
 * Best available geometry for a segment: the decoded polyline when we have one,
 * otherwise a single start→end leg (good enough to rank a starred summary).
 */
export function segmentPoints(segment: Segment): Array<[number, number]> {
  if (segment.polyline) {
    try {
      return polyline.decode(segment.polyline) as Array<[number, number]>;
    } catch {
      // fall through to start/end
    }
  }
  if (segment.startLatlng && segment.endLatlng) {
    return [segment.startLatlng, segment.endLatlng];
  }
  return [];
}

/** A lat/lon bounding box of roughly `radiusM` around a point. */
export function boundsAround(lat: number, lon: number, radiusM: number) {
  const dLat = radiusM / 111320;
  const dLon = radiusM / (111320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return {
    swLat: lat - dLat,
    swLon: lon - dLon,
    neLat: lat + dLat,
    neLon: lon + dLon,
  };
}
