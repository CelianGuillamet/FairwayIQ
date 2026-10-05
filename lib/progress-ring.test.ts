import { getRingGeometry } from './progress-ring';

describe('getRingGeometry', () => {
  it('draws the stroke inside the box', () => {
    const { center, radius, circumference } = getRingGeometry(56, 6, 0.5);

    expect(center).toBe(28);
    expect(radius).toBe(25);
    expect(circumference).toBeCloseTo(2 * Math.PI * 25);
  });

  it('hides the unfinished part of the circle through the dash offset', () => {
    const empty = getRingGeometry(56, 6, 0);
    const half = getRingGeometry(56, 6, 0.5);
    const full = getRingGeometry(56, 6, 1);

    expect(empty.dashOffset).toBeCloseTo(empty.circumference);
    expect(half.dashOffset).toBeCloseTo(half.circumference / 2);
    expect(full.dashOffset).toBe(0);
  });

  it('clamps the progress and ignores non-finite values', () => {
    expect(getRingGeometry(56, 6, 4).progress).toBe(1);
    expect(getRingGeometry(56, 6, -1).progress).toBe(0);
    expect(getRingGeometry(56, 6, Number.NaN).progress).toBe(0);
  });

  it('never gives a negative radius', () => {
    expect(getRingGeometry(4, 10, 1).radius).toBe(0);
  });
});
