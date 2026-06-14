import { useCallback, useMemo, useReducer } from "react";
import type {
  Point,
  ProjectData,
  Road,
  RoadDefaults,
  RoadGeometryMode,
  RoadType,
  TransitStationType,
  TransitRoute,
  TransitRegion,
  TransitStation,
} from "../types/road";
import type { BladeHit } from "../utils/blade";
import { splitPathAtHit } from "../utils/blade";
import { getProjectNameFromFileName } from "../utils/fileName";
import { DEFAULT_ROAD_BY_TYPE, getDefaultsForRoadType, getRoadPresetWidth } from "../utils/roadStyle";

type RoadState = {
  roads: Road[];
  transitRoutes: TransitRoute[];
  transitRegions: TransitRegion[];
  transitStations: TransitStation[];
  selectedRoadId: string | null;
  selectedTransitRouteId: string | null;
  selectedTransitRegionId: string | null;
  selectedTransitStationId: string | null;
  draftPoints: Point[];
  drawDefaults: RoadDefaults;
  transitColor: string;
  transitPalette: string[];
  sourceFileName?: string;
  projectName: string;
  draftDefaults: RoadDefaults | null;
  dragSnapshot: ProjectData | null;
  past: ProjectData[];
  future: ProjectData[];
};

type RoadAction =
  | { type: "addDraftPoint"; point: Point }
  | { type: "clearDraft" }
  | { type: "finishDraft"; geometryMode: RoadGeometryMode }
  | { type: "finishTransitDraft"; geometryMode: RoadGeometryMode }
  | { type: "finishTransitRegion" }
  | { type: "addTransitStation"; point: Point; stationType: TransitStationType }
  | { type: "selectRoad"; roadId: string | null }
  | { type: "selectTransitRoute"; routeId: string | null }
  | { type: "selectTransitRegion"; regionId: string | null }
  | { type: "selectTransitStation"; stationId: string | null }
  | { type: "updateRoad"; roadId: string; patch: Partial<Omit<Road, "id">> }
  | { type: "updateTransitRegion"; regionId: string; patch: Partial<Omit<TransitRegion, "id">> }
  | { type: "updateTransitStation"; stationId: string; patch: Partial<Omit<TransitStation, "id">> }
  | { type: "updateRoadPoint"; roadId: string; pointIndex: number; point: Point }
  | { type: "previewTransitRoutePointDrag"; routeId: string; pointIndex: number; point: Point }
  | { type: "endTransitRoutePointDrag"; routeId: string; pointIndex: number; point: Point }
  | { type: "previewTransitRegionPointDrag"; regionId: string; pointIndex: number; point: Point }
  | { type: "endTransitRegionPointDrag"; regionId: string; pointIndex: number; point: Point }
  | { type: "previewTransitStationDrag"; stationId: string; point: Point }
  | { type: "endTransitStationDrag"; stationId: string; point: Point }
  | { type: "beginRoadPointDrag" }
  | { type: "previewRoadPointDrag"; roadId: string; pointIndex: number; point: Point }
  | { type: "endRoadPointDrag"; roadId: string; pointIndex: number; point: Point }
  | { type: "previewRoadDrag"; roadId: string; delta: Point }
  | { type: "endRoadDrag"; roadId: string; delta: Point }
  | { type: "deleteRoad"; roadId: string }
  | { type: "deleteTransitRoute"; routeId: string }
  | { type: "deleteTransitRegion"; regionId: string }
  | { type: "deleteTransitStation"; stationId: string }
  | { type: "splitRoad"; roadId: string; hit: BladeHit }
  | { type: "splitTransitRoute"; routeId: string; hit: BladeHit }
  | { type: "setDrawType"; roadType: RoadType }
  | { type: "setDrawTunnel"; isTunnel: boolean }
  | { type: "setDrawPreset"; defaults: RoadDefaults }
  | { type: "setTransitColor"; color: string }
  | { type: "addTransitColor"; color: string }
  | { type: "adoptRoadDefaults"; roadId: string }
  | { type: "loadProject"; project: ProjectData; sourceFileName?: string }
  | { type: "undo" }
  | { type: "redo" };

