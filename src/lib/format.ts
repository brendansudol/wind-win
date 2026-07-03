export type Units = 'kmh' | 'mph';

const KMH_PER_MPH = 1.609344;

export const kmhToDisplay = (kmh: number, units: Units) =>
  units === 'mph' ? kmh / KMH_PER_MPH : kmh;

export const speedUnitLabel = (units: Units) => (units === 'mph' ? 'mph' : 'km/h');

export const formatSpeed = (kmh: number, units: Units) =>
  `${Math.round(kmhToDisplay(kmh, units))} ${speedUnitLabel(units)}`;

/** Like formatSpeed but with an explicit +/− sign, for effective wind components. */
export const formatSignedSpeed = (kmh: number, units: Units) => {
  const v = Math.round(kmhToDisplay(kmh, units));
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} ${speedUnitLabel(units)}`;
};

export const formatDistance = (meters: number, units: Units) =>
  units === 'mph' ? `${(meters / 1609.344).toFixed(1)} mi` : `${(meters / 1000).toFixed(1)} km`;

export const formatDuration = (totalSeconds: number) => {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${m}:${String(sec).padStart(2, '0')}`;
};

export const formatTimeAgo = (timestampMs: number, nowMs = Date.now()) => {
  const mins = Math.max(0, Math.round((nowMs - timestampMs) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} d ago`;
};

/** Default units from the device locale: US, UK, Myanmar, Liberia use mph. */
export function defaultUnitsForLocale(locale?: string): Units {
  const l = locale ?? (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().locale : '');
  const region = /[-_]([A-Za-z]{2})\b/.exec(l ?? '')?.[1]?.toUpperCase();
  return region && ['US', 'GB', 'MM', 'LR'].includes(region) ? 'mph' : 'kmh';
}
