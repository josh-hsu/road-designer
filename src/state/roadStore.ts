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
import { DEFAULT_ROAD_BY_TYPE, getDefaultsForRoadType } from "../utils/roadStyle";

type RoadState = {
  roads: Road[];
  transitRoutes: TransitRoute[];
  transitRegions: TransitRegion[];
  transitStations: TransitStation[];
  selectedRoadId: string | null;
  selectedTransitRouteId: string | null;
  selectedTransitStationId: string | null;
  draftPoints: Point[];
  drawDefaults: RoadDefaults;
  transitColor: string;
  transitPalette: string[];
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
  | { type: "selectTransitStation"; stationId: string | null }
  | { type: "updateRoad"; roadId: string; patch: Partial<Omit<Road, "id">> }
  | { type: "updateTransitStation"; stationId: string; patch: Partial<Omit<TransitStation, "id">> }
  | { type: "updateRoadPoint"; roadId: string; pointIndex: number; point: Point }
  | { type: "previewTransitRoutePointDrag"; routeId: string; pointIndex: number; point: Point }
  | { type: "endTransitRoutePointDrag"; routeId: string; pointIndex: number; point: Point }
  | { type: "previewTransitStationDrag"; stationId: string; point: Point }
  | { type: "endTransitStationDrag"; stationId: string; point: Point }
  | { type: "beginRoadPointDrag" }
  | { type: "previewRoadPointDrag"; roadId: string; pointIndex: number; point: Point }
  | { type: "endRoadPointDrag"; roadId: string; pointIndex: number; point: Point }
  | { type: "deleteRoad"; roadId: string }
  | { type: "deleteTransitRoute"; routeId: string }
  | { type: "deleteTransitStation"; stationId: string }
  | { type: "splitRoad"; roadId: string; hit: BladeHit }
  | { type: "splitTransitRoute"; routeId: string; hit: BladeHit }
  | { type: "setDrawType"; roadType: RoadType }
  | { type: "setDrawPreset"; defaults: RoadDefaults }
  | { type: "setTransitColor"; color: string }
  | { type: "addTransitColor"; color: string }
  | { type: "adoptRoadDefaults"; roadId: string }
  | { type: "loadProject"; project: ProjectData }
  | { type: "undo" }
  | { type: "redo" };

const initialState: RoadState = {
  roads: [],
  transitRoutes: [],
  transitRegions: [],
  transitStations: [],
  selectedRoadId: null,
  selectedTransitRouteId: null,
  selectedTransitStationId: null,
  draftPoints: [],
  drawDefaults: getDefaultsForRoadType("local"),
  transitColor: "#22c55e",
  transitPalette: ["#22c55e", "#2563eb", "#ef4444", "#f97316", "#a855f7"],
  draftDefaults: null,
  dragSnapshot: null,
  past: [],
  future: [],
};

function normalizeRoad(road: Road): Road {
  const kind = road.kind ?? "standard";

  return {
    ...road,
    geometryMode: road.geometryMode ?? "polyline",
    kind,
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
  selection: Partial<Pick<RoadState, "selectedRoadId" | "selectedTransitRouteId" | "selectedTransitStationId">> = {},
): RoadState {
  return {
    ...state,
    ...project,
    selectedRoadId: selection.selectedRoadId ?? state.selectedRoadId,
    selectedTransitRouteId: selection.selectedTransitRouteId ?? state.selectedTransitRouteId,
    selectedTransitStationId: selection.selectedTransitStationId ?? state.selectedTransitStationId,
    past: [...state.past, getSnapshot(state)],
    future: [],
  };
}

function applyRoadsWithHistory(state: RoadState, roads: Road[], selectedRoadId = state.selectedRoadId): RoadState {
  return applyProjectWithHistory(
    state,
    { roads, transitRoutes: state.transitRoutes, transitRegions: state.transitRegions, transitStations: state.transitStations },
    { selectedRoadId, selectedTransitRouteId: null, selectedTransitStationId: null },
  );
}

function updateRoadPointInRoads(roads: Road[], roadId: string, pointIndex: number, point: Point): Road[] {
  return roads.map((road) => {
    if (road.id !== roadId) return road;
    const points = road.points.map((currentPoint, index) => (index === pointIndex ? point : currentPoint));
    return { ...road, points };
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
        { selectedRoadId: null, selectedTransitRouteId: route.id, selectedTransitStationId: null },
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
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitStationId: null },
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
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitStationId: station.id },
      );
    }
    case "selectRoad":
      return {
        ...state,
        selectedRoadId: action.roadId,
        selectedTransitRouteId: null,
        selectedTransitStationId: null,
      };
    case "selectTransitRoute":
      return {
        ...state,
        selectedRoadId: null,
        selectedTransitRouteId: action.routeId,
        selectedTransitStationId: null,
      };
    case "selectTransitStation":
      return {
        ...state,
        selectedRoadId: null,
        selectedTransitRouteId: null,
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
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitStationId: null },
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
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitStationId: null },
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
        { selectedRoadId: firstRoad.id, selectedTransitRouteId: null, selectedTransitStationId: null },
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
        { selectedRoadId: null, selectedTransitRouteId: firstRoute.id, selectedTransitStationId: null },
      );
    }
    case "setDrawType":
      return {
        ...state,
        drawDefaults: {
          ...state.drawDefaults,
          roadType: action.roadType,
          name: DEFAULT_ROAD_BY_TYPE[action.roadType].name,
          routeClass: DEFAULT_ROAD_BY_TYPE[action.roadType].routeClass,
          routeNumber: DEFAULT_ROAD_BY_TYPE[action.roadType].routeNumber,
          showLabel: DEFAULT_ROAD_BY_TYPE[action.roadType].showLabel,
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
          draftPoints: [],
          draftDefaults: null,
        },
        {
          roads: action.project.roads.map(normalizeRoad),
          transitRoutes: (action.project.transitRoutes ?? []).map(normalizeTransitRoute),
          transitRegions: (action.project.transitRegions ?? []).map(normalizeTransitRegion),
          transitStations: (action.project.transitStations ?? []).map(normalizeTransitStation),
        },
        { selectedRoadId: null, selectedTransitRouteId: null, selectedTransitStationId: null },
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
  const selectTransitStation = useCallback(
    (stationId: string | null) => dispatch({ type: "selectTransitStation", stationId }),
    [],
  );
  const setDrawType = useCallback((roadType: RoadType) => dispatch({ type: "setDrawType", roadType }), []);
  const setDrawPreset = useCallback(
    (defaults: RoadDefaults) => dispatch({ type: "setDrawPreset", defaults }),
    [],
  );
  const adoptRoadDefaults = useCallback((roadId: string) => dispatch({ type: "adoptRoadDefaults", roadId }), []);
  const loadProject = useCallback((project: ProjectData) => dispatch({ type: "loadProject", project }), []);
  const deleteRoad = useCallback((roadId: string) => dispatch({ type: "deleteRoad", roadId }), []);
  const deleteTransitRoute = useCallback((routeId: string) => dispatch({ type: "deleteTransitRoute", routeId }), []);
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
    projectData,
    addDraftPoint,
    clearDraft,
    finishDraft,
    finishTransitDraft,
    finishTransitRegion,
    addTransitStation,
    selectRoad,
    selectTransitRoute,
    selectTransitStation,
    setDrawType,
    setDrawPreset,
    adoptRoadDefaults,
    loadProject,
    deleteRoad,
    deleteTransitRoute,
    deleteTransitStation,
    splitRoad,
    splitTransitRoute,
    undo,
    redo,
    updateRoad,
    updateTransitStation,
    updateRoadPoint,
    beginRoadPointDrag,
    previewRoadPointDrag,
    endRoadPointDrag,
    previewTransitRoutePointDrag,
    endTransitRoutePointDrag,
    previewTransitStationDrag,
    endTransitStationDrag,
    setTransitColor: (color: string) => dispatch({ type: "setTransitColor", color }),
    addTransitColor: (color: string) => dispatch({ type: "addTransitColor", color }),
  };
}
