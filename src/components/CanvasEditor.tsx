import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { Point, Road, ToolMode } from "../types/road";
import { GridLayer } from "./GridLayer";
import { RoadShape } from "./RoadShape";
import { StatusBar } from "./StatusBar";
import { useViewportStore } from "../state/viewportStore";
import { getRoadIntersections } from "../utils/intersections";
import { flattenPoints, getRoadRenderPoints } from "../utils/roadGeometry";
import { getEndpointJunctions } from "../utils/roadRender";
import { compareRoadVisualPriority } from "../utils/roadStyle";
import { snapPointToRoadNode } from "../utils/snap";
import type { SnapTarget } from "../utils/snap";
import { screenToWorld } from "../utils/viewport";

type CanvasEditorProps = {
  mode: ToolMode;
  roads: Road[];
  selectedRoadId: string | null;
  draftPoints: Point[];
  showGrid: boolean;
  onCanvasPoint: (point: Point) => void;
  onAdoptRoadDefaults: (roadId: string) => void;
  onSelectRoad: (roadId: string | null) => void;
  onRoadPointDrag: (roadId: string, pointIndex: number, point: Point) => void;
};

function getScreenPoint(stage: Konva.Stage): Point {
  const pointer = stage.getPointerPosition();
  return {
    x: Math.round(pointer?.x ?? 0),
    y: Math.round(pointer?.y ?? 0),
  };
}

function groupRoadsByLevel(roads: Road[]): Array<{ zLevel: number; roads: Road[] }> {
  const grouped = new Map<number, Road[]>();

  roads.forEach((road) => {
    grouped.set(road.zLevel, [...(grouped.get(road.zLevel) ?? []), road]);
  });

  return Array.from(grouped.entries())
    .map(([zLevel, levelRoads]) => ({
      zLevel,
      roads: levelRoads.sort(compareRoadVisualPriority),
    }))
    .sort((a, b) => a.zLevel - b.zLevel);
}

function isRoadEndpoint(road: Road, pointIndex: number): boolean {
  return pointIndex === 0 || pointIndex === road.points.length - 1;
}

