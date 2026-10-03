import type { CourseHoleGpsPoint } from './golf-courses';

export type LatLng = {
  latitude: number;
  longitude: number;
};

export type GreenDistances = {
  front: number | null;
  center: number | null;
  back: number | null;
};

const EARTH_RADIUS_M = 6371000;

export function haversineDistanceMeters(from: LatLng, to: LatLng): number {
  const toRadians = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const haversine = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const centralAngle = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));

  return EARTH_RADIUS_M * centralAngle;
}

function distanceToPointType(
  gpsPoints: CourseHoleGpsPoint[],
  position: LatLng,
  pointType: CourseHoleGpsPoint['pointType']
) {
  const point = gpsPoints.find((candidate) => candidate.pointType === pointType);
  return point ? Math.round(haversineDistanceMeters(position, point)) : null;
}

export function getGreenDistances(
  gpsPoints: CourseHoleGpsPoint[] | null | undefined,
  position: LatLng | null
): GreenDistances | null {
  if (!position || !gpsPoints || gpsPoints.length === 0) {
    return null;
  }

  const front = distanceToPointType(gpsPoints, position, 'green_front');
  const center = distanceToPointType(gpsPoints, position, 'green_center');
  const back = distanceToPointType(gpsPoints, position, 'green_back');

  if (front == null && center == null && back == null) {
    return null;
  }

  return { front, center, back };
}
