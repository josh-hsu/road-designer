import { useState } from "react";
import type { RoadDefaults, RoadType, ToolMode } from "../types/road";
import { getRoadPresetWidth, getRoadStyle, ROAD_TYPE_LABELS } from "../utils/roadStyle";

type RoadPreset = Pick<RoadDefaults, "lanes" | "divider"> & {
  id: string;
  label: string;
};

const ROAD_PRESETS: RoadPreset[] = [
  {
    id: "small",
    label: "1 lane",
    lanes: 1,
    divider: false,
  },
  {
    id: "normal",
    label: "2 lanes",
    lanes: 2,
    divider: false,
  },
  {
    id: "big",
    label: "4 lanes",
    lanes: 4,
    divider: true,
  },
  {
    id: "huge",
    label: "6 lanes",
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
  transitColor: string;
  transitPalette: string[];
  onModeChange: (mode: ToolMode) => void;
  onDrawRoadTypeChange: (roadType: RoadType) => void;
  onDrawTunnelChange: (isTunnel: boolean) => void;
  onDrawPresetSelect: (
    mode: Extract<ToolMode, "draw" | "drawCurve">,
    preset: Pick<RoadDefaults, "width" | "lanes" | "divider">,
  ) => void;
  onShowGridChange: (showGrid: boolean) => void;
  onKeepDrawingChange: (keepDrawing: boolean) => void;
  onShowDebugMasksChange: (showDebugMasks: boolean) => void;
  onTransitColorChange: (color: string) => void;
  onAddTransitColor: (color: string) => void;
  onExport: () => void;
  onImportClick: () => void;
};

function getPresetDefaults(
  preset: RoadPreset,
  roadType: RoadType,
): Pick<RoadDefaults, "width" | "lanes" | "divider"> {
  return {
    width: getRoadPresetWidth(roadType, preset.lanes),
    lanes: preset.lanes,
    divider: preset.divider,
  };
}

function presetMatches(a: RoadDefaults, b: RoadPreset): boolean {
  return a.lanes === b.lanes && a.divider === b.divider;
}

function PointerIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d="M8 4 L24 18 L16.8 19.2 L20.7 27 L17.1 28.8 L13.2 21 L8 26 Z" fill="currentColor" />
    </svg>
  );
}

function BladeIcon() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="9" cy="22" r="3.4" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <circle cx="15" cy="22" r="3.4" fill="none" stroke="currentColor" strokeWidth="2.6" />
      <path d="M12 19 L25 6" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M14.8 19.4 L26 15" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M13 17.5 L17.2 21" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

function RoadPresetIcon({
  preset,
  curved,
  roadType,
  isTunnel,
}: {
  preset: RoadPreset;
  curved: boolean;
  roadType: RoadType;
  isTunnel: boolean;
}) {
  const style = getRoadStyle({ roadType, isTunnel });
  const presetWidth = getRoadPresetWidth(roadType, preset.lanes);
  const visualWidth = Math.max(7, Math.min(22, presetWidth * 0.62));
  const laneOffsets = Array.from({ length: Math.max(0, preset.lanes - 1) }, (_, index) => {
    return 16 - visualWidth / 2 + (visualWidth / preset.lanes) * (index + 1);
  });
  const path = curved ? "M5 24 C10 7 22 7 27 24" : "M5 16 L27 16";

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke={style.outer}
        strokeWidth={visualWidth + 3}
        strokeLinecap="round"
        strokeDasharray={style.outerDash?.join(" ")}
      />
      <path d={path} fill="none" stroke={style.body} strokeWidth={visualWidth} strokeLinecap="round" />
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

function TransitToolIcon({
  kind,
  color,
}: {
  kind: "line" | "curve" | "region" | "transferStation" | "normalStation";
  color: string;
}) {
  if (kind === "region") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect
          x="7"
          y="7"
          width="18"
          height="18"
          rx="2"
          fill={color}
          fillOpacity="0.2"
          stroke={color}
          strokeWidth="3"
          strokeDasharray="4 3"
        />
      </svg>
    );
  }

  if (kind === "transferStation") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="10" fill="#ffffff" stroke="#111827" strokeWidth="4" />
        <circle cx="16" cy="16" r="4.5" fill="#111827" />
      </svg>
    );
  }

  if (kind === "normalStation") {
    return (
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="9.5" fill="#ffffff" stroke={color} strokeWidth="4" />
      </svg>
    );
  }

  const path = kind === "curve" ? "M5 24 C10 7 22 7 27 24" : "M5 16 L27 16";

  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <path d={path} fill="none" stroke="rgba(15,23,42,0.22)" strokeWidth="11" strokeLinecap="round" />
      <path d={path} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" />
      <circle cx="6" cy={kind === "curve" ? 23 : 16} r="2.5" fill="#ffffff" stroke={color} strokeWidth="1.5" />
      <circle cx="26" cy={kind === "curve" ? 23 : 16} r="2.5" fill="#ffffff" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}

