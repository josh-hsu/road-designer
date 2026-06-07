import type { RoadDefaults, RoadType, ToolMode } from "../types/road";
import { ROAD_TYPE_LABELS } from "../utils/roadStyle";

type RoadPreset = Pick<RoadDefaults, "width" | "lanes" | "divider"> & {
  id: string;
  label: string;
};

const ROAD_PRESETS: RoadPreset[] = [
  {
    id: "small",
    label: "1 lane",
    width: 9,
    lanes: 1,
    divider: false,
  },
  {
    id: "normal",
    label: "2 lanes",
    width: 18,
    lanes: 2,
    divider: false,
  },
  {
    id: "big",
    label: "4 lanes",
    width: 27,
    lanes: 4,
    divider: true,
  },
  {
    id: "huge",
    label: "6 lanes",
    width: 36,
    lanes: 6,
    divider: true,
  },
];

type ToolbarProps = {
  mode: ToolMode;
  drawDefaults: RoadDefaults;
  showGrid: boolean;
  keepDrawing: boolean;
  showDebugMasks: boolean;
  onModeChange: (mode: ToolMode) => void;
  onDrawRoadTypeChange: (roadType: RoadType) => void;
  onDrawPresetSelect: (
    mode: Extract<ToolMode, "draw" | "drawCurve">,
    preset: Pick<RoadDefaults, "width" | "lanes" | "divider">,
  ) => void;
  onShowGridChange: (showGrid: boolean) => void;
  onKeepDrawingChange: (keepDrawing: boolean) => void;
  onShowDebugMasksChange: (showDebugMasks: boolean) => void;
  onExport: () => void;
  onImportClick: () => void;
};

function getPresetDefaults(preset: RoadPreset): Pick<RoadDefaults, "width" | "lanes" | "divider"> {
  return {
    width: preset.width,
    lanes: preset.lanes,
    divider: preset.divider,
  };
}

function presetMatches(a: RoadDefaults, b: RoadPreset): boolean {
  return a.width === b.width && a.lanes === b.lanes && a.divider === b.divider;
}

function PointerIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 4 L24 18 L16.8 19.2 L20.7 27 L17.1 28.8 L13.2 21 L8 26 Z" fill="currentColor" />
    </svg>
  );
}

function RoadPresetIcon({ preset, curved, roadType }: { preset: RoadPreset; curved: boolean; roadType: RoadType }) {
  const roadStroke = roadType === "arterial" ? "#535c66" : "#7b8490";
  const edgeStroke = roadType === "arterial" ? "#20262d" : "#3d4652";
  const visualWidth = Math.max(7, Math.min(22, preset.width * 0.62));
  const laneOffsets = Array.from({ length: Math.max(0, preset.lanes - 1) }, (_, index) => {
    return 16 - visualWidth / 2 + (visualWidth / preset.lanes) * (index + 1);
  });
  const path = curved ? "M5 24 C10 7 22 7 27 24" : "M5 16 L27 16";

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d={path} fill="none" stroke={edgeStroke} strokeWidth={visualWidth + 3} strokeLinecap="round" />
      <path d={path} fill="none" stroke={roadStroke} strokeWidth={visualWidth} strokeLinecap="round" />
      {laneOffsets.map((offset) => {
        if (preset.divider && Math.abs(offset - 16) < 1.5) return null;
        const markingPath = curved
          ? `M${5} ${offset + 8} C10 ${offset - 9} 22 ${offset - 9} 27 ${offset + 8}`
          : `M6 ${offset} L26 ${offset}`;
        return (
          <path
            key={offset}
            d={markingPath}
            fill="none"
            stroke="#f8fafc"
            strokeWidth="1"
            strokeDasharray="3 3"
            strokeLinecap="round"
          />
        );
      })}
      {preset.divider && (
        <path
          d={path}
          fill="none"
          stroke="#ffd166"
          strokeWidth="2"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

export function Toolbar({
  mode,
  drawDefaults,
  showGrid,
  keepDrawing,
  showDebugMasks,
  onModeChange,
  onDrawRoadTypeChange,
  onDrawPresetSelect,
  onShowGridChange,
  onKeepDrawingChange,
  onShowDebugMasksChange,
  onExport,
  onImportClick,
}: ToolbarProps) {
  return (
    <aside className="toolbar">
      <div className="toolbar-title">Road Designer</div>

      <button
        className={`tool-button icon-tool-button ${mode === "select" ? "active" : ""}`}
        title="Select"
        aria-label="Select"
        onClick={() => onModeChange("select")}
      >
        <PointerIcon />
        <span>Select</span>
      </button>

      <label className="field">
        <span>Road type</span>
        <select value={drawDefaults.roadType} onChange={(event) => onDrawRoadTypeChange(event.target.value as RoadType)}>
          <option value="local">{ROAD_TYPE_LABELS.local}</option>
          <option value="arterial">{ROAD_TYPE_LABELS.arterial}</option>
        </select>
      </label>

      <div className="tool-section">
        <div className="tool-section-title">Straight</div>
        <div className="preset-grid">
          {ROAD_PRESETS.map((preset) => (
            <button
              key={`straight-${preset.id}`}
              className={`preset-button ${mode === "draw" && presetMatches(drawDefaults, preset) ? "active" : ""}`}
              title={`${preset.label}: ${preset.width}px${preset.divider ? ", divider" : ""}`}
              aria-label={`Draw ${preset.label} road`}
              onClick={() => onDrawPresetSelect("draw", getPresetDefaults(preset))}
            >
              <RoadPresetIcon preset={preset} curved={false} roadType={drawDefaults.roadType} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tool-section">
        <div className="tool-section-title">Curved</div>
        <div className="preset-grid">
          {ROAD_PRESETS.map((preset) => (
            <button
              key={`curve-${preset.id}`}
              className={`preset-button ${mode === "drawCurve" && presetMatches(drawDefaults, preset) ? "active" : ""}`}
              title={`Curved ${preset.label}: ${preset.width}px${preset.divider ? ", divider" : ""}`}
              aria-label={`Draw curved ${preset.label} road`}
              onClick={() => onDrawPresetSelect("drawCurve", getPresetDefaults(preset))}
            >
              <RoadPresetIcon preset={preset} curved roadType={drawDefaults.roadType} />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <label className="checkbox-field">
        <input type="checkbox" checked={showGrid} onChange={(event) => onShowGridChange(event.target.checked)} />
        <span>Show Grid</span>
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={keepDrawing}
          onChange={(event) => onKeepDrawingChange(event.target.checked)}
        />
        <span>Keep Drawing</span>
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={showDebugMasks}
          onChange={(event) => onShowDebugMasksChange(event.target.checked)}
        />
        <span>Show Debug Masks</span>
      </label>

      <div className="toolbar-spacer" />
      <button onClick={onExport}>Export JSON</button>
      <button onClick={onImportClick}>Import JSON</button>
    </aside>
  );
}
