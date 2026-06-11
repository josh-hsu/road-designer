import type { ChangeEvent } from "react";
import type { OneWayDirection, Road, RoadKind, RoadType, RouteClass, TransitRegion, TransitStation } from "../types/road";
import { ROAD_TYPE_LABELS } from "../utils/roadStyle";

type RoadPropertiesPanelProps = {
  road: Road | null;
  transitRegion: TransitRegion | null;
  transitStation: TransitStation | null;
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  onUpdateRoad: (roadId: string, patch: Partial<Omit<Road, "id">>) => void;
  onUpdateTransitRegion: (regionId: string, patch: Partial<Omit<TransitRegion, "id">>) => void;
  onUpdateTransitStation: (stationId: string, patch: Partial<Omit<TransitStation, "id">>) => void;
};

export function RoadPropertiesPanel({
  road,
  transitRegion,
  transitStation,
  collapsed,
  onCollapsedChange,
  onUpdateRoad,
  onUpdateTransitRegion,
  onUpdateTransitStation,
}: RoadPropertiesPanelProps) {
  const panelClassName = `properties-panel ${collapsed ? "collapsed" : ""}`;
  const toggleButton = (
    <button
      className="properties-tab"
      type="button"
      title={collapsed ? "Expand properties" : "Collapse properties"}
      aria-label={collapsed ? "Expand properties" : "Collapse properties"}
      onClick={() => onCollapsedChange(!collapsed)}
    >
      {collapsed ? "<" : ">"}
    </button>
  );

  if (collapsed) {
    return <aside className={panelClassName}>{toggleButton}</aside>;
  }

  if (transitStation) {
    return (
      <aside className={panelClassName}>
        {toggleButton}
        <h2>Station</h2>
        <div className="property-id">{transitStation.id}</div>

        <label className="field">
          <span>Station type</span>
          <select
            value={transitStation.stationType ?? "transfer"}
            onChange={(event) =>
              onUpdateTransitStation(transitStation.id, {
                stationType: event.target.value as "transfer" | "normal",
              })
            }
          >
            <option value="transfer">Transfer station</option>
            <option value="normal">Normal station</option>
          </select>
        </label>

        <label className="field">
          <span>Station name</span>
          <textarea
            value={transitStation.name}
            onChange={(event) => onUpdateTransitStation(transitStation.id, { name: event.target.value })}
          />
        </label>
      </aside>
    );
  }

  if (transitRegion) {
    return (
      <aside className={panelClassName}>
        {toggleButton}
        <h2>Region</h2>
        <div className="property-id">{transitRegion.id}</div>

        <label className="field">
          <span>Region name</span>
          <textarea
            value={transitRegion.name ?? ""}
            rows={3}
            onChange={(event) => onUpdateTransitRegion(transitRegion.id, { name: event.target.value })}
          />
        </label>

        <div className="points-summary">{transitRegion.points.length} nodes</div>
      </aside>
    );
  }

  if (!road) {
    return (
      <aside className={panelClassName}>
        {toggleButton}
        <h2>Properties</h2>
        <p className="muted">No road selected.</p>
      </aside>
    );
  }

  const updateNumber = (field: "width" | "lanes" | "zLevel" | "startZLevel" | "endZLevel") => (event: ChangeEvent<HTMLInputElement>) => {
    onUpdateRoad(road.id, { [field]: Number(event.target.value) });
  };

  const updateRoadKind = (kind: RoadKind) => {
    onUpdateRoad(road.id, {
      kind,
      startZLevel: road.startZLevel ?? road.zLevel,
      endZLevel: road.endZLevel ?? road.zLevel,
    });
  };

  return (
    <aside className={panelClassName}>
      {toggleButton}
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
          <option value="tunnel">{ROAD_TYPE_LABELS.tunnel}</option>
        </select>
      </label>

      <label className="field">
        <span>Geometry</span>
        <input readOnly value={road.geometryMode ?? "polyline"} />
      </label>

      <label className="field">
        <span>Road kind</span>
        <select value={road.kind ?? "standard"} onChange={(event) => updateRoadKind(event.target.value as RoadKind)}>
          <option value="standard">Standard</option>
          <option value="connector">Connector</option>
        </select>
      </label>

      <label className="field">
        <span>Road name</span>
        <input value={road.name ?? ""} onChange={(event) => onUpdateRoad(road.id, { name: event.target.value })} />
      </label>

      <label className="field">
        <span>Route class</span>
        <select
          value={road.routeClass ?? "none"}
          onChange={(event) => onUpdateRoad(road.id, { routeClass: event.target.value as RouteClass })}
        >
          <option value="none">None</option>
          <option value="national_freeway">National Freeway</option>
          <option value="expressway">Expressway</option>
          <option value="provincial_highway">Provincial Highway</option>
        </select>
      </label>

      <label className="field">
        <span>Route number</span>
        <input
          value={road.routeNumber ?? ""}
          onChange={(event) => onUpdateRoad(road.id, { routeNumber: event.target.value })}
        />
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={road.showLabel ?? true}
          onChange={(event) => onUpdateRoad(road.id, { showLabel: event.target.checked })}
        />
        <span>Show label</span>
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

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={road.oneWay ?? false}
          onChange={(event) =>
            onUpdateRoad(road.id, {
              oneWay: event.target.checked,
              oneWayDirection: road.oneWayDirection ?? "forward",
            })
          }
        />
        <span>One way</span>
      </label>

      {(road.oneWay ?? false) && (
        <>
          <label className="field">
            <span>One-way direction</span>
            <select
              value={road.oneWayDirection ?? "forward"}
              onChange={(event) =>
                onUpdateRoad(road.id, { oneWayDirection: event.target.value as OneWayDirection })
              }
            >
              <option value="forward">Forward</option>
              <option value="reverse">Reverse</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() =>
              onUpdateRoad(road.id, {
                oneWayDirection: (road.oneWayDirection ?? "forward") === "forward" ? "reverse" : "forward",
              })
            }
          >
            Reverse direction
          </button>
        </>
      )}

      <label className="field">
        <span>Z level</span>
        <input min={-10} max={10} type="number" value={road.zLevel} onChange={updateNumber("zLevel")} />
      </label>

      {(road.kind ?? "standard") === "connector" && (
        <>
          <label className="field">
            <span>Start zLevel</span>
            <input
              min={-10}
              max={10}
              type="number"
              value={road.startZLevel ?? road.zLevel}
              onChange={updateNumber("startZLevel")}
            />
          </label>

          <label className="field">
            <span>End zLevel</span>
            <input
              min={-10}
              max={10}
              type="number"
              value={road.endZLevel ?? road.zLevel}
              onChange={updateNumber("endZLevel")}
            />
          </label>
        </>
      )}

      <div className="points-summary">{road.points.length} nodes</div>
    </aside>
  );
}
