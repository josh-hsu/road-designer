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
  const { clearDraft, deleteRoad, finishDraft, redo, selectedRoadId, undo } = roadStore;

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

      if (event.key === "Enter" && (mode === "draw" || mode === "drawCurve")) {
        handleFinishDraft(mode === "drawCurve" ? "bezier" : "polyline");
        event.preventDefault();
      }

      if (event.key === "Escape" && (mode === "draw" || mode === "drawCurve")) {
        clearDraft();
        setMode("select");
        event.preventDefault();
      }

      if (mode === "select" && selectedRoadId && (event.key === "Delete" || event.key === "Backspace")) {
        deleteRoad(selectedRoadId);
        event.preventDefault();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearDraft, deleteRoad, handleFinishDraft, mode, redo, selectedRoadId, undo]);

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
        selectedRoadId={roadStore.selectedRoadId}
        draftPoints={roadStore.draftPoints}
        showGrid={showGrid}
        showDebugMasks={showDebugMasks}
        onCanvasPoint={roadStore.addDraftPoint}
        onFinishDraft={handleFinishDraft}
        onAdoptRoadDefaults={roadStore.adoptRoadDefaults}
        onSelectRoad={roadStore.selectRoad}
        onRoadPointDragStart={roadStore.beginRoadPointDrag}
        onRoadPointDragMove={roadStore.previewRoadPointDrag}
        onRoadPointDragEnd={roadStore.endRoadPointDrag}
      />
      <RoadPropertiesPanel road={roadStore.selectedRoad} onUpdateRoad={roadStore.updateRoad} />
    </div>
  );
}
