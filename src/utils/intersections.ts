import type { Point } from "../types/road";
import type { VisualRoadSegment } from "./visualRoadSegments";

export type RoadIntersection = {
  id: string;
  point: Point;
  zLevel: number;
  roadIds: string[];
  radius: number;
};

type RenderSegment = {
  road: VisualRoadSegment;
  from: Point;
  to: Point;
};

const MERGE_DISTANCE = 8;
const ENDPOINT_IGNORE_DISTANCE = 10;
const ENDPOINT_SEGMENT_DISTANCE = 5;
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

function closestPointOnSegment(point: Point, from: Point, to: Point): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return from;

  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return {
    x: from.x + dx * t,
    y: from.y + dy * t,
  };
}

function getSegments(road: VisualRoadSegment): RenderSegment[] {
  const renderPoints = road.points;
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
  if (a.road.sourceRoadId === b.road.sourceRoadId) return null;

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

function getIntersectionRadius(roads: VisualRoadSegment[]): number {
  const widestRoad = roads.reduce((widest, road) => (road.width > widest.width ? road : widest));
  return widestRoad.width / 2 + 6;
}

function createIntersectionId(point: Point, zLevel: number): string {
  return `intersection-${zLevel}-${Math.round(point.x)}-${Math.round(point.y)}`;
}

function mergeIntersection(intersections: RoadIntersection[], point: Point, zLevel: number, roads: VisualRoadSegment[]) {
  const nearby = intersections.find(
    (intersection) => intersection.zLevel === zLevel && distance(intersection.point, point) <= MERGE_DISTANCE,
  );
  const roadIds = roads.map((road) => road.sourceRoadId);

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

function getEndpointCandidates(road: VisualRoadSegment): Point[] {
  const candidates: Point[] = [];
  const firstPoint = road.points[0];
  const lastPoint = road.points[road.points.length - 1];

  if (firstPoint && !road.suppressStartCap) candidates.push(firstPoint);
  if (lastPoint && !road.suppressEndCap) candidates.push(lastPoint);

  return candidates;
}

function addEndpointSegmentIntersections(
  intersections: RoadIntersection[],
  endpointRoad: VisualRoadSegment,
  segmentRoad: VisualRoadSegment,
  segmentRoadSegments: RenderSegment[],
  zLevel: number,
) {
  if (endpointRoad.sourceRoadId === segmentRoad.sourceRoadId) return;

  getEndpointCandidates(endpointRoad).forEach((endpoint) => {
    segmentRoadSegments.forEach((segment) => {
      const closestPoint = closestPointOnSegment(endpoint, segment.from, segment.to);
      if (distance(endpoint, closestPoint) <= ENDPOINT_SEGMENT_DISTANCE) {
        mergeIntersection(intersections, closestPoint, zLevel, [endpointRoad, segmentRoad]);
      }
    });
  });
}

export function getRoadIntersections(roads: VisualRoadSegment[]): RoadIntersection[] {
  const roadsByLevel = new Map<number, VisualRoadSegment[]>();

  roads.filter((road) => road.participatesInIntersection).forEach((road) => {
    roadsByLevel.set(road.zLevel, [...(roadsByLevel.get(road.zLevel) ?? []), road]);
  });

  const intersections: RoadIntersection[] = [];

  roadsByLevel.forEach((levelRoads, zLevel) => {
    for (let roadIndex = 0; roadIndex < levelRoads.length; roadIndex += 1) {
      for (let otherRoadIndex = roadIndex + 1; otherRoadIndex < levelRoads.length; otherRoadIndex += 1) {
        const road = levelRoads[roadIndex];
        const otherRoad = levelRoads[otherRoadIndex];
        if (road.sourceRoadId === otherRoad.sourceRoadId) continue;
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

        addEndpointSegmentIntersections(intersections, road, otherRoad, otherSegments, zLevel);
        addEndpointSegmentIntersections(intersections, otherRoad, road, segments, zLevel);
      }
    }
  });

  return intersections;
}
