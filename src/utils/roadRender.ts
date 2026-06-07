import type { Point, Road } from "../types/road";
import { offsetPolyline } from "./roadGeometry";
import { compareRoadVisualPriority, getRoadStyle } from "./roadStyle";
import type { VisualRoadSegment } from "./visualRoadSegments";

export type RoadLayerStyle = {
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  opacity?: number;
};

export type RoadMarkingMask = {
  point: Point;
  radius: number;
  shape?: "circle" | "square";
};

type RenderableRoad = Pick<Road, "id" | "roadType" | "width" | "lanes" | "divider"> & {
  sourceRoadId?: string;
  sourceKind?: "standard" | "connector";
  oneWay?: boolean;
  oneWayDirection?: "forward" | "reverse";
  points: Point[];
};

export type RoadArrowLayer = {
  points: number[];
  stroke: string;
  fill: string;
  strokeWidth: number;
  pointerLength: number;
  pointerWidth: number;
  opacity?: number;
};

export type JunctionRenderStyle = {
  x: number;
  y: number;
  roadIds: string[];
  outerSize: number;
  bodySize: number;
  outer: string;
  body: string;
};

export function getRoadLayerStyles(road: RenderableRoad, flattenedPoints: number[], isSelected: boolean): RoadLayerStyle[] {
  const style = getRoadStyle(road);
  const layers: RoadLayerStyle[] = [];

  if (isSelected) {
    layers.push({
      points: flattenedPoints,
      stroke: style.selected,
      strokeWidth: road.width + style.selectedHaloPadding,
      opacity: 0.9,
    });
  }

  layers.push({
    points: flattenedPoints,
    stroke: style.outer,
    strokeWidth: road.width + style.outerPadding,
  });

  layers.push({
    points: flattenedPoints,
    stroke: style.body,
    strokeWidth: road.width,
  });

  return layers;
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function densifyPolyline(points: Point[], maxSegmentLength = 8): Point[] {
  if (points.length < 2) return points;

  const densePoints: Point[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const segmentLength = distance(from, to);
    const steps = Math.max(1, Math.ceil(segmentLength / maxSegmentLength));

    if (index === 0) densePoints.push(from);

    for (let step = 1; step <= steps; step += 1) {
      const t = step / steps;
      densePoints.push({
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t,
      });
    }
  }

  return densePoints;
}

function pointIsMasked(point: Point, masks: RoadMarkingMask[]): boolean {
  return masks.some((mask) => {
    if (mask.shape === "square") {
      return Math.abs(point.x - mask.point.x) <= mask.radius && Math.abs(point.y - mask.point.y) <= mask.radius;
    }

    return distance(point, mask.point) <= mask.radius;
  });
}

function splitPolylineByMasks(points: Point[], masks: RoadMarkingMask[]): Point[][] {
  if (masks.length === 0) return [points];

  const densePoints = densifyPolyline(points);
  const chunks: Point[][] = [];
  let currentChunk: Point[] = [];

  densePoints.forEach((point) => {
    if (pointIsMasked(point, masks)) {
      if (currentChunk.length > 1) chunks.push(currentChunk);
      currentChunk = [];
      return;
    }

    currentChunk.push(point);
  });

  if (currentChunk.length > 1) chunks.push(currentChunk);

  return chunks;
}

function getPointAtDistance(points: Point[], distanceAlong: number): { point: Point; angle: number } | null {
  if (points.length < 2) return null;

  let walked = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const from = points[index];
    const to = points[index + 1];
    const segmentLength = distance(from, to);
    if (segmentLength === 0) continue;

    if (walked + segmentLength >= distanceAlong) {
      const t = (distanceAlong - walked) / segmentLength;
      return {
        point: {
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        },
        angle: Math.atan2(to.y - from.y, to.x - from.x),
      };
    }

    walked += segmentLength;
  }

  const from = points[points.length - 2];
  const to = points[points.length - 1];
  return {
    point: to,
    angle: Math.atan2(to.y - from.y, to.x - from.x),
  };
}

