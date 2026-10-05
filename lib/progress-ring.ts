export function getRingGeometry(size: number, strokeWidth: number, progress: number) {
  const radius = Math.max((size - strokeWidth) / 2, 0);
  const circumference = 2 * Math.PI * radius;
  const clamped = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;

  return {
    center: size / 2,
    radius,
    circumference,
    dashOffset: circumference * (1 - clamped),
    progress: clamped,
  };
}
