import {
  badgeForScore,
  classifyLeg,
  gradeDamping,
  legShares,
  meteoToDir,
  relativeWind,
  scoreSegment,
} from '../windMath';

describe('meteoToDir', () => {
  it('converts meteorological FROM direction to blowing-toward direction', () => {
    expect(meteoToDir(270)).toBe(90); // west wind blows east
    expect(meteoToDir(0)).toBe(180);
    expect(meteoToDir(180)).toBe(0);
    expect(meteoToDir(315)).toBe(135);
  });
});

describe('relativeWind', () => {
  it('facing 90°, wind from 270° is a full tailwind (spec acceptance case)', () => {
    const rel = relativeWind(90, meteoToDir(270), 20);
    expect(rel.kind).toBe('tail');
    expect(rel.effectiveKmh).toBeCloseTo(20, 5);
  });

  it('facing into the wind is a headwind with negative effective speed', () => {
    const rel = relativeWind(270, meteoToDir(270), 20);
    expect(rel.kind).toBe('head');
    expect(rel.effectiveKmh).toBeCloseTo(-20, 5);
  });

  it('distinguishes crosswind sides', () => {
    // Facing north, wind from the west blows toward 90° (rider's right) → from left.
    expect(relativeWind(0, 90, 20).kind).toBe('cross-left');
    expect(relativeWind(0, 270, 20).kind).toBe('cross-right');
  });

  it('uses 45°/135° boundaries', () => {
    expect(relativeWind(0, 45, 20).kind).toBe('tail');
    expect(relativeWind(0, 46, 20).kind).toBe('cross-left');
    expect(relativeWind(0, 135, 20).kind).toBe('head');
    expect(relativeWind(0, 134, 20).kind).toBe('cross-left');
  });

  it('treats < 5 km/h as calm', () => {
    expect(relativeWind(0, 0, 4.9).kind).toBe('calm');
    expect(relativeWind(0, 0, 5).kind).toBe('tail');
  });

  it('handles wraparound headings', () => {
    const rel = relativeWind(350, 10, 20);
    expect(rel.kind).toBe('tail');
    expect(rel.deltaDeg).toBe(20);
  });
});

describe('gradeDamping', () => {
  it('keeps full score on the flat and clamps on steep climbs', () => {
    expect(gradeDamping(0)).toBe(1);
    expect(gradeDamping(4)).toBeCloseTo(0.5);
    expect(gradeDamping(8)).toBeCloseTo(0.2); // spec: 8% keeps only ~20%
    expect(gradeDamping(15)).toBe(0.2);
  });

  it('never exceeds 1 on descents', () => {
    expect(gradeDamping(-5)).toBe(1);
  });
});

describe('badgeForScore', () => {
  it('applies spec thresholds', () => {
    expect(badgeForScore(12)).toBe('strong');
    expect(badgeForScore(10)).toBe('strong');
    expect(badgeForScore(6)).toBe('tail');
    expect(badgeForScore(0)).toBe('neutral');
    expect(badgeForScore(-3.9)).toBe('neutral');
    expect(badgeForScore(-4)).toBe('head');
  });
});

// A straight due-north segment: three points stacked on a meridian.
const NORTH_SEGMENT: Array<[number, number]> = [
  [45.0, -122.0],
  [45.01, -122.0],
  [45.02, -122.0],
];

// A rectangle back to the start — a loop.
const LOOP_SEGMENT: Array<[number, number]> = [
  [45.0, -122.0],
  [45.01, -122.0],
  [45.01, -121.99],
  [45.0, -121.99],
  [45.0, -122.0],
];

describe('scoreSegment', () => {
  it('due-north segment with 20 km/h wind from 180° scores +20 (spec fixture)', () => {
    const score = scoreSegment(NORTH_SEGMENT, 20, meteoToDir(180), 0);
    expect(score.rawTailwindKmh).toBeCloseTo(20, 1);
    expect(score.effectiveTailwindKmh).toBeCloseTo(20, 1);
    expect(score.downwindShare).toBeCloseTo(1, 5);
    expect(score.badge).toBe('strong');
  });

  it('same segment into a north wind scores −20 and headwind badge', () => {
    const score = scoreSegment(NORTH_SEGMENT, 20, meteoToDir(0), 0);
    expect(score.effectiveTailwindKmh).toBeCloseTo(-20, 1);
    expect(score.downwindShare).toBe(0);
    expect(score.badge).toBe('head');
  });

  it('dead-downwind ranks above an equal crosswind segment (spec acceptance case)', () => {
    const downwind = scoreSegment(NORTH_SEGMENT, 20, meteoToDir(180), 0);
    const eastSegment: Array<[number, number]> = [
      [45.0, -122.0],
      [45.0, -121.99],
      [45.0, -121.98],
    ];
    const crosswind = scoreSegment(eastSegment, 20, meteoToDir(180), 0);
    expect(downwind.effectiveTailwindKmh).toBeGreaterThan(crosswind.effectiveTailwindKmh);
    expect(Math.abs(crosswind.effectiveTailwindKmh)).toBeLessThan(1);
  });

  it('a loop scores near zero via leg-weighted math', () => {
    const score = scoreSegment(LOOP_SEGMENT, 20, meteoToDir(180), 0);
    expect(Math.abs(score.effectiveTailwindKmh)).toBeLessThan(2);
    expect(score.badge).toBe('neutral');
  });

  it('grade damping keeps a windy climb off the podium', () => {
    const flat = scoreSegment(NORTH_SEGMENT, 20, meteoToDir(180), 0);
    const climb = scoreSegment(NORTH_SEGMENT, 20, meteoToDir(180), 8);
    expect(climb.effectiveTailwindKmh).toBeCloseTo(flat.effectiveTailwindKmh * 0.2, 1);
    // 20 × 0.2 = 4.0 lands exactly on the ≥4 tailwind threshold — demoted from 'strong'.
    expect(flat.badge).toBe('strong');
    expect(climb.badge).toBe('tail');
    const steeperClimb = scoreSegment(NORTH_SEGMENT, 19, meteoToDir(180), 8);
    expect(steeperClimb.badge).toBe('neutral');
  });

  it('handles degenerate inputs', () => {
    expect(scoreSegment([], 20, 0, 0).badge).toBe('neutral');
    expect(scoreSegment([[45, -122]], 20, 0, 0).effectiveTailwindKmh).toBe(0);
    const dupes = scoreSegment(
      [
        [45, -122],
        [45, -122],
      ],
      20,
      0,
      0,
    );
    expect(dupes.effectiveTailwindKmh).toBe(0);
  });
});

describe('classifyLeg / legShares', () => {
  it('classifies legs by angle to wind', () => {
    expect(classifyLeg(0, 0)).toBe('tail');
    expect(classifyLeg(60, 0)).toBe('tail');
    expect(classifyLeg(90, 0)).toBe('cross');
    expect(classifyLeg(120, 0)).toBe('head');
    expect(classifyLeg(180, 0)).toBe('head');
  });

  it('sums distance shares to 1', () => {
    const { legs } = scoreSegment(LOOP_SEGMENT, 20, meteoToDir(180), 0);
    const shares = legShares(legs);
    expect(shares.tail + shares.cross + shares.head).toBeCloseTo(1, 5);
  });
});
