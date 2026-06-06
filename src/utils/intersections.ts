import type { Point, Road } from "../types/road";
import { getRoadRenderPoints } from "./roadGeometry";

export type RoadIntersection = {
  id: string;
  point: Point;
  zLevel: number;
  roadIds: string[];
  radius: number;
};

type RenderSegment = {
  road: Road;
  from: Point;
  to: Point;
};

const MERGE_DISTANCE = 8;
const ENDPOINT_IGNORE_DISTANCE = 10;
const EPSILON = 0.000001;

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function cross(a: Point, b: Point): number {
  return a.x * b.y - a.y * b.x;
}

function subtract(a: Point, b: Point): Point {
  return {
    x: a.x - b.x,
    y: a.y - b.y,
  };
}

function getSegments(road: Road): RenderSegment[] {
  const renderPoints = getRoadRenderPoints(road.points, road.geometryMode);
  const segments: RenderSegment[] = [];

  for (let index = 0; index < renderPoints.length - 1; index += 1) {
    segments.push({
      road,
      from: renderPoints[index],
      to: renderPoints[index + 1],
    });
  }

  return segments;
}

function getSegmentIntersection(a: RenderSegment, b: RenderSegment): Point | null {
  const p = a.from;
  const q = b.from;
  const r = subtract(a.to, a.from);
  const s = subtract(b.to, b.from);
  const denominator = cross(r, s);

  if (Math.abs(denominator) < EPSILON) return null;

  const qMinusP = subtract(q, p);
  const t = cross(qMinusP, s) / denominator;
  const u = cross(qMinusP, r) / denominator;

  if (t <= EPSILON || t >= 1 - EPSILON || u <= EPSILON || u >= 1 - EPSILON) {
    return null;
  }

  const point = {
    x: p.x + t * r.x,
    y: p.y + t * r.y,
  };

  const nearAEndpoint = distance(point, a.from) < ENDPOINT_IGNORE_DISTANCE || distance(point, a.to) < ENDPOINT_IGNORE_DISTANCE;
  const nearBEndpoint = distance(point, b.from) < ENDPOINT_IGNORE_DISTANCE || distance(point, b.to) < ENDPOINT_IGNORE_DISTANCE;

  if (nearAEndpoint && nearBEndpoint) return null;

  return point;
}

function getIntersectionRadius(roads: Road[]): number {
  const widestRoad = roads.reduce((widest, road) => (road.width > widest.width ? road : widest));
  return widestRoad.width / 2 + 6;
}

function createIntersectionId(point: Point, zLevel: number): string {
  return `intersection-${zLevel}-${Math.round(point.x)}-${Math.round(point.y)}`;
}

function mergeIntersection(intersections: RoadIntersection[], point: Point, zLevel: number, roads: Road[]) {
  const nearby = intersections.find(
    (intersection) => intersection.zLevel === zLevel && distance(intersection.point, point) <= MERGE_DISTANCE,
  );
  const roadIds = roads.map((road) => road.id);

  if (nearby) {
    nearby.point = {
      x: (nearby.point.x + point.x) / 2,
      y: (nearby.point.y + point.y) / 2,
    };
    nearby.roadIds = Array.from(new Set([...nearby.roadIds, ...roadIds])).sort();
    nearby.radius = Math.max(nearby.radius, getIntersectionRadius(roads));
    nearby.id = createIntersectionId(nearby.point, nearby.zLevel);
    return;
  }

  intersections.push({
    id: createIntersectionId(point, zLevel),
    point,
    zLevel,
    roadIds: roadIds.sort(),
    radius: getIntersectionRadius(roads),
  });
}

export function getRoadIntersections(roads: Road[]): RoadIntersection[] {
  const roadsByLevel = new Map<number, Road[]>();

  roads.forEach((road) => {
    roadsByLevel.set(road.zLevel, [...(roadsByLevel.get(road.zLevel) ?? []), road]);
  });

  const intersections: RoadIntersection[] = [];

  roadsByLevel.forEach((levelRoads, zLevel) => {
    for (let roadIndex = 0; roadIndex < levelRoads.length; roadIndex += 1) {
      for (let otherRoadIndex = roadIndex + 1; otherRoadIndex < levelRoads.length; otherRoadIndex += 1) {
        const road = levelRoads[roadIndex];
        const otherRoad = levelRoads[otherRoadIndex];
        const segments = getSegments(road);
        const otherSegments = getSegments(otherRoad);

        segments.forEach((segment) => {
          otherSegments.forEach((otherSegment) => {
            const point = getSegmentIntersection(segment, otherSegment);
            if (point) {
              mergeIntersection(intersections, point, zLevel, [road, otherRoad]);
            }
          });
        });
      }
    }
  });

  return intersections;
}
