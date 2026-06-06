import type { RoadType, ToolMode } from "../types/road";
import { ROAD_TYPE_LABELS } from "../utils/roadStyle";

type ToolbarProps = {
  mode: ToolMode;
  drawRoadType: RoadType;
  showGrid: boolean;
  onModeChange: (mode: ToolMode) => void;
  onDrawRoadTypeChange: (roadType: RoadType) => void;
  onShowGridChange: (showGrid: boolean) => void;
  onExport: () => void;
  onImportClick: () => void;
};

export function Toolbar({
  mode,
  drawRoadType,
  showGrid,
  onModeChange,
  onDrawRoadTypeChange,
  onShowGridChange,
  onExport,
  onImportClick,
}: ToolbarProps) {
  return (
    <aside className="toolbar">
      <div className="toolbar-title">Road Designer</div>
      <button className={mode === "select" ? "active" : ""} onClick={() => onModeChange("select")}>
        Select
      </button>
      <button className={mode === "draw" ? "active" : ""} onClick={() => onModeChange("draw")}>
        Draw Road
      </button>
      <button className={mode === "drawCurve" ? "active" : ""} onClick={() => onModeChange("drawCurve")}>
        Draw Curve Road
      </button>

      <label className="field">
        <span>Road type</span>
        <select value={drawRoadType} onChange={(event) => onDrawRoadTypeChange(event.target.value as RoadType)}>
          <option value="local">{ROAD_TYPE_LABELS.local}</option>
          <option value="arterial">{ROAD_TYPE_LABELS.arterial}</option>
        </select>
      </label>

      <label className="checkbox-field">
        <input type="checkbox" checked={showGrid} onChange={(event) => onShowGridChange(event.target.checked)} />
        <span>Show Grid</span>
      </label>

      <div className="toolbar-spacer" />
      <button onClick={onExport}>Export JSON</button>
      <button onClick={onImportClick}>Import JSON</button>
    </aside>
  );
}
