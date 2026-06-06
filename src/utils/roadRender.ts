import type { Point, Road } from "../types/road";
import { offsetPolyline } from "./roadGeometry";
import { compareRoadVisualPriority, getRoadStyle } from "./roadStyle";

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
};

export type JunctionRenderStyle = {
  x: number;
  y: number;
  outerRadius: number;
  bodyRadius: number;
  outer: string;
  body: string;
};

export function getRoadLayerStyles(road: Road, flattenedPoints: number[], isSelected: boolean): RoadLayerStyle[] {
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
  return masks.some((mask) => distance(point, mask.point) <= mask.radius);
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

export function getLaneMarkingLayers(
  road: Road,
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
  road: Road,
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

export function getEndpointJunctions(roads: Road[]): JunctionRenderStyle[] {
  const endpointGroups = new Map<string, Road[]>();

  roads.forEach((road) => {
    const endpoints = [road.points[0], road.points[road.points.length - 1]].filter(Boolean);
    endpoints.forEach((point) => {
      const key = `${Math.round(point.x)},${Math.round(point.y)}`;
      endpointGroups.set(key, [...(endpointGroups.get(key) ?? []), road]);
    });
  });

  return Array.from(endpointGroups.entries())
    .filter(([, connectedRoads]) => connectedRoads.length > 1)
    .map(([key, connectedRoads]) => {
      const [x, y] = key.split(",").map(Number);
      const widestRoad = connectedRoads.reduce((widest, road) => (road.width > widest.width ? road : widest));
      const primaryRoad = [...connectedRoads].sort(compareRoadVisualPriority)[connectedRoads.length - 1] ?? widestRoad;
      const widestStyle = getRoadStyle(widestRoad);
      const primaryStyle = getRoadStyle(primaryRoad);
      const outerRadius = (widestRoad.width + widestStyle.outerPadding) / 2;

      return {
        x,
        y,
        outerRadius,
        bodyRadius: outerRadius + 0.25,
        outer: primaryStyle.outer,
        body: primaryStyle.body,
      };
    });
}
