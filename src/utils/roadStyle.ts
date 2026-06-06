import type { Road, RoadDefaults, RoadType } from "../types/road";

type RoadVisualStyle = {
  body: string;
  outer: string;
  laneMarking: string;
  laneMarkingWidth: number;
  divider: string;
  dividerWidth: number;
  selected: string;
  selectedHaloPadding: number;
  outerPadding: number;
};

const ROAD_STYLES: Record<RoadType, RoadVisualStyle> = {
  local: {
    body: "#7b8490",
    outer: "#3d4652",
    laneMarking: "#edf2f7",
    laneMarkingWidth: 1.5,
    divider: "#edf2f7",
    dividerWidth: 2,
    selected: "#2f80ed",
    selectedHaloPadding: 10,
    outerPadding: 5,
  },
  arterial: {
    body: "#535c66",
    outer: "#20262d",
    laneMarking: "#f8fafc",
    laneMarkingWidth: 1.7,
    divider: "#ffd166",
    dividerWidth: 4,
    selected: "#f97316",
    selectedHaloPadding: 12,
    outerPadding: 7,
  },
};

export const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  local: "Local road",
  arterial: "Arterial road",
};

export const DEFAULT_ROAD_BY_TYPE: Record<RoadType, RoadDefaults> = {
  local: {
    roadType: "local",
    width: 18,
    lanes: 2,
    divider: false,
    zLevel: 0,
  },
  arterial: {
    roadType: "arterial",
    width: 32,
    lanes: 4,
    divider: true,
    zLevel: 0,
  },
};

export function getRoadStyle(road: Road): RoadVisualStyle {
  return ROAD_STYLES[road.roadType];
}

export function getDefaultsForRoadType(roadType: RoadType): RoadDefaults {
  return DEFAULT_ROAD_BY_TYPE[roadType];
}
