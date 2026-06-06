import type { Point, Road } from "../types/road";
import { offsetPolyline } from "./roadGeometry";
import { getRoadStyle } from "./roadStyle";

export type RoadLayerStyle = {
  points: number[];
  stroke: string;
  strokeWidth: number;
  dash?: number[];
  opacity?: number;
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

export function getLaneMarkingLayers(road: Road, renderPoints: Point[]): RoadLayerStyle[] {
  if (road.lanes <= 1 || renderPoints.length < 2) return [];

  const style = getRoadStyle(road);
  const laneWidth = road.width / road.lanes;
  const layers: RoadLayerStyle[] = [];

  for (let laneIndex = 1; laneIndex < road.lanes; laneIndex += 1) {
    const offset = -road.width / 2 + laneWidth * laneIndex;
    const isCenterDivider = road.divider && Math.abs(offset) < 0.5;

    if (isCenterDivider) continue;

    layers.push({
      points: offsetPolyline(renderPoints, offset).flatMap((point) => [point.x, point.y]),
      stroke: style.laneMarking,
      strokeWidth: style.laneMarkingWidth,
      dash: [10, 12],
      opacity: 0.72,
    });
  }

  return layers;
}

export function getDividerLayer(road: Road, flattenedPoints: number[]): RoadLayerStyle | null {
  if (!road.divider || road.roadType !== "arterial") return null;

  const style = getRoadStyle(road);
  return {
    points: flattenedPoints,
    stroke: style.divider,
    strokeWidth: style.dividerWidth,
    dash: [18, 10],
    opacity: 0.95,
  };
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
      const roadsByLevel = [...connectedRoads].sort((a, b) => a.zLevel - b.zLevel);
      const topRoad = roadsByLevel[roadsByLevel.length - 1] ?? connectedRoads[0];
      const topStyle = getRoadStyle(topRoad);
      const widestRoad = connectedRoads.reduce((widest, road) => (road.width > widest.width ? road : widest));
      const widestStyle = getRoadStyle(widestRoad);

      return {
        x,
        y,
        outerRadius: (widestRoad.width + widestStyle.outerPadding) / 2,
        bodyRadius: widestRoad.width / 2,
        outer: topStyle.outer,
        body: topStyle.body,
      };
    });
}