const initialState: RoadState = {
  roads: [],
  transitRoutes: [],
  transitRegions: [],
  transitStations: [],
  selectedRoadId: null,
  selectedTransitRouteId: null,
  selectedTransitRegionId: null,
  selectedTransitStationId: null,
  draftPoints: [],
  drawDefaults: getDefaultsForRoadType("residential"),
  transitColor: "#22c55e",
  transitPalette: ["#22c55e", "#2563eb", "#ef4444", "#f97316", "#a855f7"],
  sourceFileName: undefined,
  projectName: "road-designer",
  draftDefaults: null,
  dragSnapshot: null,
  past: [],
  future: [],
};

function normalizeRoad(road: Road): Road {
  const kind = road.kind ?? "standard";
  const legacyRoadType = road.roadType as RoadType | "local" | "arterial" | "tunnel";
  const roadType: RoadType =
    legacyRoadType === "local"
      ? "residential"
      : legacyRoadType === "arterial"
        ? "primary"
        : legacyRoadType === "tunnel"
          ? "residential"
          : legacyRoadType;

  return {
    ...road,
    roadType,
    geometryMode: road.geometryMode ?? "polyline",
    kind,
    isTunnel: road.isTunnel ?? legacyRoadType === "tunnel",
    startZLevel: road.startZLevel ?? road.zLevel,
    endZLevel: road.endZLevel ?? road.zLevel,
    oneWay: road.oneWay ?? false,
    oneWayDirection: road.oneWayDirection ?? "forward",
    name: road.name ?? "",
    routeClass: road.routeClass ?? "none",
    routeNumber: road.routeNumber ?? "",
    showLabel: road.showLabel ?? true,
  };
}

function normalizeTransitRoute(route: TransitRoute): TransitRoute {
  return {
    ...route,
    geometryMode: route.geometryMode ?? "polyline",
    color: route.color ?? "#22c55e",
  };
}

function normalizeTransitRegion(region: TransitRegion): TransitRegion {
  return {
    ...region,
    color: region.color ?? "#22c55e",
    name: region.name ?? "",
  };
}

