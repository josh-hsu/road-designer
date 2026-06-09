import { useEffect, useRef, useState } from "react";
import { CanvasEditor } from "./components/CanvasEditor";
import { RoadPropertiesPanel } from "./components/RoadPropertiesPanel";
import { Toolbar } from "./components/Toolbar";
import { useRoadStore } from "./state/roadStore";
import type { RoadGeometryMode, ToolMode } from "./types/road";
import { exportProjectData, importProjectDataFromFile, importProjectDataWithDialog } from "./utils/fileIO";

export default function App() {
  const [mode, setMode] = useState<ToolMode>("select");
  const [showGrid, setShowGrid] = useState(true);
  const [keepDrawing, setKeepDrawing] = useState(true);
  const [showDebugMasks, setShowDebugMasks] = useState(false);
  const browserImportRef = useRef<HTMLInputElement | null>(null);
  const roadStore = useRoadStore();
  const {
    clearDraft,
    deleteRoad,
    deleteTransitRoute,
    deleteTransitStation,
    finishDraft,
    redo,
    selectedRoadId,
    selectedTransitRouteId,
    selectedTransitStationId,
    undo,
  } = roadStore;

  const handleModeChange = (nextMode: ToolMode) => {
    if (nextMode === "select") {
      clearDraft();
    }
    setMode(nextMode);
  };

  const handleFinishDraft = (geometryMode: RoadGeometryMode) => {
    finishDraft(geometryMode);
    if (!keepDrawing) {
      setMode("select");
    }
  };

  const handleFinishTransitDraft = (geometryMode: RoadGeometryMode) => {
    roadStore.finishTransitDraft(geometryMode);
    if (!keepDrawing) {
      setMode("select");
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditingField =
        target?.tagName === "INPUT" || target?.tagName === "SELECT" || target?.tagName === "TEXTAREA";

      if (isEditingField) return;

      const isUndo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !event.shiftKey;
      const isRedo = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && event.shiftKey;

      if (isUndo) {
        event.preventDefault();
        undo();
        return;
      }

      if (isRedo) {
        event.preventDefault();
        redo();
        return;
      }

      if (event.key === "Enter" && (mode === "draw" || mode === "drawCurve" || mode === "drawTransit" || mode === "drawTransitCurve")) {
        const geometryMode = mode === "drawCurve" || mode === "drawTransitCurve" ? "bezier" : "polyline";
        if (mode === "drawTransit" || mode === "drawTransitCurve") {
          handleFinishTransitDraft(geometryMode);
        } else {
          handleFinishDraft(geometryMode);
        }
        event.preventDefault();
      }

      if (
        event.key === "Escape" &&
        (mode === "draw" ||
          mode === "drawCurve" ||
          mode === "drawTransit" ||
          mode === "drawTransitCurve" ||
          mode === "transferStation" ||
          mode === "normalStation")
      ) {
        clearDraft();
        setMode("select");
        event.preventDefault();
      }

      if (mode === "select" && (event.key === "Delete" || event.key === "Backspace")) {
        if (selectedRoadId) {
          deleteRoad(selectedRoadId);
          event.preventDefault();
          return;
        }
        if (selectedTransitRouteId) {
          deleteTransitRoute(selectedTransitRouteId);
          event.preventDefault();
          return;
        }
        if (selectedTransitStationId) {
          deleteTransitStation(selectedTransitStationId);
          event.preventDefault();
          return;
        }
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    clearDraft,
    deleteRoad,
    deleteTransitRoute,
    deleteTransitStation,
    handleFinishDraft,
    handleFinishTransitDraft,
    mode,
    redo,
    selectedRoadId,
    selectedTransitRouteId,
    selectedTransitStationId,
    undo,
  ]);

  const handleImportClick = async () => {
    try {
      const project = await importProjectDataWithDialog();
      if (project) {
        roadStore.loadProject(project);
        return;
      }
      browserImportRef.current?.click();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import failed.");
    }
  };

  const handleBrowserImport = async (file: File) => {
    try {
      roadStore.loadProject(await importProjectDataFromFile(file));
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import failed.");
    }
  };

  const handleExport = async () => {
    try {
      await exportProjectData(roadStore.projectData);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Export failed.");
    }
  };

  return (
    <div className="app-layout">
      <Toolbar
        mode={mode}
        drawDefaults={roadStore.drawDefaults}
        showGrid={showGrid}
        keepDrawing={keepDrawing}
        showDebugMasks={showDebugMasks}
        transitColor={roadStore.transitColor}
        transitPalette={roadStore.transitPalette}
        onModeChange={handleModeChange}
        onDrawRoadTypeChange={roadStore.setDrawType}
        onDrawPresetSelect={(toolMode, preset) => {
          roadStore.setDrawPreset({
            ...roadStore.drawDefaults,
            ...preset,
          });
          setMode(toolMode);
        }}
        onShowGridChange={setShowGrid}
        onKeepDrawingChange={setKeepDrawing}
        onShowDebugMasksChange={setShowDebugMasks}
        onTransitColorChange={roadStore.setTransitColor}
        onAddTransitColor={roadStore.addTransitColor}
        onExport={handleExport}
        onImportClick={handleImportClick}
      />
      <input
        ref={browserImportRef}
        className="hidden-input"
        type="file"
        accept="application/json,.json"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (file) {
            void handleBrowserImport(file);
            event.currentTarget.value = "";
          }
        }}
      />
      <CanvasEditor
        mode={mode}
        roads={roadStore.roads}
        transitRoutes={roadStore.transitRoutes}
        transitStations={roadStore.transitStations}
        selectedRoadId={roadStore.selectedRoadId}
        selectedTransitRouteId={roadStore.selectedTransitRouteId}
        selectedTransitStationId={roadStore.selectedTransitStationId}
        draftPoints={roadStore.draftPoints}
        transitColor={roadStore.transitColor}
        showGrid={showGrid}
        showDebugMasks={showDebugMasks}
        onCanvasPoint={roadStore.addDraftPoint}
        onFinishDraft={handleFinishDraft}
        onFinishTransitDraft={handleFinishTransitDraft}
        onAddTransitStation={roadStore.addTransitStation}
        onAdoptRoadDefaults={roadStore.adoptRoadDefaults}
        onSelectRoad={roadStore.selectRoad}
        onSelectTransitRoute={roadStore.selectTransitRoute}
        onSelectTransitStation={roadStore.selectTransitStation}
        onRoadPointDragStart={roadStore.beginRoadPointDrag}
        onRoadPointDragMove={roadStore.previewRoadPointDrag}
        onRoadPointDragEnd={roadStore.endRoadPointDrag}
        onTransitRoutePointDragMove={roadStore.previewTransitRoutePointDrag}
        onTransitRoutePointDragEnd={roadStore.endTransitRoutePointDrag}
        onTransitStationDragMove={roadStore.previewTransitStationDrag}
        onTransitStationDragEnd={roadStore.endTransitStationDrag}
      />
      <RoadPropertiesPanel
        road={roadStore.selectedRoad}
        transitStation={roadStore.selectedTransitStation}
        onUpdateRoad={roadStore.updateRoad}
        onUpdateTransitStation={roadStore.updateTransitStation}
      />
    </div>
  );
}
