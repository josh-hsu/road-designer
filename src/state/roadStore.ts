import { useCallback, useMemo, useReducer } from "react";
import type { Point, ProjectData, Road, RoadDefaults, RoadGeometryMode, RoadType } from "../types/road";
import { getDefaultsForRoadType } from "../utils/roadStyle";

type RoadState = {
  roads: Road[];
  selectedRoadId: string | null;
  draftPoints: Point[];
  drawDefaults: RoadDefaults;
  past: ProjectData[];
  future: ProjectData[];
};

type RoadAction =
  | { type: "addDraftPoint"; point: Point }
  | { type: "clearDraft" }
  | { type: "finishDraft"; geometryMode: RoadGeometryMode }
  | { type: "selectRoad"; roadId: string | null }
  | { type: "updateRoad"; roadId: string; patch: Partial<Omit<Road, "id">> }
  | { type: "updateRoadPoint"; roadId: string; pointIndex: number; point: Point }
  | { type: "deleteRoad"; roadId: string }
  | { type: "setDrawType"; roadType: RoadType }
  | { type: "adoptRoadDefaults"; roadId: string }
  | { type: "loadProject"; project: ProjectData }
  | { type: "undo" }
  | { type: "redo" };

const initialState: RoadState = {
  roads: [],
  selectedRoadId: null,
  draftPoints: [],
  drawDefaults: getDefaultsForRoadType("local"),
  past: [],
  future: [],
};

function normalizeRoad(road: Road): Road {
  return {
    ...road,
    geometryMode: road.geometryMode ?? "polyline",
  };
}

function createRoad(points: Point[], defaults: RoadDefaults, geometryMode: RoadGeometryMode): Road {
  return {
    id: `road-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    points,
    geometryMode,
    ...defaults,
  };
}

function getSnapshot(state: RoadState): ProjectData {
  return {
    version: 1,
    roads: state.roads,
  };
}

function applyRoadsWithHistory(state: RoadState, roads: Road[], selectedRoadId = state.selectedRoadId): RoadState {
  return {
    ...state,
    roads,
    selectedRoadId,
    past: [...state.past, getSnapshot(state)],
    future: [],
  };
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
      };
    case "finishDraft": {
      const requiredPoints = action.geometryMode === "bezier" ? 4 : 2;
      if (state.draftPoints.length < requiredPoints) {
        return { ...state, draftPoints: [] };
      }

      const road = createRoad(state.draftPoints.slice(0, requiredPoints), state.drawDefaults, action.geometryMode);
      return applyRoadsWithHistory(
        {
          ...state,
          draftPoints: [],
        },
        [...state.roads, road],
        road.id,
      );
    }
    case "selectRoad":
      return {
        ...state,
        selectedRoadId: action.roadId,
      };
    case "updateRoad": {
      const roads = state.roads.map((road) => (road.id === action.roadId ? { ...road, ...action.patch } : road));
      return applyRoadsWithHistory(state, roads);
    }
    case "updateRoadPoint": {
      const roads = state.roads.map((road) => {
        if (road.id !== action.roadId) return road;
        const points = road.points.map((point, index) =>
          index === action.pointIndex ? action.point : point,
        );
        return { ...road, points };
      });
      return applyRoadsWithHistory(state, roads);
    }
    case "deleteRoad": {
      const roads = state.roads.filter((road) => road.id !== action.roadId);
      return applyRoadsWithHistory(state, roads, null);
    }
    case "setDrawType":
      return {
        ...state,
        drawDefaults: getDefaultsForRoadType(action.roadType),
      };
    case "adoptRoadDefaults": {
      const sourceRoad = state.roads.find((road) => road.id === action.roadId);
      if (!sourceRoad) return state;

      return {
        ...state,
        drawDefaults: {
          roadType: sourceRoad.roadType,
          width: sourceRoad.width,
          lanes: sourceRoad.lanes,
          divider: sourceRoad.divider,
          zLevel: sourceRoad.zLevel,
        },
      };
    }
    case "loadProject":
      return applyRoadsWithHistory(
        {
          ...state,
          draftPoints: [],
        },
        action.project.roads.map(normalizeRoad),
        null,
      );
    case "undo": {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        roads: previous.roads.map(normalizeRoad),
        selectedRoadId: null,
        draftPoints: [],
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
        selectedRoadId: null,
        draftPoints: [],
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

  const projectData = useMemo<ProjectData>(
    () => ({
      version: 1,
      roads: state.roads,
    }),
    [state.roads],
  );

  const addDraftPoint = useCallback((point: Point) => dispatch({ type: "addDraftPoint", point }), []);
  const clearDraft = useCallback(() => dispatch({ type: "clearDraft" }), []);
  const finishDraft = useCallback(
    (geometryMode: RoadGeometryMode = "polyline") => dispatch({ type: "finishDraft", geometryMode }),
    [],
  );
  const selectRoad = useCallback((roadId: string | null) => dispatch({ type: "selectRoad", roadId }), []);
  const setDrawType = useCallback((roadType: RoadType) => dispatch({ type: "setDrawType", roadType }), []);
  const adoptRoadDefaults = useCallback((roadId: string) => dispatch({ type: "adoptRoadDefaults", roadId }), []);
  const loadProject = useCallback((project: ProjectData) => dispatch({ type: "loadProject", project }), []);
  const deleteRoad = useCallback((roadId: string) => dispatch({ type: "deleteRoad", roadId }), []);
  const undo = useCallback(() => dispatch({ type: "undo" }), []);
  const redo = useCallback(() => dispatch({ type: "redo" }), []);
  const updateRoad = useCallback(
    (roadId: string, patch: Partial<Omit<Road, "id">>) => dispatch({ type: "updateRoad", roadId, patch }),
    [],
  );
  const updateRoadPoint = useCallback(
    (roadId: string, pointIndex: number, point: Point) =>
      dispatch({ type: "updateRoadPoint", roadId, pointIndex, point }),
    [],
  );

  return {
    ...state,
    selectedRoad,
    projectData,
    addDraftPoint,
    clearDraft,
    finishDraft,
    selectRoad,
    setDrawType,
    adoptRoadDefaults,
    loadProject,
    deleteRoad,
    undo,
    redo,
    updateRoad,
    updateRoadPoint,
  };
}
