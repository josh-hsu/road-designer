import { Circle, Group, Line } from "react-konva";
import type { Point, Road } from "../types/road";
import { getRoadStyle } from "../utils/roadStyle";
import { flattenPoints, getRoadRenderPoints } from "../utils/roadGeometry";
import { getDividerLayers, getLaneMarkingLayers, getRoadLayerStyles } from "../utils/roadRender";
import type { RoadMarkingMask } from "../utils/roadRender";
import type { SnapTarget } from "../utils/snap";

type RoadShapeProps = {
  road: Road;
  isSelected: boolean;
  canSelect: boolean;
  renderPhase?: "selected" | "outer" | "body" | "markings" | "controls";
  markingMasks?: RoadMarkingMask[];
  getSnappedPoint: (
    point: Point,
    exclude?: { roadId: string; pointIndex: number },
  ) => { point: Point; target: SnapTarget | null };
  onSelect: (roadId: string | null) => void;
  onPointDragStart: () => void;
  onPointDragMove: (roadId: string, pointIndex: number, point: Point) => void;
  onPointDragEnd: (roadId: string, pointIndex: number, point: Point) => void;
  onSnapPreviewChange: (target: SnapTarget | null) => void;
};

export function RoadShape({
  road,
  isSelected,
  canSelect,
  renderPhase = "body",
  markingMasks = [],
  getSnappedPoint,
  onSelect,
  onPointDragStart,
  onPointDragMove,
  onPointDragEnd,
  onSnapPreviewChange,
}: RoadShapeProps) {
  const style = getRoadStyle(road);
  const isBezier = road.geometryMode === "bezier";
  const renderPoints = getRoadRenderPoints(road.points, road.geometryMode);
  const points = flattenPoints(renderPoints);
  const controlPoints = flattenPoints(road.points);
  const roadLayers = getRoadLayerStyles(road, points, isSelected);
  const laneLayers = getLaneMarkingLayers(road, renderPoints, markingMasks);
  const dividerLayers = getDividerLayers(road, renderPoints, markingMasks);
  const selectRoad = () => {
    if (canSelect) onSelect(road.id);
  };
  const phaseLayers =
    renderPhase === "selected"
      ? roadLayers.slice(0, isSelected ? 1 : 0)
      : renderPhase === "outer"
        ? roadLayers.slice(isSelected ? 1 : 0, isSelected ? 2 : 1)
        : renderPhase === "body"
          ? roadLayers.slice(isSelected ? 2 : 1)
          : [];

  return (
    <Group>
      {phaseLayers.map((layer, index) => (
          <Line
            key={`${renderPhase}-${index}`}
            points={layer.points}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            opacity={layer.opacity}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ))}
      {renderPhase === "markings" &&
        laneLayers.map((layer, index) => (
          <Line
            key={`lane-${index}`}
            points={layer.points}
            stroke={layer.stroke}
            strokeWidth={layer.strokeWidth}
            dash={layer.dash}
            opacity={layer.opacity}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ))}
      {renderPhase === "markings" &&
        dividerLayers.map((dividerLayer, index) => (
          <Line
            key={`divider-${index}`}
            points={dividerLayer.points}
            stroke={dividerLayer.stroke}
            strokeWidth={dividerLayer.strokeWidth}
            dash={dividerLayer.dash}
            opacity={dividerLayer.opacity}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        ))}
      {renderPhase === "controls" && (
        <Line
          points={points}
          stroke="rgba(0,0,0,0)"
          strokeWidth={road.width}
          lineCap="round"
          lineJoin="round"
          onClick={selectRoad}
          onTap={selectRoad}
          hitStrokeWidth={Math.max(road.width + 14, 28)}
        />
      )}
      {renderPhase === "controls" && isSelected && isBezier && road.points.length >= 4 && (
          <Line
            points={controlPoints}
            stroke={style.selected}
            strokeWidth={1.5}
            dash={[5, 6]}
            opacity={0.65}
            lineCap="round"
            lineJoin="round"
            listening={false}
          />
        )}
      {renderPhase === "controls" &&
        isSelected &&
        road.points.map((point, index) => (
          <Circle
            key={`${road.id}-${index}`}
            x={point.x}
            y={point.y}
            radius={7}
            fill="#ffffff"
            stroke={style.selected}
            strokeWidth={3}
            draggable={canSelect}
            onDragStart={onPointDragStart}
            onDragMove={(event) => {
              const nextPoint = {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              };
              const shouldSnap = !isBezier || index === 0 || index === road.points.length - 1;
              const snapped = shouldSnap
                ? getSnappedPoint(nextPoint, { roadId: road.id, pointIndex: index })
                : { point: nextPoint, target: null };
              event.target.position(snapped.point);
              onSnapPreviewChange(snapped.target);
              onPointDragMove(road.id, index, {
                x: Math.round(snapped.point.x),
                y: Math.round(snapped.point.y),
              });
            }}
            onDragEnd={(event) => {
              const nextPoint = {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              };
              const shouldSnap = !isBezier || index === 0 || index === road.points.length - 1;
              const snapped = shouldSnap
                ? getSnappedPoint(nextPoint, { roadId: road.id, pointIndex: index })
                : { point: nextPoint, target: null };
              event.target.position(snapped.point);
              onPointDragEnd(road.id, index, snapped.point);
              onSnapPreviewChange(null);
            }}
          />
        ))}
    </Group>
  );
}
