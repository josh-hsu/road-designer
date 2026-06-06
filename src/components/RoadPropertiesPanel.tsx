import type { ChangeEvent } from "react";
import type { Road, RoadType } from "../types/road";
import { ROAD_TYPE_LABELS } from "../utils/roadStyle";

type RoadPropertiesPanelProps = {
  road: Road | null;
  onUpdateRoad: (roadId: string, patch: Partial<Omit<Road, "id">>) => void;
};

export function RoadPropertiesPanel({ road, onUpdateRoad }: RoadPropertiesPanelProps) {
  if (!road) {
    return (
      <aside className="properties-panel">
        <h2>Properties</h2>
        <p className="muted">No road selected.</p>
      </aside>
    );
  }

  const updateNumber = (field: "width" | "lanes" | "zLevel") => (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateRoad(road.id, { [field]: Number(event.target.value) });
  };

  return (
    <aside className="properties-panel">
      <h2>Properties</h2>
      <div className="property-id">{road.id}</div>

      <label className="field">
        <span>Road type</span>
        <select
          value={road.roadType}
          onChange={(event) => onUpdateRoad(road.id, { roadType: event.target.value as RoadType })}
        >
          <option value="local">{ROAD_TYPE_LABELS.local}</option>
          <option value="arterial">{ROAD_TYPE_LABELS.arterial}</option>
        </select>
      </label>

      <label className="field">
        <span>Geometry</span>
        <input readOnly value={road.geometryMode ?? "polyline"} />
      </label>

      <label className="field">
        <span>Width</span>
        <input min={6} max={80} type="number" value={road.width} onChange={updateNumber("width")} />
      </label>

      <label className="field">
        <span>Lanes</span>
        <input min={1} max={12} type="number" value={road.lanes} onChange={updateNumber("lanes")} />
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={road.divider}
          onChange={(event) => onUpdateRoad(road.id, { divider: event.target.checked })}
        />
        <span>Divider</span>
      </label>

      <label className="field">
        <span>Z level</span>
        <input min={-10} max={10} type="number" value={road.zLevel} onChange={updateNumber("zLevel")} />
      </label>

      <div className="points-summary">{road.points.length} nodes</div>
    </aside>
  );
}