export function Toolbar({
  mode,
  drawDefaults,
  showGrid,
  keepDrawing,
  showDebugMasks,
  transitColor,
  transitPalette,
  onModeChange,
  onDrawRoadTypeChange,
  onDrawTunnelChange,
  onDrawPresetSelect,
  onShowGridChange,
  onKeepDrawingChange,
  onShowDebugMasksChange,
  onTransitColorChange,
  onAddTransitColor,
  onExport,
  onImportClick,
}: ToolbarProps) {
  const [newTransitColor, setNewTransitColor] = useState(transitColor);

  return (
    <aside className="toolbar">
      <div className="toolbar-title">Road Designer</div>

      <div className="preset-grid mode-tool-grid">
        <button
          className={`preset-button ${mode === "select" ? "active" : ""}`}
          title="Select"
          aria-label="Select"
          onClick={() => onModeChange("select")}
        >
          <PointerIcon />
          <span>Select</span>
        </button>
        <button
          className={`preset-button ${mode === "blade" ? "active" : ""}`}
          title="Blade"
          aria-label="Blade"
          onClick={() => onModeChange("blade")}
        >
          <BladeIcon />
          <span>Blade</span>
        </button>
      </div>

      <label className="field">
        <span>Road type</span>
        <select value={drawDefaults.roadType} onChange={(event) => onDrawRoadTypeChange(event.target.value as RoadType)}>
          <option value="motorway">{ROAD_TYPE_LABELS.motorway}</option>
          <option value="primary">{ROAD_TYPE_LABELS.primary}</option>
          <option value="secondary">{ROAD_TYPE_LABELS.secondary}</option>
          <option value="tertiary">{ROAD_TYPE_LABELS.tertiary}</option>
          <option value="residential">{ROAD_TYPE_LABELS.residential}</option>
        </select>
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={drawDefaults.isTunnel ?? false}
          onChange={(event) => onDrawTunnelChange(event.target.checked)}
        />
        <span>Tunnel</span>
      </label>

      <div className="tool-section">
        <div className="tool-section-title">Straight</div>
        <div className="preset-grid">
          {ROAD_PRESETS.map((preset) => (
            <button
              key={`straight-${preset.id}`}
              className={`preset-button ${mode === "draw" && presetMatches(drawDefaults, preset) ? "active" : ""}`}
              title={`${preset.label}: ${getRoadPresetWidth(drawDefaults.roadType, preset.lanes)}px${preset.divider ? ", divider" : ""}`}
              aria-label={`Draw ${preset.label} road`}
              onClick={() => onDrawPresetSelect("draw", getPresetDefaults(preset, drawDefaults.roadType))}
            >
              <RoadPresetIcon
                preset={preset}
                curved={false}
                roadType={drawDefaults.roadType}
                isTunnel={drawDefaults.isTunnel ?? false}
              />
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
              title={`Curved ${preset.label}: ${getRoadPresetWidth(drawDefaults.roadType, preset.lanes)}px${preset.divider ? ", divider" : ""}`}
              aria-label={`Draw curved ${preset.label} road`}
              onClick={() => onDrawPresetSelect("drawCurve", getPresetDefaults(preset, drawDefaults.roadType))}
            >
              <RoadPresetIcon
                preset={preset}
                curved
                roadType={drawDefaults.roadType}
                isTunnel={drawDefaults.isTunnel ?? false}
              />
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="tool-section">
        <div className="tool-section-title">Transit</div>
        <div className="transit-palette">
          {transitPalette.map((color) => (
            <button
              key={color}
              className={`color-swatch ${color === transitColor ? "active" : ""}`}
              title={color}
              aria-label={`Transit color ${color}`}
              style={{ backgroundColor: color }}
              onClick={() => onTransitColorChange(color)}
            />
          ))}
        </div>
        <div className="color-add-row">
          <input
            type="color"
            value={newTransitColor}
            onChange={(event) => {
              setNewTransitColor(event.target.value);
              onTransitColorChange(event.target.value);
            }}
            aria-label="New transit color"
          />
          <button type="button" onClick={() => onAddTransitColor(newTransitColor)}>
            Add
          </button>
        </div>
        <div className="preset-grid transit-tool-grid">
          <button
            className={`preset-button ${mode === "drawTransit" ? "active" : ""}`}
            title="Transit line"
            aria-label="Draw transit line"
            onClick={() => onModeChange("drawTransit")}
          >
            <TransitToolIcon kind="line" color={transitColor} />
            <span>Line</span>
          </button>
          <button
            className={`preset-button ${mode === "drawTransitCurve" ? "active" : ""}`}
            title="Curved transit line"
            aria-label="Draw curved transit line"
            onClick={() => onModeChange("drawTransitCurve")}
          >
            <TransitToolIcon kind="curve" color={transitColor} />
            <span>Curve</span>
          </button>
          <button
            className={`preset-button ${mode === "drawTransitRegion" ? "active" : ""}`}
            title="Transit region"
            aria-label="Draw transit region"
            onClick={() => onModeChange("drawTransitRegion")}
          >
            <TransitToolIcon kind="region" color={transitColor} />
            <span>Region</span>
          </button>
        </div>
        <div className="preset-grid transit-tool-grid">
          <button
            className={`preset-button ${mode === "transferStation" ? "active" : ""}`}
            title="Transfer station"
            aria-label="Place transfer station"
            onClick={() => onModeChange("transferStation")}
          >
            <TransitToolIcon kind="transferStation" color={transitColor} />
            <span>Transfer</span>
          </button>
          <button
            className={`preset-button ${mode === "normalStation" ? "active" : ""}`}
            title="Normal station"
            aria-label="Place normal station"
            onClick={() => onModeChange("normalStation")}
          >
            <TransitToolIcon kind="normalStation" color={transitColor} />
            <span>Normal</span>
          </button>
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
