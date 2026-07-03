import {
  cardinalFromDeg,
  haversineM,
  initialBearingDeg,
  normalizeDeg,
  signedDelta,
} from '../angles';

describe('normalizeDeg', () => {
  it('wraps into [0, 360)', () => {
    expect(normalizeDeg(0)).toBe(0);
    expect(normalizeDeg(360)).toBe(0);
    expect(normalizeDeg(-90)).toBe(270);
    expect(normalizeDeg(725)).toBe(5);
  });
});

describe('signedDelta', () => {
  it('returns the smallest signed rotation', () => {
    expect(signedDelta(10, 350)).toBe(20);
    expect(signedDelta(350, 10)).toBe(-20);
    expect(signedDelta(90, 90)).toBe(0);
    expect(signedDelta(270, 90)).toBe(180);
  });

  it('handles wraparound near 0/360', () => {
    expect(signedDelta(1, 359)).toBe(2);
    expect(signedDelta(359, 1)).toBe(-2);
  });
});

describe('cardinalFromDeg', () => {
  it('maps degrees to 16-wind cardinals', () => {
    expect(cardinalFromDeg(0)).toBe('N');
    expect(cardinalFromDeg(225)).toBe('SW');
    expect(cardinalFromDeg(359)).toBe('N');
    expect(cardinalFromDeg(292.5)).toBe('WNW');
  });
});

describe('initialBearingDeg', () => {
  it('points north between stacked points', () => {
    expect(initialBearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 5);
  });

  it('points east along the equator', () => {
    expect(initialBearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 5);
  });

  it('points south and west for reversed points', () => {
    expect(initialBearingDeg(1, 0, 0, 0)).toBeCloseTo(180, 5);
    expect(initialBearingDeg(0, 1, 0, 0)).toBeCloseTo(270, 5);
  });
});

describe('haversineM', () => {
  it('one degree of latitude is ~111 km', () => {
    const d = haversineM(0, 0, 1, 0);
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_500);
  });

  it('zero for identical points', () => {
    expect(haversineM(45, -122, 45, -122)).toBe(0);
  });
});
