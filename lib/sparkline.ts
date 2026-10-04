export type SparklinePoint = { x: number; y: number };

export type SparklineGeometry = {
  points: SparklinePoint[];
  line: string;
  area: string;
  last: SparklinePoint;
};

type Box = { width: number; height: number; padding: number };

const fixed = (value: number) => value.toFixed(1);

// Lower values (better scores) sit higher, so an improving series climbs to the right.
export function computeSparkline(values: number[], { width, height, padding }: Box): SparklineGeometry | null {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const innerWidth = width - 2 * padding;
  const innerHeight = height - 2 * padding;

  const points = values.map((value, index) => ({
    x: padding + (index * innerWidth) / (values.length - 1),
    y: span === 0 ? height / 2 : padding + ((value - min) / span) * innerHeight,
  }));

  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${fixed(point.x)} ${fixed(point.y)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const area = `${line} L${fixed(last.x)} ${fixed(height)} L${fixed(first.x)} ${fixed(height)} Z`;

  return { points, line, area, last };
}
