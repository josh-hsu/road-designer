import type { Point, RoadGeometryMode } from "../types/road";
import { getRoadRenderPoints } from "./roadGeometry";

export type BladeHit = {
  distance: number;
  point: Point;
  renderSegmentIndex: number;
  segmentT: number;
  pathT: number;
};

export type SplitPathResult = {
  startPoints: Point[];
  endPoints: Point[];
  geometryMode: RoadGeometryMode;
};

const MIN_SPLIT_DISTANCE_FROM_END = 4;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

function roundPoint(point: Point): Point {
  return {
    x: Math.round(point.x),
    y: Math.round(point.y),
  };
}

function getPolylineLength(points: Point[]): number {
  return points.slice(0, -1).reduce((total, point, index) => total + distance(point, points[index + 1]), 0);
}

function closestPointOnSegment(point: Point, from: Point, to: Point): { point: Point; t: number; distance: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return { point: from, t: 0, distance: distance(point, from) };
  }

  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  const closest = lerpPoint(from, to, t);
  return { point: closest, t, distance: distance(point, closest) };
}

export function findBladeHit(points: Point[], geometryMode: RoadGeometryMode | undefined, target: Point): BladeHit | null {
  const renderPoints = getRoadRenderPoints(points, geometryMode);
  if (renderPoints.length < 2) return null;

  const totalLength = getPolylineLength(renderPoints);
  if (totalLength <= MIN_SPLIT_DISTANCE_FROM_END * 2) return null;

  let traversed = 0;
  let best: BladeHit | null = null;

  renderPoints.slice(0, -1).forEach((from, index) => {
    const to = renderPoints[index + 1];
    const segmentLength = distance(from, to);
    const closest = closestPointOnSegment(target, from, to);
    const lengthAtClosest = traversed + segmentLength * closest.t;

    if (
      lengthAtClosest > MIN_SPLIT_DISTANCE_FROM_END &&
      totalLength - lengthAtClosest > MIN_SPLIT_DISTANCE_FROM_END &&
      (!best || closest.distance < best.distance)
    ) {
      best = {
        distance: closest.distance,
        point: roundPoint(closest.point),
        renderSegmentIndex: index,
        segmentT: closest.t,
        pathT: lengthAtClosest / totalLength,
      };
    }

    traversed += segmentLength;
  });

  return best;
}

function splitPolyline(points: Point[], hit: BladeHit): SplitPathResult | null {
  if (points.length < 2) return null;

  const startPoints = points.slice(0, hit.renderSegmentIndex + 1);
  const endPoints = points.slice(hit.renderSegmentIndex + 1);
  const splitPoint = hit.point;

  const lastStart = startPoints[startPoints.length - 1];
  const firstEnd = endPoints[0];

  if (!lastStart || !firstEnd) return null;
  if (distance(lastStart, splitPoint) > 0.5) startPoints.push(splitPoint);
  if (distance(firstEnd, splitPoint) > 0.5) endPoints.unshift(splitPoint);

  if (startPoints.length < 2 || endPoints.length < 2) return null;
  return { startPoints, endPoints, geometryMode: "polyline" };
}

function splitCubicBezier(points: Point[], t: number): SplitPathResult | null {
  if (points.length < 4) return null;

  const [p0, p1, p2, p3] = points;
  const p01 = lerpPoint(p0, p1, t);
  const p12 = lerpPoint(p1, p2, t);
  const p23 = lerpPoint(p2, p3, t);
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);
  const p0123 = roundPoint(lerpPoint(p012, p123, t));

  return {
    startPoints: [p0, roundPoint(p01), roundPoint(p012), p0123],
    endPoints: [p0123, roundPoint(p123), roundPoint(p23), p3],
    geometryMode: "bezier",
  };
}

export function splitPathAtHit(
  points: Point[],
  geometryMode: RoadGeometryMode | undefined,
  hit: BladeHit,
): SplitPathResult | null {
  if ((geometryMode ?? "polyline") === "bezier") {
    return splitCubicBezier(points, hit.pathT);
  }

  return splitPolyline(points, hit);
}