export function getOneWayArrowLayers(
  road: RenderableRoad,
  renderPoints: Point[],
  masks: RoadMarkingMask[] = [],
): RoadArrowLayer[] {
  if (!road.oneWay || renderPoints.length < 2) return [];

  const style = getRoadStyle(road);
  const spacing = 120;
  const arrowLength = Math.max(14, Math.min(30, road.width * 0.85));
  const layers: RoadArrowLayer[] = [];
  const arrowPaths = road.divider
    ? [offsetPolyline(renderPoints, -road.width * 0.25), offsetPolyline(renderPoints, road.width * 0.25)]
    : [renderPoints];

  arrowPaths.forEach((arrowPath) => {
    const totalLength = arrowPath.slice(0, -1).reduce((total, point, index) => {
      return total + distance(point, arrowPath[index + 1]);
    }, 0);
    if (totalLength < 48) return;

    const firstDistance = Math.min(spacing * 0.7, totalLength / 2);

    for (let distanceAlong = firstDistance; distanceAlong < totalLength; distanceAlong += spacing) {
      const sampled = getPointAtDistance(arrowPath, distanceAlong);
      if (!sampled || pointIsMasked(sampled.point, masks)) continue;

      const angle = sampled.angle + (road.oneWayDirection === "reverse" ? Math.PI : 0);
      const dx = Math.cos(angle) * arrowLength;
      const dy = Math.sin(angle) * arrowLength;

      layers.push({
        points: [
          sampled.point.x - dx / 2,
          sampled.point.y - dy / 2,
          sampled.point.x + dx / 2,
          sampled.point.y + dy / 2,
        ],
        stroke: style.laneMarking,
        fill: style.laneMarking,
        strokeWidth: Math.max(1.8, Math.min(3.2, road.width * 0.11)),
        pointerLength: Math.max(5, Math.min(9, road.width * 0.28)),
        pointerWidth: Math.max(5, Math.min(10, road.width * 0.32)),
        opacity: 0.9,
      });
    }
  });

  return layers;
}

export function getLaneMarkingLayers(
  road: RenderableRoad,
  renderPoints: Point[],
  masks: RoadMarkingMask[] = [],
): RoadLayerStyle[] {
  if (road.lanes <= 1 || renderPoints.length < 2) return [];

  const style = getRoadStyle(road);
  const laneWidth = road.width / road.lanes;
  const layers: RoadLayerStyle[] = [];

  for (let laneIndex = 1; laneIndex < road.lanes; laneIndex += 1) {
    const offset = -road.width / 2 + laneWidth * laneIndex;
    const isCenterDivider = road.divider && Math.abs(offset) < 0.5;

    if (isCenterDivider) continue;

    splitPolylineByMasks(offsetPolyline(renderPoints, offset), masks).forEach((chunk) => {
      layers.push({
        points: chunk.flatMap((point) => [point.x, point.y]),
        stroke: style.laneMarking,
        strokeWidth: style.laneMarkingWidth,
        dash: [10, 12],
        opacity: 0.72,
      });
    });
  }

  return layers;
}

export function getDividerLayers(
  road: RenderableRoad,
  renderPoints: Point[],
  masks: RoadMarkingMask[] = [],
): RoadLayerStyle[] {
  if (!road.divider) return [];

  const style = getRoadStyle(road);
  return splitPolylineByMasks(renderPoints, masks).map((chunk) => ({
    points: chunk.flatMap((point) => [point.x, point.y]),
    stroke: style.divider,
    strokeWidth: style.dividerWidth,
    opacity: 0.95,
  }));
}

export function getEndpointJunctions(roads: VisualRoadSegment[]): JunctionRenderStyle[] {
  const endpointGroups = new Map<string, VisualRoadSegment[]>();

  roads.forEach((road) => {
    const endpoints = [road.points[0], road.points[road.points.length - 1]].filter(Boolean);
    endpoints.forEach((point) => {
      const key = `${Math.round(point.x)},${Math.round(point.y)}`;
      endpointGroups.set(key, [...(endpointGroups.get(key) ?? []), road]);
    });
  });

  return Array.from(endpointGroups.entries())
    .filter(([, connectedRoads]) => connectedRoads.length > 1)
    .filter(([, connectedRoads]) => new Set(connectedRoads.map((road) => road.sourceRoadId)).size > 1)
    .map(([key, connectedRoads]) => {
      const [x, y] = key.split(",").map(Number);
      const widestRoad = connectedRoads.reduce((widest, road) => (road.width > widest.width ? road : widest));
      const primaryRoad = [...connectedRoads].sort(compareRoadVisualPriority)[connectedRoads.length - 1] ?? widestRoad;
      const widestStyle = getRoadStyle(widestRoad);
      const primaryStyle = getRoadStyle(primaryRoad);
      const outerSize = widestRoad.width + widestStyle.outerPadding;

      return {
        x,
        y,
        roadIds: connectedRoads.map((road) => road.sourceRoadId),
        outerSize,
        bodySize: widestRoad.width,
        outer: primaryStyle.outer,
        body: primaryStyle.body,
      };
    });
}
