import type { Point } from "../types/road";

export function flattenPoints(points: Point[]): number[] {
  return points.flatMap((point) => [point.x, point.y]);
}

function normalize(x: number, y: number): Point {
  const length = Math.hypot(x, y);
  if (length === 0) return { x: 0, y: 0 };
  return { x: x / length, y: y / length };
}

function segmentNormal(from: Point, to: Point): Point {
  const direction = normalize(to.x - from.x, to.y - from.y);
  return { x: -direction.y, y: direction.x };
}

export function offsetPolyline(points: Point[], offset: number): Point[] {
  if (points.length < 2 || offset === 0) return points;

  return points.map((point, index) => {
    const previous = points[index - 1];
    const next = points[index + 1];

    if (!previous && next) {
      const normal = segmentNormal(point, next);
      return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
    }

    if (previous && !next) {
      const normal = segmentNormal(previous, point);
      return { x: point.x + normal.x * offset, y: point.y + normal.y * offset };
    }

    if (previous && next) {
      const before = segmentNormal(previous, point);
      const after = segmentNormal(point, next);
      const averaged = normalize(before.x + after.x, before.y + after.y);
      const bend = Math.max(0.35, before.x * after.x + before.y * after.y);
      return {
        x: point.x + (averaged.x * offset) / bend,
        y: point.y + (averaged.y * offset) / bend,
      };
    }

    return point;
  });
}

export function sampleCubicBezier(points: Point[], segments = 32): Point[] {
  if (points.length < 4) return points;

  const [start, control1, control2, end] = points;
  const sampled: Point[] = [];

  for (let index = 0; index <= segments; index += 1) {
    const t = index / segments;
    const inverse = 1 - t;
    const x =
      inverse ** 3 * start.x +
      3 * inverse ** 2 * t * control1.x +
      3 * inverse * t ** 2 * control2.x +
      t ** 3 * end.x;
    const y =
      inverse ** 3 * start.y +
      3 * inverse ** 2 * t * control1.y +
      3 * inverse * t ** 2 * control2.y +
      t ** 3 * end.y;
    sampled.push({ x, y });
  }

  return sampled;
}

export function getRoadRenderPoints(points: Point[], geometryMode = "polyline"): Point[] {
  if (geometryMode === "bezier") {
    return sampleCubicBezier(points);
  }

  return points;
}