function normalizeTransitStation(station: TransitStation): TransitStation {
  return {
    ...station,
    name: station.name ?? "Station",
    stationType: station.stationType ?? "transfer",
    color: station.color ?? "#22c55e",
  };
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createRoad(points: Point[], defaults: RoadDefaults, geometryMode: RoadGeometryMode): Road {
  return normalizeRoad({
    ...defaults,
    id: createId("road"),
    points,
    geometryMode,
  });
}

function createTransitRoute(points: Point[], color: string, geometryMode: RoadGeometryMode): TransitRoute {
  return normalizeTransitRoute({
    id: createId("transit"),
    points,
    geometryMode,
    color,
  });
}

function createTransitRegion(points: Point[], color: string): TransitRegion {
  return normalizeTransitRegion({
    id: createId("region"),
    points,
    color,
    name: "",
  });
}

function createTransitStation(point: Point, stationType: TransitStationType, color: string): TransitStation {
  return {
    id: createId("station"),
    point,
    name: "Station",
    stationType,
    color,
  };
}

function getSnapshot(state: RoadState): ProjectData {
  return {
    version: 1,
    roads: state.roads,
    transitRoutes: state.transitRoutes,
    transitRegions: state.transitRegions,
    transitStations: state.transitStations,
  };
}

function applyProjectWithHistory(
  state: RoadState,
  project: Pick<RoadState, "roads" | "transitRoutes" | "transitRegions" | "transitStations">,
  selection: Partial<Pick<RoadState, "selectedRoadId" | "selectedTransitRouteId" | "selectedTransitRegionId" | "selectedTransitStationId">> = {},
): RoadState {
  return {
    ...state,
    ...project,
    selectedRoadId: selection.selectedRoadId ?? state.selectedRoadId,
    selectedTransitRouteId: selection.selectedTransitRouteId ?? state.selectedTransitRouteId,
    selectedTransitRegionId: selection.selectedTransitRegionId ?? state.selectedTransitRegionId,
    selectedTransitStationId: selection.selectedTransitStationId ?? state.selectedTransitStationId,
    past: [...state.past, getSnapshot(state)],
    future: [],
  };
}

function applyRoadsWithHistory(state: RoadState, roads: Road[], selectedRoadId = state.selectedRoadId): RoadState {
  return applyProjectWithHistory(
    state,
    { roads, transitRoutes: state.transitRoutes, transitRegions: state.transitRegions, transitStations: state.transitStations },
    { selectedRoadId, selectedTransitRouteId: null, selectedTransitRegionId: null, selectedTransitStationId: null },
  );
}

function updateRoadPointInRoads(roads: Road[], roadId: string, pointIndex: number, point: Point): Road[] {
  return roads.map((road) => {
    if (road.id !== roadId) return road;
    const points = road.points.map((currentPoint, index) => (index === pointIndex ? point : currentPoint));
    return { ...road, points };
  });
}

function moveRoadInRoads(roads: Road[], roadId: string, delta: Point): Road[] {
  if (delta.x === 0 && delta.y === 0) return roads;

  return roads.map((road) => {
    if (road.id !== roadId) return road;
    return {
      ...road,
      points: road.points.map((point) => ({
        x: point.x + delta.x,
        y: point.y + delta.y,
      })),
    };
  });
}

function updateTransitRoutePoint(
  transitRoutes: TransitRoute[],
  routeId: string,
  pointIndex: number,
  point: Point,
): TransitRoute[] {
  return transitRoutes.map((route) => {
    if (route.id !== routeId) return route;
    return {
      ...route,
      points: route.points.map((currentPoint, index) => (index === pointIndex ? point : currentPoint)),
    };
  });
}

function updateTransitStationPoint(
  transitStations: TransitStation[],
  stationId: string,
  point: Point,
): TransitStation[] {
  return transitStations.map((station) => (station.id === stationId ? { ...station, point } : station));
}

function updateTransitRegionPoint(
  transitRegions: TransitRegion[],
  regionId: string,
  pointIndex: number,
  point: Point,
): TransitRegion[] {
  return transitRegions.map((region) => {
    if (region.id !== regionId) return region;
    return {
      ...region,
      points: region.points.map((currentPoint, index) => (index === pointIndex ? point : currentPoint)),
    };
  });
}

function roadReducer(state: RoadState, action: RoadAction): RoadState {
  switch (action.type) {
    case "addDraftPoint":
      return {
        ...state,
        draftPoints: [...state.draftPoints, action.point],
      };
    case "clearDraft":
      return {
        ...state,
        draftPoints: [],
        draftDefaults: null,
      };
    case "finishDraft": {
      const requiredPoints = action.geometryMode === "bezier" ? 4 : 2;
      if (state.draftPoints.length < requiredPoints) {
        return { ...state, draftPoints: [], draftDefaults: null };
      }

      const road = createRoad(
        state.draftPoints.slice(0, requiredPoints),
        state.draftDefaults ?? state.drawDefaults,
        action.geometryMode,
      );
      return applyRoadsWithHistory(
        {
          ...state,
          draftPoints: [],
          draftDefaults: null,
        },
        [...state.roads, road],
        road.id,
      );
    }
    case "finishTransitDraft": {
      const requiredPoints = action.geometryMode === "bezier" ? 4 : 2;
      if (state.draftPoints.length < requiredPoints) {
        return { ...state, draftPoints: [], draftDefaults: null };
      }

      const route = createTransitRoute(state.draftPoints.slice(0, requiredPoints), state.transitColor, action.geometryMode);
      return applyProjectWithHistory(
        {
          ...state,
          draftPoints: [],
          draftDefaults: null,
        },
        {
          roads: state.roads,
          transitRoutes: [...state.transitRoutes, route],
          transitRegions: state.transitRegions,
          transitStations: state.transitStations,
        },
        { selectedRoadId: null, selectedTransitRouteId: route.id, selectedTransitRegionId: null, selectedTransitStationId: null },
      );
    }
    case "finishTransitRegion": {
      if (state.draftPoints.length < 3) {
        return { ...state, draftPoints: [], draftDefaults: null };
      }

      const region = createTransitRegion(state.draftPoints.slice(0, 10), state.transitColor);
      return applyProjectWithHistory(
        {
          ...state,
          draftPoints: [],
          draftDefaults: null,
        },
        {
          roads: state.roads,
          transitRoutes: state.transitRoutes,
          transitRegions: [...state.transitRegions, region],
          transitStations: state.transitStations,
        },
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitRegionId: region.id, selectedTransitStationId: null },
      );
    }
    case "addTransitStation": {
      const station = createTransitStation(action.point, action.stationType, state.transitColor);
      return applyProjectWithHistory(
        state,
        {
          roads: state.roads,
          transitRoutes: state.transitRoutes,
          transitRegions: state.transitRegions,
          transitStations: [...state.transitStations, station],
        },
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitRegionId: null, selectedTransitStationId: station.id },
      );
    }
    case "selectRoad":
      return {
        ...state,
        selectedRoadId: action.roadId,
        selectedTransitRouteId: null,
        selectedTransitRegionId: null,
        selectedTransitStationId: null,
      };
    case "selectTransitRoute":
      return {
        ...state,
        selectedRoadId: null,
        selectedTransitRouteId: action.routeId,
        selectedTransitRegionId: null,
        selectedTransitStationId: null,
      };
    case "selectTransitRegion":
      return {
        ...state,
        selectedRoadId: null,
        selectedTransitRouteId: null,
        selectedTransitRegionId: action.regionId,
        selectedTransitStationId: null,
      };
    case "selectTransitStation":
      return {
        ...state,
        selectedRoadId: null,
        selectedTransitRouteId: null,
        selectedTransitRegionId: null,
        selectedTransitStationId: action.stationId,
      };
    case "updateRoad": {
      const roads = state.roads.map((road) => (road.id === action.roadId ? { ...road, ...action.patch } : road));
      return applyRoadsWithHistory(state, roads);
    }
    case "updateTransitStation": {
      const transitStations = state.transitStations.map((station) =>
        station.id === action.stationId ? { ...station, ...action.patch } : station,
      );
      return applyProjectWithHistory(state, {
        roads: state.roads,
        transitRoutes: state.transitRoutes,
        transitRegions: state.transitRegions,
        transitStations,
      });
    }
    case "updateTransitRegion": {
      const transitRegions = state.transitRegions.map((region) =>
        region.id === action.regionId ? normalizeTransitRegion({ ...region, ...action.patch }) : region,
      );
      return applyProjectWithHistory(state, {
        roads: state.roads,
        transitRoutes: state.transitRoutes,
        transitRegions,
        transitStations: state.transitStations,
      });
    }
    case "updateRoadPoint": {
      return applyRoadsWithHistory(
        state,
        updateRoadPointInRoads(state.roads, action.roadId, action.pointIndex, action.point),
      );
    }
    case "previewTransitRoutePointDrag":
      return {
        ...state,
        transitRoutes: updateTransitRoutePoint(state.transitRoutes, action.routeId, action.pointIndex, action.point),
      };
    case "endTransitRoutePointDrag": {
      const transitRoutes = updateTransitRoutePoint(state.transitRoutes, action.routeId, action.pointIndex, action.point);
      if (!state.dragSnapshot) {
        return applyProjectWithHistory(state, {
          roads: state.roads,
          transitRoutes,
          transitRegions: state.transitRegions,
          transitStations: state.transitStations,
        });
      }

      return {
        ...state,
        transitRoutes,
        dragSnapshot: null,
        past: [...state.past, state.dragSnapshot],
        future: [],
      };
    }
    case "previewTransitRegionPointDrag":
      return {
        ...state,
        transitRegions: updateTransitRegionPoint(state.transitRegions, action.regionId, action.pointIndex, action.point),
      };
    case "endTransitRegionPointDrag": {
      const transitRegions = updateTransitRegionPoint(
        state.transitRegions,
        action.regionId,
        action.pointIndex,
        action.point,
      );
      if (!state.dragSnapshot) {
        return applyProjectWithHistory(state, {
          roads: state.roads,
          transitRoutes: state.transitRoutes,
          transitRegions,
          transitStations: state.transitStations,
        });
      }

      return {
        ...state,
        transitRegions,
        dragSnapshot: null,
        past: [...state.past, state.dragSnapshot],
        future: [],
      };
    }
    case "previewTransitStationDrag":
      return {
        ...state,
        transitStations: updateTransitStationPoint(state.transitStations, action.stationId, action.point),
      };
    case "endTransitStationDrag": {
      const transitStations = updateTransitStationPoint(state.transitStations, action.stationId, action.point);
      if (!state.dragSnapshot) {
        return applyProjectWithHistory(state, {
          roads: state.roads,
          transitRoutes: state.transitRoutes,
          transitRegions: state.transitRegions,
          transitStations,
        });
      }

      return {
        ...state,
        transitStations,
        dragSnapshot: null,
        past: [...state.past, state.dragSnapshot],
        future: [],
      };
    }
    case "beginRoadPointDrag":
      return {
        ...state,
        dragSnapshot: state.dragSnapshot ?? getSnapshot(state),
      };
    case "previewRoadPointDrag":
      return {
        ...state,
        roads: updateRoadPointInRoads(state.roads, action.roadId, action.pointIndex, action.point),
      };
    case "endRoadPointDrag": {
      const roads = updateRoadPointInRoads(state.roads, action.roadId, action.pointIndex, action.point);
      if (!state.dragSnapshot) {
        return applyRoadsWithHistory(state, roads);
      }

      return {
        ...state,
        roads,
        dragSnapshot: null,
        past: [...state.past, state.dragSnapshot],
        future: [],
      };
    }
    case "previewRoadDrag":
      return {
        ...state,
        roads: moveRoadInRoads(state.roads, action.roadId, action.delta),
      };
    case "endRoadDrag": {
      const roads = moveRoadInRoads(state.roads, action.roadId, action.delta);
      if (!state.dragSnapshot) {
        return applyRoadsWithHistory(state, roads);
      }

      return {
        ...state,
        roads,
        dragSnapshot: null,
        past: [...state.past, state.dragSnapshot],
        future: [],
      };
    }
    case "deleteRoad": {
      const roads = state.roads.filter((road) => road.id !== action.roadId);
      return applyRoadsWithHistory(state, roads, null);
    }
    case "deleteTransitRoute": {
      return applyProjectWithHistory(
        state,
        {
          roads: state.roads,
          transitRoutes: state.transitRoutes.filter((route) => route.id !== action.routeId),
          transitRegions: state.transitRegions,
          transitStations: state.transitStations,
        },
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitRegionId: null, selectedTransitStationId: null },
      );
    }
    case "deleteTransitRegion": {
      return applyProjectWithHistory(
        state,
        {
          roads: state.roads,
          transitRoutes: state.transitRoutes,
          transitRegions: state.transitRegions.filter((region) => region.id !== action.regionId),
          transitStations: state.transitStations,
        },
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitRegionId: null, selectedTransitStationId: null },
      );
    }
    case "deleteTransitStation": {
      return applyProjectWithHistory(
        state,
        {
          roads: state.roads,
          transitRoutes: state.transitRoutes,
          transitRegions: state.transitRegions,
          transitStations: state.transitStations.filter((station) => station.id !== action.stationId),
        },
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitRegionId: null, selectedTransitStationId: null },
      );
    }
    case "splitRoad": {
      const road = state.roads.find((currentRoad) => currentRoad.id === action.roadId);
      if (!road) return state;

      const split = splitPathAtHit(road.points, road.geometryMode, action.hit);
      if (!split) return state;

      const firstRoad = normalizeRoad({
        ...road,
        id: createId("road"),
        points: split.startPoints,
        geometryMode: split.geometryMode,
      });
      const secondRoad = normalizeRoad({
        ...road,
        id: createId("road"),
        points: split.endPoints,
        geometryMode: split.geometryMode,
      });
      const roads = state.roads.flatMap((currentRoad) =>
        currentRoad.id === road.id ? [firstRoad, secondRoad] : [currentRoad],
      );

      return applyProjectWithHistory(
        state,
        {
          roads,
          transitRoutes: state.transitRoutes,
          transitRegions: state.transitRegions,
          transitStations: state.transitStations,
        },
        { selectedRoadId: firstRoad.id, selectedTransitRouteId: null, selectedTransitRegionId: null, selectedTransitStationId: null },
      );
    }
    case "splitTransitRoute": {
      const route = state.transitRoutes.find((currentRoute) => currentRoute.id === action.routeId);
      if (!route) return state;

      const split = splitPathAtHit(route.points, route.geometryMode, action.hit);
      if (!split) return state;

      const firstRoute = normalizeTransitRoute({
        ...route,
        id: createId("transit"),
        points: split.startPoints,
        geometryMode: split.geometryMode,
      });
      const secondRoute = normalizeTransitRoute({
        ...route,
        id: createId("transit"),
        points: split.endPoints,
        geometryMode: split.geometryMode,
      });
      const transitRoutes = state.transitRoutes.flatMap((currentRoute) =>
        currentRoute.id === route.id ? [firstRoute, secondRoute] : [currentRoute],
      );

      return applyProjectWithHistory(
        state,
        {
          roads: state.roads,
          transitRoutes,
          transitRegions: state.transitRegions,
          transitStations: state.transitStations,
        },
        { selectedRoadId: null, selectedTransitRouteId: firstRoute.id, selectedTransitRegionId: null, selectedTransitStationId: null },
      );
    }
    case "setDrawType":
      return {
        ...state,
        drawDefaults: {
          ...state.drawDefaults,
          roadType: action.roadType,
          width: getRoadPresetWidth(action.roadType, state.drawDefaults.lanes),
          name: DEFAULT_ROAD_BY_TYPE[action.roadType].name,
          routeClass: DEFAULT_ROAD_BY_TYPE[action.roadType].routeClass,
          routeNumber: DEFAULT_ROAD_BY_TYPE[action.roadType].routeNumber,
          showLabel: DEFAULT_ROAD_BY_TYPE[action.roadType].showLabel,
        },
        draftDefaults: null,
      };
    case "setDrawTunnel":
      return {
        ...state,
        drawDefaults: {
          ...state.drawDefaults,
          isTunnel: action.isTunnel,
        },
        draftDefaults: null,
      };
    case "setDrawPreset":
      return {
        ...state,
        drawDefaults: action.defaults,
        draftDefaults: null,
      };
    case "setTransitColor":
      return {
        ...state,
        transitColor: action.color,
      };
    case "addTransitColor": {
      const color = action.color.trim();
      if (!color) return state;
      return {
        ...state,
        transitColor: color,
        transitPalette: Array.from(new Set([...state.transitPalette, color])),
      };
    }
    case "adoptRoadDefaults": {
      const sourceRoad = state.roads.find((road) => road.id === action.roadId);
      if (!sourceRoad) return state;

      return {
        ...state,
        draftDefaults: {
          roadType: sourceRoad.roadType,
          width: sourceRoad.width,
          lanes: sourceRoad.lanes,
          divider: sourceRoad.divider,
          isTunnel: sourceRoad.isTunnel ?? false,
          zLevel: sourceRoad.zLevel,
          kind: sourceRoad.kind ?? "standard",
          startZLevel: sourceRoad.startZLevel ?? sourceRoad.zLevel,
          endZLevel: sourceRoad.endZLevel ?? sourceRoad.zLevel,
          oneWay: sourceRoad.oneWay ?? false,
          oneWayDirection: sourceRoad.oneWayDirection ?? "forward",
          name: sourceRoad.name ?? "",
          routeClass: sourceRoad.routeClass ?? "none",
          routeNumber: sourceRoad.routeNumber ?? "",
          showLabel: sourceRoad.showLabel ?? true,
        },
      };
    }
    case "loadProject":
      return applyProjectWithHistory(
        {
          ...state,
          sourceFileName: action.sourceFileName ?? state.sourceFileName,
          projectName: action.sourceFileName ? getProjectNameFromFileName(action.sourceFileName) : state.projectName,
          draftPoints: [],
          draftDefaults: null,
        },
        {
          roads: action.project.roads.map(normalizeRoad),
          transitRoutes: (action.project.transitRoutes ?? []).map(normalizeTransitRoute),
          transitRegions: (action.project.transitRegions ?? []).map(normalizeTransitRegion),
          transitStations: (action.project.transitStations ?? []).map(normalizeTransitStation),
        },
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitRegionId: null, selectedTransitStationId: null },
      );
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        roads: previous.roads.map(normalizeRoad),
        transitRoutes: (previous.transitRoutes ?? []).map(normalizeTransitRoute),
        transitRegions: (previous.transitRegions ?? []).map(normalizeTransitRegion),
        transitStations: (previous.transitStations ?? []).map(normalizeTransitStation),
        selectedRoadId: null,
        selectedTransitRouteId: null,
        selectedTransitRegionId: null,
        selectedTransitStationId: null,
        draftPoints: [],
        draftDefaults: null,
        dragSnapshot: null,
        past: state.past.slice(0, -1),
        future: [getSnapshot(state), ...state.future],
      };
    }
    case "redo": {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        roads: next.roads.map(normalizeRoad),
        transitRoutes: (next.transitRoutes ?? []).map(normalizeTransitRoute),
        transitRegions: (next.transitRegions ?? []).map(normalizeTransitRegion),
        transitStations: (next.transitStations ?? []).map(normalizeTransitStation),
        selectedRoadId: null,
        selectedTransitRouteId: null,
        selectedTransitRegionId: null,
        selectedTransitStationId: null,
        draftPoints: [],
        draftDefaults: null,
        dragSnapshot: null,
        past: [...state.past, getSnapshot(state)],
        future: state.future.slice(1),
      };
    }
    default:
      return state;
  }
}

