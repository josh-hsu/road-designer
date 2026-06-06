import type { Point, Road } from "../types/road";
import { getRoadRenderPoints } from "./roadGeometry";

export type RoadLabelPlacement = {
  point: Point;
  rotation: number;
};

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function normalizeAngle(angle: number): number {
  if (angle > 90 || angle < -90) {
    return angle + 180;
  }

  return angle;
}

export function getRoadLabelPlacement(road: Road): RoadLabelPlacement | null {
  const points = getRoadRenderPoints(road.points, road.geometryMode);
  if (points.length < 2) return null;

  const segmentLengths = points.slice(0, -1).map((point, index) => distance(point, points[index + 1]));
  const totalLength = segmentLengths.reduce((sum, length) => sum + length, 0);
  if (totalLength === 0) return null;

  const midpointDistance = totalLength / 2;
  let walked = 0;

  for (let index = 0; index < segmentLengths.length; index += 1) {
    const length = segmentLengths[index];
    const from = points[index];
    const to = points[index + 1];

    if (walked + length >= midpointDistance) {
      const t = length === 0 ? 0 : (midpointDistance - walked) / length;
      const angle = (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;

      return {
        point: {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        },
        rotation: normalizeAngle(angle),
      };
    }

    walked += length;
  }

  return null;
}
