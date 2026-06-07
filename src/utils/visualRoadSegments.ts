import type { OneWayDirection, Point, Road, RoadGeometryMode, RoadType } from "../types/road";
import { getRoadRenderPoints } from "./roadGeometry";

export type VisualRoadSegment = {
  id: string;
  sourceRoadId: string;
  sourceKind: "standard" | "connector";
  connectorPart?: "start" | "end";
  points: Point[];
  roadType: RoadType;
  width: number;
  lanes: number;
  divider: boolean;
  oneWay?: boolean;
  oneWayDirection?: OneWayDirection;
  zLevel: number;
  geometryMode: Extract<RoadGeometryMode, "polyline">;
  suppressStartCap?: boolean;
  suppressEndCap?: boolean;
  participatesInIntersection: boolean;
};

export function getPolylineLength(points: Point[]): number {
  if (points.length < 2) return 0;

  return points.slice(0, -1).reduce((total, point, index) => {
    const next = points[index + 1];
    return total + Math.hypot(next.x - point.x, next.y - point.y);
  }, 0);
}

export function interpolatePointOnSegment(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

export function splitPolylineAtRatio(points: Point[], ratio: number): { startPoints: Point[]; endPoints: Point[] } {
  if (points.length === 0) return { startPoints: [], endPoints: [] };
  if (points.length === 1) return { startPoints: [points[0]], endPoints: [points[0]] };

  const totalLength = getPolylineLength(points);
  if (totalLength === 0) {
    return {
      startPoints: [points[0], points[0]],
      endPoints: [points[0], points[points.length - 1]],
    };
  }

  const splitDistance = totalLength * Math.max(0, Math.min(1, ratio));
  let walked = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const segmentLength = Math.hypot(to.x - from.x, to.y - from.y);

    if (walked + segmentLength >= splitDistance) {
      const segmentRatio = segmentLength === 0 ? 0 : (splitDistance - walked) / segmentLength;
      const splitPoint = interpolatePointOnSegment(from, to, segmentRatio);
      return {
        startPoints: [...points.slice(0, index + 1), splitPoint],
        endPoints: [splitPoint, ...points.slice(index + 1)],
      };
    }

    walked += segmentLength;
  }

  const endPoint = points[points.length - 1];
  return {
    startPoints: [...points.slice(0, -1), endPoint],
    endPoints: [endPoint, endPoint],
  };
}

function createStandardSegment(road: Road): VisualRoadSegment {
  return {
    id: `${road.id}::standard`,
    sourceRoadId: road.id,
    sourceKind: "standard",
    points: getRoadRenderPoints(road.points, road.geometryMode),
    roadType: road.roadType,
    width: road.width,
    lanes: road.lanes,
    divider: road.divider,
    oneWay: road.oneWay,
    oneWayDirection: road.oneWayDirection,
    zLevel: road.zLevel,
    geometryMode: "polyline",
    participatesInIntersection: true,
  };
}

function createConnectorSegment(road: Road, connectorPart: "start" | "end", points: Point[]): VisualRoadSegment {
  return {
    id: `${road.id}::${connectorPart}`,
    sourceRoadId: road.id,
    sourceKind: "connector",
    connectorPart,
    points,
    roadType: road.roadType,
    width: road.width,
    lanes: road.lanes,
    divider: road.divider,
    oneWay: road.oneWay,
    oneWayDirection: road.oneWayDirection,
    zLevel: connectorPart === "start" ? road.startZLevel ?? road.zLevel : road.endZLevel ?? road.zLevel,
    geometryMode: "polyline",
    suppressEndCap: connectorPart === "start",
    suppressStartCap: connectorPart === "end",
    participatesInIntersection: true,
  };
}

export function getVisualRoadSegments(roads: Road[]): VisualRoadSegment[] {
  return roads.flatMap((road) => {
    if ((road.kind ?? "standard") !== "connector") {
      return [createStandardSegment(road)];
    }

    const renderPoints = getRoadRenderPoints(road.points, road.geometryMode);
    const { startPoints, endPoints } = splitPolylineAtRatio(renderPoints, 0.5);

    return [
      createConnectorSegment(road, "start", startPoints),
      createConnectorSegment(road, "end", endPoints),
    ];
  });
}
