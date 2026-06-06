export type Point = {
  x: number;
  y: number;
};

export type RoadType = "local" | "arterial";

export type RoadGeometryMode = "polyline" | "bezier";

export type RouteClass = "none" | "national_freeway" | "expressway" | "provincial_highway";

export type Road = {
  id: string;
  points: Point[];
  roadType: RoadType;
  width: number;
  lanes: number;
  divider: boolean;
  zLevel: number;
  geometryMode?: RoadGeometryMode;
  name?: string;
  routeClass?: RouteClass;
  routeNumber?: string;
  showLabel?: boolean;
};

export type ProjectData = {
  version: 1;
  roads: Road[];
};

export type ToolMode = "select" | "draw" | "drawCurve";

export type RoadDefaults = Pick<
  Road,
  "roadType" | "width" | "lanes" | "divider" | "zLevel" | "name" | "routeClass" | "routeNumber" | "showLabel"
>;
