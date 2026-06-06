import { useCallback, useMemo, useReducer } from "react";
import type { Point, ProjectData, Road, RoadDefaults, RoadGeometryMode, RoadType } from "../types/road";
import { getDefaultsForRoadType } from "../utils/roadStyle";

type RoadState = {
  roads: Road[];
  selectedRoadId: string | null;
  draftPoints: Point[];
  drawDefaults: RoadDefaults;
};

type RoadAction =
  | { type: "addDraftPoint"; point: Point }
  | { type: "clearDraft" }
  | { type: "finishDraft"; geometryMode: RoadGeometryMode }
  | { type: "selectRoad"; roadId: string | null }
  | { type: "updateRoad"; roadId: string; patch: Partial<Omit<Road, "id">> }
  | { type: "updateRoadPoint"; roadId: string; pointIndex: number; point: Point }
  | { type: "setDrawType"; roadType: RoadType }
  | { type: "loadProject"; project: ProjectData };

const initialState: RoadState = {
  roads: [],
  selectedRoadId: null,
  draftPoints: [],
  drawDefaults: getDefaultsForRoadType("local"),
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
      return {
        ...state,
        roads: [...state.roads, road],
        selectedRoadId: road.id,
        draftPoints: [],
      };
    }
    case "selectRoad":
      return {
        ...state,
        selectedRoadId: action.roadId,
      };
    case "updateRoad":
      return {
        ...state,
        roads: state.roads.map((road) =>
          road.id === action.roadId ? { ...road, ...action.patch } : road,
        ),
      };
    case "updateRoadPoint":
      return {
        ...state,
        roads: state.roads.map((road) => {
          if (road.id !== action.roadId) return road;
          const points = road.points.map((point, index) =>
            index === action.pointIndex ? action.point : point,
          );
          return { ...road, points };
        }),
      };
    case "setDrawType":
      return {
        ...state,
        drawDefaults: getDefaultsForRoadType(action.roadType),
      };
    case "loadProject":
      return {
        ...state,
        roads: action.project.roads.map(normalizeRoad),
        selectedRoadId: null,
        draftPoints: [],
      };
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
  const loadProject = useCallback((project: ProjectData) => dispatch({ type: "loadProject", project }), []);
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
    loadProject,
    updateRoad,
    updateRoadPoint,
  };
}
