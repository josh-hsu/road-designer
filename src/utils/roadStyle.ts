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
  outerDash?: number[];
};

const ROAD_BODY_COLORS: Record<RoadType, string> = {
  motorway: "rgb(231, 132, 152)",
  primary: "rgb(255, 209, 154)",
  secondary: "rgb(248, 251, 183)",
  tertiary: "rgb(255, 255, 255)",
  residential: "rgb(255, 255, 255)",
};

const TUNNEL_BODY_COLORS: Record<RoadType, string> = {
  motorway: "rgb(240, 178, 191)",
  primary: "rgb(255, 233, 207)",
  secondary: "rgb(251, 253, 209)",
  tertiary: "rgb(240, 240, 240)",
  residential: "rgb(240, 240, 240)",
};

const ROAD_OUTER_COLORS: Record<RoadType, string> = {
  motorway: "rgb(188, 83, 108)",
  primary: "rgb(220, 155, 87)",
  secondary: "rgb(204, 207, 132)",
  tertiary: "rgb(184, 190, 199)",
  residential: "rgb(198, 204, 213)",
};

const ROAD_SELECTED_COLORS: Record<RoadType, string> = {
  motorway: "#dc2626",
  primary: "#f97316",
  secondary: "#ca8a04",
  tertiary: "#2563eb",
  residential: "#2563eb",
};

const ROAD_STYLE_BASE: Record<RoadType, Omit<RoadVisualStyle, "body" | "outerDash">> = {
  motorway: {
    outer: ROAD_OUTER_COLORS.motorway,
    laneMarking: "#ffffff",
    laneMarkingWidth: 1.8,
    divider: "#8b1e38",
    dividerWidth: 4,
    selected: ROAD_SELECTED_COLORS.motorway,
    selectedHaloPadding: 12,
    outerPadding: 7,
  },
  primary: {
    outer: ROAD_OUTER_COLORS.primary,
    laneMarking: "#ffffff",
    laneMarkingWidth: 1.7,
    divider: "#b45309",
    dividerWidth: 4,
    selected: ROAD_SELECTED_COLORS.primary,
    selectedHaloPadding: 12,
    outerPadding: 7,
  },
  secondary: {
    outer: ROAD_OUTER_COLORS.secondary,
    laneMarking: "#9ca3af",
    laneMarkingWidth: 1.6,
    divider: "#ca8a04",
    dividerWidth: 3,
    selected: ROAD_SELECTED_COLORS.secondary,
    selectedHaloPadding: 10,
    outerPadding: 6,
  },
  tertiary: {
    outer: ROAD_OUTER_COLORS.tertiary,
    laneMarking: "#9ca3af",
    laneMarkingWidth: 1.5,
    divider: "#9ca3af",
    dividerWidth: 3,
    selected: ROAD_SELECTED_COLORS.tertiary,
    selectedHaloPadding: 10,
    outerPadding: 5,
  },
  residential: {
    outer: ROAD_OUTER_COLORS.residential,
    laneMarking: "#9ca3af",
    laneMarkingWidth: 1.4,
    divider: "#9ca3af",
    dividerWidth: 3,
    selected: ROAD_SELECTED_COLORS.residential,
    selectedHaloPadding: 10,
    outerPadding: 5,
  },
};

export const ROAD_TYPE_LABELS: Record<RoadType, string> = {
  motorway: "Motorway",
  primary: "Level 1 Primary road",
  secondary: "Level 2 Secondary road",
  tertiary: "Level 3 Tertiary road",
  residential: "Residential road",
};

export const ROAD_TYPE_PRIORITY: Record<RoadType, number> = {
  residential: 1,
  tertiary: 2,
  secondary: 3,
  primary: 4,
  motorway: 5,
};

const WIDTHS_BY_ROAD_TYPE: Record<RoadType, Record<number, number>> = {
  motorway: { 1: 4, 2: 7, 4: 17, 6: 22 },
  primary: { 1: 4, 2: 7, 4: 17, 6: 22 },
  secondary: { 1: 4, 2: 7, 4: 17, 6: 22 },
  tertiary: { 1: 4, 2: 7, 4: 17, 6: 22 },
  residential: { 1: 4, 2: 6, 4: 15, 6: 20 },
};

export function getRoadPresetWidth(roadType: RoadType, lanes: number): number {
  return WIDTHS_BY_ROAD_TYPE[roadType][lanes] ?? WIDTHS_BY_ROAD_TYPE[roadType][2];
}

function createDefaults(roadType: RoadType): RoadDefaults {
  return {
    roadType,
    width: getRoadPresetWidth(roadType, 2),
    lanes: 2,
    divider: false,
    isTunnel: false,
    zLevel: 0,
    kind: "standard",
    startZLevel: 0,
    endZLevel: 0,
    oneWay: false,
    oneWayDirection: "forward",
    name: "",
    routeClass: "none",
    routeNumber: "",
    showLabel: true,
  };
}

export const DEFAULT_ROAD_BY_TYPE: Record<RoadType, RoadDefaults> = {
  motorway: createDefaults("motorway"),
  primary: createDefaults("primary"),
  secondary: createDefaults("secondary"),
  tertiary: createDefaults("tertiary"),
  residential: createDefaults("residential"),
};

export function getRoadStyle(road: Pick<Road, "roadType" | "isTunnel">): RoadVisualStyle {
  const baseStyle = ROAD_STYLE_BASE[road.roadType];
  return {
    ...baseStyle,
    body: road.isTunnel ? TUNNEL_BODY_COLORS[road.roadType] : ROAD_BODY_COLORS[road.roadType],
    outerDash: road.isTunnel ? [22, 24] : undefined,
  };
}

export function getDefaultsForRoadType(roadType: RoadType): RoadDefaults {
  return DEFAULT_ROAD_BY_TYPE[roadType];
}

type RoadPriorityInput = Pick<Road, "id" | "roadType" | "width">;

export function compareRoadVisualPriority(a: RoadPriorityInput, b: RoadPriorityInput): number {
  const typePriority = ROAD_TYPE_PRIORITY[a.roadType] - ROAD_TYPE_PRIORITY[b.roadType];
  if (typePriority !== 0) return typePriority;

  const widthPriority = a.width - b.width;
  if (widthPriority !== 0) return widthPriority;

  return a.id.localeCompare(b.id);
}
