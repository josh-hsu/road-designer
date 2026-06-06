import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { Point, Road, ToolMode } from "../types/road";
import { RoadShape } from "./RoadShape";
import { flattenPoints, getRoadRenderPoints } from "../utils/roadGeometry";
import { getEndpointJunctions } from "../utils/roadRender";
import { snapPointToRoadNode } from "../utils/snap";
import type { SnapTarget } from "../utils/snap";

type CanvasEditorProps = {
  mode: ToolMode;
  roads: Road[];
  selectedRoadId: string | null;
  draftPoints: Point[];
  onCanvasPoint: (point: Point) => void;
  onSelectRoad: (roadId: string | null) => void;
  onRoadPointDrag: (roadId: string, pointIndex: number, point: Point) => void;
};

function getStagePoint(stage: Konva.Stage): Point {
  const pointer = stage.getPointerPosition();
  return {
    x: Math.round(pointer?.x ?? 0),
    y: Math.round(pointer?.y ?? 0),
  };
}

export function CanvasEditor({
  mode,
  roads,
  selectedRoadId,
  draftPoints,
  onCanvasPoint,
  onSelectRoad,
  onRoadPointDrag,
}: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [snapPreview, setSnapPreview] = useState<SnapTarget | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(320, Math.floor(entry.contentRect.width)),
        height: Math.max(320, Math.floor(entry.contentRect.height)),
      });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const sortedRoads = useMemo(
    () => [...roads].sort((a, b) => a.zLevel - b.zLevel),
    [roads],
  );
  const endpointJunctions = useMemo(() => getEndpointJunctions(sortedRoads), [sortedRoads]);

  const getSnappedPoint = (
    point: Point,
    exclude?: { roadId: string; pointIndex: number },
  ): { point: Point; target: SnapTarget | null } => snapPointToRoadNode(point, roads, exclude);

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;

    if (mode === "draw" || mode === "drawCurve") {
      if (mode === "drawCurve" && draftPoints.length >= 4) return;

      const point = getStagePoint(stage);
      const shouldSnap = mode === "draw" || draftPoints.length === 0 || draftPoints.length === 3;
      const snapped = shouldSnap ? getSnappedPoint(point) : { point, target: null };
      setSnapPreview(snapped.target);
      onCanvasPoint(snapped.point);
      return;
    }

    if (event.target === stage || event.target.name() === "canvas-background") {
      onSelectRoad(null);
    }
  };

  const handleStageMouseMove = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;

    if (mode !== "draw" && mode !== "drawCurve") {
      if (!snapPreview) return;
      setSnapPreview(null);
      return;
    }

    const shouldSnap = mode === "draw" || draftPoints.length === 0 || draftPoints.length === 3;
    setSnapPreview(shouldSnap ? getSnappedPoint(getStagePoint(stage)).target : null);
  };

  const draftRenderPoints = mode === "drawCurve" ? getRoadRenderPoints(draftPoints, "bezier") : draftPoints;

  return (
    <main className="canvas-shell" ref={containerRef}>
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseLeave={() => setSnapPreview(null)}
      >
        <Layer>
          <Rect name="canvas-background" width={size.width} height={size.height} fill="#eef1f4" />
          <Line
            points={[0, 0, size.width, 0, size.width, size.height, 0, size.height, 0, 0]}
            stroke="#d6dce3"
            strokeWidth={1}
            closed
            listening={false}
          />
          {sortedRoads.map((road) => (
            <RoadShape
              key={road.id}
              road={road}
              isSelected={road.id === selectedRoadId}
              canSelect={mode === "select"}
              getSnappedPoint={getSnappedPoint}
              onSelect={onSelectRoad}
              onPointDrag={onRoadPointDrag}
              onSnapPreviewChange={setSnapPreview}
            />
          ))}
          {endpointJunctions.map((junction) => (
            <Circle
              key={`junction-outer-${junction.x}-${junction.y}`}
              x={junction.x}
              y={junction.y}
              radius={junction.outerRadius}
              fill={junction.outer}
              listening={false}
            />
          ))}
          {endpointJunctions.map((junction) => (
            <Circle
              key={`junction-body-${junction.x}-${junction.y}`}
              x={junction.x}
              y={junction.y}
              radius={junction.bodyRadius}
              fill={junction.body}
              listening={false}
            />
          ))}
          {draftPoints.length > 0 && (
            <>
              {mode === "drawCurve" && (
                <Line
                  points={flattenPoints(draftPoints)}
                  stroke="#2563eb"
                  strokeWidth={1.5}
                  dash={[5, 6]}
                  opacity={0.65}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              )}
              <Line
                points={flattenPoints(draftRenderPoints)}
                stroke="#2563eb"
                strokeWidth={4}
                lineCap="round"
                lineJoin="round"
                dash={[8, 8]}
                listening={false}
              />
              {draftPoints.map((point, index) => (
                <Circle key={index} x={point.x} y={point.y} radius={5} fill="#2563eb" listening={false} />
              ))}
            </>
          )}
          {snapPreview && (
            <>
              <Circle
                x={snapPreview.point.x}
                y={snapPreview.point.y}
                radius={13}
                fill="rgba(37, 99, 235, 0.12)"
                stroke="#2563eb"
                strokeWidth={2}
                listening={false}
              />
              <Circle
                x={snapPreview.point.x}
                y={snapPreview.point.y}
                radius={4}
                fill="#2563eb"
                listening={false}
              />
            </>
          )}
          {roads.length === 0 && draftPoints.length === 0 && (
            <Text
              x={28}
              y={28}
              text="Draw Road: click nodes. Draw Curve Road: click 4 control points. Enter finishes, Esc cancels."
              fill="#667085"
              fontSize={14}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
    </main>
  );
}
