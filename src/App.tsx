import { useEffect, useRef, useState } from "react";
import { CanvasEditor } from "./components/CanvasEditor";
import { RoadPropertiesPanel } from "./components/RoadPropertiesPanel";
import { Toolbar } from "./components/Toolbar";
import { useRoadStore } from "./state/roadStore";
import type { ToolMode } from "./types/road";
import { exportProjectData, importProjectDataFromFile, importProjectDataWithDialog } from "./utils/fileIO";

export default function App() {
  const [mode, setMode] = useState<ToolMode>("select");
  const browserImportRef = useRef<HTMLInputElement | null>(null);
  const roadStore = useRoadStore();
  const { clearDraft, finishDraft } = roadStore;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter" && (mode === "draw" || mode === "drawCurve")) {
        finishDraft(mode === "drawCurve" ? "bezier" : "polyline");
        setMode("select");
      }

      if (event.key === "Escape" && (mode === "draw" || mode === "drawCurve")) {
        clearDraft();
        setMode("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [clearDraft, finishDraft, mode]);

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
        drawRoadType={roadStore.drawDefaults.roadType}
        onModeChange={setMode}
        onDrawRoadTypeChange={roadStore.setDrawType}
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
        onCanvasPoint={roadStore.addDraftPoint}
        onSelectRoad={roadStore.selectRoad}
        onRoadPointDrag={roadStore.updateRoadPoint}
      />
      <RoadPropertiesPanel road={roadStore.selectedRoad} onUpdateRoad={roadStore.updateRoad} />
    </div>
  );
}
