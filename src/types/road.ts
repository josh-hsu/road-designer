export type Point = {
  x: number;
  y: number;
};

export type RoadType = "local" | "arterial";

export type RoadGeometryMode = "polyline" | "bezier";

export type RoadKind = "standard" | "connector";

export type OneWayDirection = "forward" | "reverse";

export type RouteClass = "none" | "national_freeway" | "expressway" | "provincial_highway";

export type TransitRoute = {
  id: string;
  points: Point[];
  geometryMode?: RoadGeometryMode;
  color: string;
};

export type TransitStationType = "transfer" | "normal";

export type TransitStation = {
  id: string;
  point: Point;
  name: string;
  stationType?: TransitStationType;
  color?: string;
};

export type Road = {
  id: string;
  points: Point[];
  roadType: RoadType;
  width: number;
  lanes: number;
  divider: boolean;
  zLevel: number;
  geometryMode?: RoadGeometryMode;
  kind?: RoadKind;
  startZLevel?: number;
  endZLevel?: number;
  oneWay?: boolean;
  oneWayDirection?: OneWayDirection;
  name?: string;
  routeClass?: RouteClass;
  routeNumber?: string;
  showLabel?: boolean;
};

export type ProjectData = {
  version: 1;
  roads: Road[];
  transitRoutes?: TransitRoute[];
  transitStations?: TransitStation[];
};

export type ToolMode =
  | "select"
  | "draw"
  | "drawCurve"
  | "drawTransit"
  | "drawTransitCurve"
  | "transferStation"
  | "normalStation";

export type RoadDefaults = Pick<
  Road,
  | "roadType"
  | "width"
  | "lanes"
  | "divider"
  | "zLevel"
  | "kind"
  | "startZLevel"
  | "endZLevel"
  | "oneWay"
  | "oneWayDirection"
  | "name"
  | "routeClass"
  | "routeNumber"
  | "showLabel"
>;
