import { useEffect, useRef, useState } from "react";
import { CanvasEditor } from "./components/CanvasEditor";
import { RoadPropertiesPanel } from "./components/RoadPropertiesPanel";
import { Toolbar } from "./components/Toolbar";
import { useRoadStore } from "./state/roadStore";
import type { Point, RoadGeometryMode, ToolMode, TransitStationType } from "./types/road";
import { exportProjectData, importProjectDataFromFile, importProjectDataWithDialog } from "./utils/fileIO";

export default function App() {
  const [mode, setMode] = useState<ToolMode>("select");
  const [showGrid, setShowGrid] = useState(true);
  const [keepDrawing, setKeepDrawing] = useState(false);
  const [showDebugMasks, setShowDebugMasks] = useState(false);
  const [propertiesCollapsed, setPropertiesCollapsed] = useState(true);
  const browserImportRef = useRef<HTMLInputElement | null>(null);
  const roadStore = useRoadStore();
  const {
    clearDraft,
    deleteRoad,
    deleteTransitRegion,
    deleteTransitRoute,
    deleteTransitStation,
    finishDraft,
    redo,
    selectedRoadId,
    selectedTransitRegionId,
    selectedTransitRouteId,
    selectedTransitStationId,
    undo,
  } = roadStore;

  const handleModeChange = (nextMode: ToolMode) => {
    if (nextMode === mode) {
      clearDraft();
      setMode("select");
      return;
    }

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

  const handleFinishTransitRegion = () => {
    roadStore.finishTransitRegion();
    if (!keepDrawing) {
      setMode("select");
    }
  };

  const handleAddTransitStation = (point: Point, stationType: TransitStationType) => {
    roadStore.addTransitStation(point, stationType);
    if (!keepDrawing) {
      setMode("select");
    }
  };

  useEffect(() => {
    setPropertiesCollapsed(!roadStore.selectedRoad && !roadStore.selectedTransitRegion && !roadStore.selectedTransitStation);
  }, [roadStore.selectedRoad, roadStore.selectedTransitRegion, roadStore.selectedTransitStation]);

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

      if (event.key === "Enter" && (mode === "draw" || mode === "drawCurve" || mode === "drawTransit" || mode === "drawTransitCurve" || mode === "drawTransitRegion")) {
        if (mode === "drawTransitRegion") {
          handleFinishTransitRegion();
          event.preventDefault();
          return;
        }

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
          mode === "drawTransitRegion" ||
          mode === "blade" ||
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
        if (selectedTransitRegionId) {
          deleteTransitRegion(selectedTransitRegionId);
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
    deleteTransitRegion,
    deleteTransitRoute,
    deleteTransitStation,
    handleFinishDraft,
    handleFinishTransitDraft,
    handleFinishTransitRegion,
    mode,
    redo,
    selectedRoadId,
    selectedTransitRegionId,
    selectedTransitRouteId,
    selectedTransitStationId,
    undo,
  ]);

  const handleImportClick = async () => {
    try {
      const imported = await importProjectDataWithDialog();
      if (imported) {
        roadStore.loadProject(imported.project, imported.fileName);
        return;
      }
      browserImportRef.current?.click();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import failed.");
    }
  };

  const handleBrowserImport = async (file: File) => {
    try {
      roadStore.loadProject(await importProjectDataFromFile(file), file.name);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Import failed.");
    }
  };

  const handleExport = async () => {
    try {
      await exportProjectData(roadStore.projectData, {
        sourceFileName: roadStore.sourceFileName,
        projectName: roadStore.projectName,
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : "Export failed.");
    }
  };

  return (
    <div className={`app-layout ${propertiesCollapsed ? "properties-collapsed" : ""}`}>
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
        onDrawTunnelChange={roadStore.setDrawTunnel}
        onDrawPresetSelect={(toolMode, preset) => {
          const sameActivePreset =
            mode === toolMode &&
            roadStore.drawDefaults.width === preset.width &&
            roadStore.drawDefaults.lanes === preset.lanes &&
            roadStore.drawDefaults.divider === preset.divider;
          if (sameActivePreset) {
            clearDraft();
            setMode("select");
            return;
          }

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
        transitRegions={roadStore.transitRegions}
        transitStations={roadStore.transitStations}
        selectedRoadId={roadStore.selectedRoadId}
        selectedTransitRouteId={roadStore.selectedTransitRouteId}
        selectedTransitRegionId={roadStore.selectedTransitRegionId}
        selectedTransitStationId={roadStore.selectedTransitStationId}
        draftPoints={roadStore.draftPoints}
        transitColor={roadStore.transitColor}
        projectName={roadStore.projectName}
        sourceFileName={roadStore.sourceFileName}
        showGrid={showGrid}
        showDebugMasks={showDebugMasks}
        onCanvasPoint={roadStore.addDraftPoint}
        onFinishDraft={handleFinishDraft}
        onFinishTransitDraft={handleFinishTransitDraft}
        onFinishTransitRegion={handleFinishTransitRegion}
        onAddTransitStation={handleAddTransitStation}
        onAdoptRoadDefaults={roadStore.adoptRoadDefaults}
        onSelectRoad={roadStore.selectRoad}
        onSelectTransitRoute={roadStore.selectTransitRoute}
        onSelectTransitRegion={roadStore.selectTransitRegion}
        onSelectTransitStation={roadStore.selectTransitStation}
        onSplitRoad={roadStore.splitRoad}
        onSplitTransitRoute={roadStore.splitTransitRoute}
        onRoadPointDragStart={roadStore.beginRoadPointDrag}
        onRoadPointDragMove={roadStore.previewRoadPointDrag}
        onRoadPointDragEnd={roadStore.endRoadPointDrag}
        onRoadDragMove={roadStore.previewRoadDrag}
        onRoadDragEnd={roadStore.endRoadDrag}
        onTransitRoutePointDragMove={roadStore.previewTransitRoutePointDrag}
        onTransitRoutePointDragEnd={roadStore.endTransitRoutePointDrag}
        onTransitRegionPointDragMove={roadStore.previewTransitRegionPointDrag}
        onTransitRegionPointDragEnd={roadStore.endTransitRegionPointDrag}
        onTransitStationDragMove={roadStore.previewTransitStationDrag}
        onTransitStationDragEnd={roadStore.endTransitStationDrag}
      />
      <RoadPropertiesPanel
        road={roadStore.selectedRoad}
        transitRegion={roadStore.selectedTransitRegion}
        transitStation={roadStore.selectedTransitStation}
        collapsed={propertiesCollapsed}
        onCollapsedChange={setPropertiesCollapsed}
        onUpdateRoad={roadStore.updateRoad}
        onUpdateTransitRegion={roadStore.updateTransitRegion}
        onUpdateTransitStation={roadStore.updateTransitStation}
      />
    </div>
  );
}
