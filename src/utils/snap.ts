import type { Point, Road } from "../types/road";

export const SNAP_DISTANCE = 12;

export type SnapTarget = {
  roadId: string;
  pointIndex: number;
  point: Point;
  distance: number;
};

type SnapExclude = {
  roadId: string;
  pointIndex: number;
};

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function findNearestRoadNode(
  point: Point,
  roads: Road[],
  maxDistance = SNAP_DISTANCE,
  exclude?: SnapExclude,
): SnapTarget | null {
  let nearest: SnapTarget | null = null;

  roads.forEach((road) => {
    road.points.forEach((roadPoint, pointIndex) => {
      if (exclude?.roadId === road.id && exclude.pointIndex === pointIndex) return;

      const distance = distanceBetween(point, roadPoint);
      if (distance > maxDistance) return;
      if (!nearest || distance < nearest.distance) {
        nearest = {
          roadId: road.id,
          pointIndex,
          point: roadPoint,
          distance,
        };
      }
    });
  });

  return nearest;
}

export function snapPointToRoadNode(
  point: Point,
  roads: Road[],
  exclude?: SnapExclude,
): { point: Point; target: SnapTarget | null } {
  const target = findNearestRoadNode(point, roads, SNAP_DISTANCE, exclude);
  return {
    point: target ? target.point : point,
    target,
  };
}