export function useRoadStore() {
  const [state, dispatch] = useReducer(roadReducer, initialState);

  const selectedRoad = useMemo(
    () => state.roads.find((road) => road.id === state.selectedRoadId) ?? null,
    [state.roads, state.selectedRoadId],
  );

  const selectedTransitStation = useMemo(
    () => state.transitStations.find((station) => station.id === state.selectedTransitStationId) ?? null,
    [state.transitStations, state.selectedTransitStationId],
  );

  const selectedTransitRegion = useMemo(
    () => state.transitRegions.find((region) => region.id === state.selectedTransitRegionId) ?? null,
    [state.transitRegions, state.selectedTransitRegionId],
  );

  const projectData = useMemo<ProjectData>(
    () => ({
      version: 1,
      roads: state.roads,
      transitRoutes: state.transitRoutes,
      transitRegions: state.transitRegions,
      transitStations: state.transitStations,
    }),
    [state.roads, state.transitRoutes, state.transitRegions, state.transitStations],
  );

  const addDraftPoint = useCallback((point: Point) => dispatch({ type: "addDraftPoint", point }), []);
  const clearDraft = useCallback(() => dispatch({ type: "clearDraft" }), []);
  const finishDraft = useCallback(
    (geometryMode: RoadGeometryMode = "polyline") => dispatch({ type: "finishDraft", geometryMode }),
    [],
  );
  const finishTransitDraft = useCallback(
    (geometryMode: RoadGeometryMode = "polyline") => dispatch({ type: "finishTransitDraft", geometryMode }),
    [],
  );
  const finishTransitRegion = useCallback(() => dispatch({ type: "finishTransitRegion" }), []);
  const addTransitStation = useCallback(
    (point: Point, stationType: TransitStationType) => dispatch({ type: "addTransitStation", point, stationType }),
    [],
  );
  const selectRoad = useCallback((roadId: string | null) => dispatch({ type: "selectRoad", roadId }), []);
  const selectTransitRoute = useCallback(
    (routeId: string | null) => dispatch({ type: "selectTransitRoute", routeId }),
    [],
  );
  const selectTransitRegion = useCallback(
    (regionId: string | null) => dispatch({ type: "selectTransitRegion", regionId }),
    [],
  );
  const selectTransitStation = useCallback(
    (stationId: string | null) => dispatch({ type: "selectTransitStation", stationId }),
    [],
  );
  const setDrawType = useCallback((roadType: RoadType) => dispatch({ type: "setDrawType", roadType }), []);
  const setDrawTunnel = useCallback(
    (isTunnel: boolean) => dispatch({ type: "setDrawTunnel", isTunnel }),
    [],
  );
  const setDrawPreset = useCallback(
    (defaults: RoadDefaults) => dispatch({ type: "setDrawPreset", defaults }),
    [],
  );
  const adoptRoadDefaults = useCallback((roadId: string) => dispatch({ type: "adoptRoadDefaults", roadId }), []);
  const loadProject = useCallback(
    (project: ProjectData, sourceFileName?: string) => dispatch({ type: "loadProject", project, sourceFileName }),
    [],
  );
  const deleteRoad = useCallback((roadId: string) => dispatch({ type: "deleteRoad", roadId }), []);
  const deleteTransitRoute = useCallback((routeId: string) => dispatch({ type: "deleteTransitRoute", routeId }), []);
  const deleteTransitRegion = useCallback(
    (regionId: string) => dispatch({ type: "deleteTransitRegion", regionId }),
    [],
  );
  const deleteTransitStation = useCallback(
    (stationId: string) => dispatch({ type: "deleteTransitStation", stationId }),
    [],
  );
  const splitRoad = useCallback((roadId: string, hit: BladeHit) => dispatch({ type: "splitRoad", roadId, hit }), []);
  const splitTransitRoute = useCallback(
    (routeId: string, hit: BladeHit) => dispatch({ type: "splitTransitRoute", routeId, hit }),
    [],
  );
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const updateRoad = useCallback(
    (roadId: string, patch: Partial<Omit<Road, "id">>) => dispatch({ type: "updateRoad", roadId, patch }),
    [],
  );
  const updateTransitStation = useCallback(
    (stationId: string, patch: Partial<Omit<TransitStation, "id">>) =>
      dispatch({ type: "updateTransitStation", stationId, patch }),
    [],
  );
  const updateTransitRegion = useCallback(
    (regionId: string, patch: Partial<Omit<TransitRegion, "id">>) =>
      dispatch({ type: "updateTransitRegion", regionId, patch }),
    [],
  );
  const updateRoadPoint = useCallback(
    (roadId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "updateRoadPoint", roadId, pointIndex, point }),
    [],
  );
  const beginRoadPointDrag = useCallback(() => dispatch({ type: "beginRoadPointDrag" }), []);
  const previewRoadPointDrag = useCallback(
    (roadId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "previewRoadPointDrag", roadId, pointIndex, point }),
    [],
  );
  const endRoadPointDrag = useCallback(
    (roadId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "endRoadPointDrag", roadId, pointIndex, point }),
    [],
  );
  const previewRoadDrag = useCallback(
    (roadId: string, delta: Point) => dispatch({ type: "previewRoadDrag", roadId, delta }),
    [],
  );
  const endRoadDrag = useCallback(
    (roadId: string, delta: Point) => dispatch({ type: "endRoadDrag", roadId, delta }),
    [],
  );
  const previewTransitRoutePointDrag = useCallback(
    (routeId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "previewTransitRoutePointDrag", routeId, pointIndex, point }),
    [],
  );
  const endTransitRoutePointDrag = useCallback(
    (routeId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "endTransitRoutePointDrag", routeId, pointIndex, point }),
    [],
  );
  const previewTransitRegionPointDrag = useCallback(
    (regionId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "previewTransitRegionPointDrag", regionId, pointIndex, point }),
    [],
  );
  const endTransitRegionPointDrag = useCallback(
    (regionId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "endTransitRegionPointDrag", regionId, pointIndex, point }),
    [],
  );
  const previewTransitStationDrag = useCallback(
    (stationId: string, point: Point) => dispatch({ type: "previewTransitStationDrag", stationId, point }),
    [],
  );
  const endTransitStationDrag = useCallback(
    (stationId: string, point: Point) => dispatch({ type: "endTransitStationDrag", stationId, point }),
    [],
  );

  return {
    ...state,
    selectedRoad,
    selectedTransitStation,
    selectedTransitRegion,
    projectData,
    addDraftPoint,
    clearDraft,
    finishDraft,
    finishTransitDraft,
    finishTransitRegion,
    addTransitStation,
    selectRoad,
    selectTransitRoute,
    selectTransitRegion,
    selectTransitStation,
    setDrawType,
    setDrawTunnel,
    setDrawPreset,
    adoptRoadDefaults,
    loadProject,
    deleteRoad,
    deleteTransitRoute,
    deleteTransitRegion,
    deleteTransitStation,
    splitRoad,
    splitTransitRoute,
    undo,
    redo,
    updateRoad,
    updateTransitRegion,
    updateTransitStation,
    updateRoadPoint,
    beginRoadPointDrag,
    previewRoadPointDrag,
    endRoadPointDrag,
    previewRoadDrag,
    endRoadDrag,
    previewTransitRoutePointDrag,
    endTransitRoutePointDrag,
    previewTransitRegionPointDrag,
    endTransitRegionPointDrag,
    previewTransitStationDrag,
    endTransitStationDrag,
    setTransitColor: (color: string) => dispatch({ type: "setTransitColor", color }),
    addTransitColor: (color: string) => dispatch({ type: "addTransitColor", color }),
  };
}
