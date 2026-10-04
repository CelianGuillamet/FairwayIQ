import { computeSparkline } from './sparkline';

const BOX = { width: 124, height: 48, padding: 5 };

describe('computeSparkline', () => {
  it('returns nothing below two values', () => {
    expect(computeSparkline([], BOX)).toBeNull();
    expect(computeSparkline([12], BOX)).toBeNull();
  });

  it('spreads the points across the padded width', () => {
    const result = computeSparkline([14, 12, 13, 11], BOX);

    expect(result?.points.map((point) => point.x)).toEqual([5, 5 + 38, 5 + 76, 119]);
  });

  it('puts the lowest value at the top and the highest at the bottom', () => {
    const result = computeSparkline([14, 12, 13, 11, 12, 10, 11, 9], BOX);

    expect(result?.points[0].y).toBe(43);
    expect(result?.points[7].y).toBe(5);
    expect(result?.last).toEqual(result?.points[7]);
  });

  it('keeps every point inside the padded box', () => {
    const result = computeSparkline([3, 40, -7, 12, 12], BOX);

    for (const point of result?.points ?? []) {
      expect(point.x).toBeGreaterThanOrEqual(BOX.padding);
      expect(point.x).toBeLessThanOrEqual(BOX.width - BOX.padding);
      expect(point.y).toBeGreaterThanOrEqual(BOX.padding);
      expect(point.y).toBeLessThanOrEqual(BOX.height - BOX.padding);
    }
  });

  it('draws a flat series through the middle', () => {
    const result = computeSparkline([10, 10, 10], BOX);

    expect(result?.points.every((point) => point.y === 24)).toBe(true);
  });

  it('builds the line and the closed area path', () => {
    const result = computeSparkline([2, 1], { width: 100, height: 40, padding: 10 });

    expect(result?.line).toBe('M10.0 30.0 L90.0 10.0');
    expect(result?.area).toBe('M10.0 30.0 L90.0 10.0 L90.0 40.0 L10.0 40.0 Z');
  });
});