export function CanvasEditor({
  mode,
  roads,
  selectedRoadId,
  draftPoints,
  showGrid,
  onCanvasPoint,
  onAdoptRoadDefaults,
  onSelectRoad,
  onRoadPointDrag,
}: CanvasEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [snapPreview, setSnapPreview] = useState<SnapTarget | null>(null);
  const [mouseWorldPoint, setMouseWorldPoint] = useState<Point | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const lastPanPointRef = useRef<Point | null>(null);
  const { viewport, panBy, zoomAt } = useViewportStore();

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

  useEffect(() => {
    const isFormField = (target: EventTarget | null) => {
      const element = target as HTMLElement | null;
      return element?.tagName === "INPUT" || element?.tagName === "SELECT" || element?.tagName === "TEXTAREA";
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isFormField(event.target)) return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePressed(true);
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (isFormField(event.target)) return;
      if (event.code === "Space") {
        setSpacePressed(false);
        setIsPanning(false);
        lastPanPointRef.current = null;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const sortedRoads = useMemo(
    () => [...roads].sort((a, b) => a.zLevel - b.zLevel),
    [roads],
  );
  const roadLevels = useMemo(() => groupRoadsByLevel(sortedRoads), [sortedRoads]);
  const intersections = useMemo(() => getRoadIntersections(sortedRoads), [sortedRoads]);

  const getSnappedPoint = (
    point: Point,
    exclude?: { roadId: string; pointIndex: number },
  ): { point: Point; target: SnapTarget | null } => snapPointToRoadNode(point, roads, exclude);

  const getWorldPoint = (stage: Konva.Stage): Point => {
    const point = screenToWorld(getScreenPoint(stage), viewport);
    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
  };

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;
    const screenPoint = getScreenPoint(stage);

    if (spacePressed || event.evt.button === 1) {
      event.evt.preventDefault();
      setIsPanning(true);
      lastPanPointRef.current = screenPoint;
      return;
    }

    if (mode === "draw" || mode === "drawCurve") {
      if (mode === "drawCurve" && draftPoints.length >= 4) return;

      const point = getWorldPoint(stage);
      const shouldSnap = mode === "draw" || draftPoints.length === 0 || draftPoints.length === 3;
      const snapped = shouldSnap ? getSnappedPoint(point) : { point, target: null };
      if (draftPoints.length === 0 && snapped.target) {
        const sourceRoad = roads.find((road) => road.id === snapped.target?.roadId);
        if (sourceRoad && isRoadEndpoint(sourceRoad, snapped.target.pointIndex)) {
          onAdoptRoadDefaults(sourceRoad.id);
        }
      }
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
    const screenPoint = getScreenPoint(stage);
    const worldPoint = getWorldPoint(stage);
    setMouseWorldPoint(worldPoint);

    if (isPanning && lastPanPointRef.current) {
      panBy({
        x: screenPoint.x - lastPanPointRef.current.x,
        y: screenPoint.y - lastPanPointRef.current.y,
      });
      lastPanPointRef.current = screenPoint;
      return;
    }

    if (mode !== "draw" && mode !== "drawCurve") {
      if (!snapPreview) return;
      setSnapPreview(null);
      return;
    }

    const shouldSnap = mode === "draw" || draftPoints.length === 0 || draftPoints.length === 3;
    setSnapPreview(shouldSnap ? getSnappedPoint(worldPoint).target : null);
  };

  const handleStageMouseUp = () => {
    setIsPanning(false);
    lastPanPointRef.current = null;
  };

  const handleWheel = (event: Konva.KonvaEventObject<WheelEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;
    event.evt.preventDefault();

    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const zoomFactor = direction > 0 ? 1.1 : 0.9;
    zoomAt(getScreenPoint(stage), viewport.scale * zoomFactor);
  };

  const draftRenderPoints = mode === "drawCurve" ? getRoadRenderPoints(draftPoints, "bezier") : draftPoints;

  return (
    <main className={`canvas-shell ${isPanning || spacePressed ? "is-panning" : ""}`} ref={containerRef}>
      <Stage
        width={size.width}
        height={size.height}
        onMouseDown={handleStageMouseDown}
        onMouseMove={handleStageMouseMove}
        onMouseUp={handleStageMouseUp}
        onWheel={handleWheel}
        onMouseLeave={() => {
          setSnapPreview(null);
          setMouseWorldPoint(null);
          setIsPanning(false);
          lastPanPointRef.current = null;
        }}
      >
        <Layer>
          <Rect name="canvas-background" width={size.width} height={size.height} fill="#eef1f4" />
          <GridLayer width={size.width} height={size.height} viewport={viewport} visible={showGrid} />
          <Line
            points={[0, 0, size.width, 0, size.width, size.height, 0, size.height, 0, 0]}
            stroke="#d6dce3"
            strokeWidth={1}
            closed
            listening={false}
          />
        </Layer>
        <Layer x={viewport.x} y={viewport.y} scaleX={viewport.scale} scaleY={viewport.scale}>
          {roadLevels.map((level) => {
            const levelIntersections = intersections.filter((intersection) => intersection.zLevel === level.zLevel);
            const endpointJunctions = getEndpointJunctions(level.roads);

            return (
              <Group key={`z-level-${level.zLevel}`}>
                {level.roads.map((road) => (
                  <RoadShape
                    key={`selected-${road.id}`}
                    road={road}
                    renderPhase="selected"
                    isSelected={road.id === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
                    getSnappedPoint={getSnappedPoint}
                    onSelect={onSelectRoad}
                    onPointDrag={onRoadPointDrag}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
                {level.roads.map((road) => (
                  <RoadShape
                    key={`outer-${road.id}`}
                    road={road}
                    renderPhase="outer"
                    isSelected={road.id === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
                    getSnappedPoint={getSnappedPoint}
                    onSelect={onSelectRoad}
                    onPointDrag={onRoadPointDrag}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
                {level.roads.map((road) => (
                  <RoadShape
                    key={`body-${road.id}`}
                    road={road}
                    renderPhase="body"
                    isSelected={road.id === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
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
                {level.roads.map((road) => (
                  <RoadShape
                    key={`markings-${road.id}`}
                    road={road}
                    renderPhase="markings"
                    markingMasks={levelIntersections
                      .filter((intersection) => intersection.roadIds.includes(road.id))
                      .map((intersection) => ({
                        point: intersection.point,
                        radius: intersection.radius + 4,
                      }))}
                    isSelected={road.id === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
                    getSnappedPoint={getSnappedPoint}
                    onSelect={onSelectRoad}
                    onPointDrag={onRoadPointDrag}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
              </Group>
            );
          })}
          {sortedRoads.map((road) => (
            <RoadShape
              key={`controls-${road.id}`}
              road={road}
              renderPhase="controls"
              isSelected={road.id === selectedRoadId}
              canSelect={mode === "select" && !spacePressed && !isPanning}
              getSnappedPoint={getSnappedPoint}
              onSelect={onSelectRoad}
              onPointDrag={onRoadPointDrag}
              onSnapPreviewChange={setSnapPreview}
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
      <StatusBar mouseWorldPoint={mouseWorldPoint} zoom={viewport.scale} />
    </main>
  );
}
