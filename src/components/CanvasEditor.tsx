import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { Point, Road, ToolMode } from "../types/road";
import { GridLayer } from "./GridLayer";
import { RoadLabelLayer } from "./RoadLabelLayer";
import { RoadShape } from "./RoadShape";
import { StatusBar } from "./StatusBar";
import { useViewportStore } from "../state/viewportStore";
import { getRoadIntersections } from "../utils/intersections";
import { flattenPoints, getRoadRenderPoints } from "../utils/roadGeometry";
import { getEndpointJunctions } from "../utils/roadRender";
import { compareRoadVisualPriority, getRoadStyle } from "../utils/roadStyle";
import { snapPointToRoadNode } from "../utils/snap";
import type { SnapTarget } from "../utils/snap";
import { getVisualRoadSegments, splitPolylineAtRatio } from "../utils/visualRoadSegments";
import type { VisualRoadSegment } from "../utils/visualRoadSegments";
import { screenToWorld } from "../utils/viewport";

type CanvasEditorProps = {
  mode: ToolMode;
  roads: Road[];
  selectedRoadId: string | null;
  draftPoints: Point[];
  showGrid: boolean;
  showDebugMasks: boolean;
  onCanvasPoint: (point: Point) => void;
  onAdoptRoadDefaults: (roadId: string) => void;
  onSelectRoad: (roadId: string | null) => void;
  onRoadPointDragStart: () => void;
  onRoadPointDragMove: (roadId: string, pointIndex: number, point: Point) => void;
  onRoadPointDragEnd: (roadId: string, pointIndex: number, point: Point) => void;
};

function getScreenPoint(stage: Konva.Stage): Point {
  const pointer = stage.getPointerPosition();
  return {
    x: Math.round(pointer?.x ?? 0),
    y: Math.round(pointer?.y ?? 0),
  };
}

function groupSegmentsByLevel(segments: VisualRoadSegment[]): Array<{ zLevel: number; segments: VisualRoadSegment[] }> {
  const grouped = new Map<number, VisualRoadSegment[]>();
  const zLevels = Array.from(new Set(segments.map((segment) => segment.zLevel))).sort((a, b) => a - b);

  zLevels.forEach((zLevel) => {
    grouped.set(zLevel, []);
  });

  segments.forEach((segment) => {
    grouped.set(segment.zLevel, [...(grouped.get(segment.zLevel) ?? []), segment]);
  });

  return Array.from(grouped.entries())
    .map(([zLevel, levelSegments]) => ({
      zLevel,
      segments: levelSegments.sort(compareRoadVisualPriority),
    }))
    .sort((a, b) => a.zLevel - b.zLevel);
}

function isRoadEndpoint(road: Road, pointIndex: number): boolean {
  return pointIndex === 0 || pointIndex === road.points.length - 1;
}

function distanceBetween(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(point: Point, from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) return distanceBetween(point, from);

  const t = Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared));
  return distanceBetween(point, {
    x: from.x + dx * t,
    y: from.y + dy * t,
  });
}

function distanceToRoad(point: Point, road: { points: Point[]; geometryMode?: string }): number {
  const renderPoints = getRoadRenderPoints(road.points, road.geometryMode);
  if (renderPoints.length === 0) return Number.POSITIVE_INFINITY;

  return renderPoints.slice(0, -1).reduce((minimumDistance, from, index) => {
    return Math.min(minimumDistance, distanceToSegment(point, from, renderPoints[index + 1]));
  }, Number.POSITIVE_INFINITY);
}

function getConnectorBaseZLevel(road: Road): number {
  return Math.min(road.startZLevel ?? road.zLevel, road.endZLevel ?? road.zLevel);
}

function getAngleBetweenPoints(from: Point, to: Point): number {
  return (Math.atan2(to.y - from.y, to.x - from.x) * 180) / Math.PI;
}

function getConnectorSplitPatch(
  road: Road,
): { point: Point; width: number; length: number; rotation: number; fill: string; zLevels: number[] } | null {
  if ((road.kind ?? "standard") !== "connector") return null;

  const renderPoints = getRoadRenderPoints(road.points, road.geometryMode);
  if (renderPoints.length < 2) return null;

  const { startPoints, endPoints } = splitPolylineAtRatio(renderPoints, 0.5);
  const point = startPoints[startPoints.length - 1];
  if (!point) return null;

  const beforePoint = startPoints[startPoints.length - 2];
  const afterPoint = endPoints[1];
  const rotation = beforePoint && afterPoint
    ? getAngleBetweenPoints(beforePoint, afterPoint)
    : beforePoint
      ? getAngleBetweenPoints(beforePoint, point)
      : afterPoint
        ? getAngleBetweenPoints(point, afterPoint)
        : 0;
  const inset = Math.min(4, road.width * 0.02);

  return {
    point,
    width: Math.max(4, road.width - inset),
    length: Math.max(8, road.width * 1.55),
    rotation,
    fill: getRoadStyle(road).body,
    zLevels: Array.from(new Set([road.startZLevel ?? road.zLevel, road.endZLevel ?? road.zLevel])),
  };
}

function getIntersectionMaskSize(
  intersection: { roadIds: string[]; radius: number },
  road: VisualRoadSegment,
  levelSegments: VisualRoadSegment[],
): number {
  const crossingRoads = levelSegments.filter((segment) => {
    return intersection.roadIds.includes(segment.sourceRoadId) && segment.sourceRoadId !== road.sourceRoadId;
  });

  if (crossingRoads.length === 0) return intersection.radius;

  const widestCrossingRoad = crossingRoads.reduce((widest, segment) =>
    segment.width > widest.width ? segment : widest,
  );

  return widestCrossingRoad.width / 2 + 2;
}

export function CanvasEditor({
  mode,
  roads,
  selectedRoadId,
  draftPoints,
  showGrid,
  showDebugMasks,
  onCanvasPoint,
  onAdoptRoadDefaults,
  onSelectRoad,
  onRoadPointDragStart,
  onRoadPointDragMove,
  onRoadPointDragEnd,
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
    () => [...roads].sort((a, b) => getConnectorBaseZLevel(a) - getConnectorBaseZLevel(b)),
    [roads],
  );
  const visualSegments = useMemo(() => getVisualRoadSegments(sortedRoads), [sortedRoads]);
  const controlRoads = useMemo(
    () => [
      ...sortedRoads.filter((road) => road.id !== selectedRoadId),
      ...sortedRoads.filter((road) => road.id === selectedRoadId),
    ],
    [selectedRoadId, sortedRoads],
  );
  const segmentLevels = useMemo(() => groupSegmentsByLevel(visualSegments), [visualSegments]);
  const intersections = useMemo(() => getRoadIntersections(visualSegments), [visualSegments]);
  const connectorSplitPatches = useMemo(
    () => sortedRoads.map(getConnectorSplitPatch).filter((patch): patch is NonNullable<typeof patch> => Boolean(patch)),
    [sortedRoads],
  );

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
          {segmentLevels.map((level) => {
            const levelIntersections = intersections.filter((intersection) => intersection.zLevel === level.zLevel);
            const levelSplitPatches = connectorSplitPatches.filter((patch) => patch.zLevels.includes(level.zLevel));
            const endpointJunctions = getEndpointJunctions(level.segments).filter((junction) => {
              const overlapsIntersection = levelIntersections.some((intersection) => {
                return distanceBetween(junction, intersection.point) <= 8;
              });
              if (overlapsIntersection) return false;

              const connectedRoads = level.segments.filter((road) => junction.roadIds.includes(road.sourceRoadId));
              const primaryConnectedRoad =
                [...connectedRoads].sort(compareRoadVisualPriority)[connectedRoads.length - 1] ?? connectedRoads[0];

              return !level.segments.some((road) => {
                if (!primaryConnectedRoad || junction.roadIds.includes(road.sourceRoadId)) return false;
                if (compareRoadVisualPriority(road, primaryConnectedRoad) <= 0) return false;

                return distanceToRoad(junction, road) <= road.width / 2 + 4;
              });
            });

            return (
              <Group key={`z-level-${level.zLevel}`}>
                {level.segments.map((road) => (
                  <RoadShape
                    key={`selected-${road.id}`}
                    road={road}
                    renderPhase="selected"
                    isSelected={road.sourceRoadId === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
                    getSnappedPoint={getSnappedPoint}
                    onSelect={onSelectRoad}
                    onPointDragStart={onRoadPointDragStart}
                    onPointDragMove={onRoadPointDragMove}
                    onPointDragEnd={onRoadPointDragEnd}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
                {level.segments.map((road) => (
                  <RoadShape
                    key={`outer-${road.id}`}
                    road={road}
                    renderPhase="outer"
                    isSelected={road.sourceRoadId === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
                    getSnappedPoint={getSnappedPoint}
                    onSelect={onSelectRoad}
                    onPointDragStart={onRoadPointDragStart}
                    onPointDragMove={onRoadPointDragMove}
                    onPointDragEnd={onRoadPointDragEnd}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
                {level.segments.map((road) => (
                  <RoadShape
                    key={`body-${road.id}`}
                    road={road}
                    renderPhase="body"
                    isSelected={road.sourceRoadId === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
                    getSnappedPoint={getSnappedPoint}
                    onSelect={onSelectRoad}
                    onPointDragStart={onRoadPointDragStart}
                    onPointDragMove={onRoadPointDragMove}
                    onPointDragEnd={onRoadPointDragEnd}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
                {endpointJunctions.map((junction) => (
                  <Rect
                    key={`junction-outer-${junction.x}-${junction.y}`}
                    x={junction.x}
                    y={junction.y}
                    width={junction.outerSize}
                    height={junction.outerSize}
                    offsetX={junction.outerSize / 2}
                    offsetY={junction.outerSize / 2}
                    fill={junction.outer}
                    listening={false}
                  />
                ))}
                {endpointJunctions.map((junction) => (
                  <Rect
                    key={`junction-body-${junction.x}-${junction.y}`}
                    x={junction.x}
                    y={junction.y}
                    width={junction.bodySize}
                    height={junction.bodySize}
                    offsetX={junction.bodySize / 2}
                    offsetY={junction.bodySize / 2}
                    fill={junction.body}
                    listening={false}
                  />
                ))}
                {levelSplitPatches.map((patch) => (
                  <Rect
                    key={`connector-split-${level.zLevel}-${patch.point.x}-${patch.point.y}`}
                    x={patch.point.x}
                    y={patch.point.y}
                    width={patch.length}
                    height={patch.width}
                    offsetX={patch.length / 2}
                    offsetY={patch.width / 2}
                    rotation={patch.rotation}
                    fill={patch.fill}
                    listening={false}
                  />
                ))}
                {showDebugMasks &&
                  levelIntersections.flatMap((intersection) =>
                    level.segments
                      .filter((road) => intersection.roadIds.includes(road.sourceRoadId))
                      .map((road) => {
                        const maskSize = getIntersectionMaskSize(intersection, road, level.segments);

                        return (
                          <Rect
                            key={`intersection-mask-outline-${intersection.id}-${road.id}`}
                            x={intersection.point.x}
                            y={intersection.point.y}
                            width={maskSize * 2}
                            height={maskSize * 2}
                            offsetX={maskSize}
                            offsetY={maskSize}
                            stroke="#ef4444"
                            strokeWidth={1.5}
                            dash={[6, 4]}
                            opacity={0.9}
                            listening={false}
                          />
                        );
                      }),
                  )}
                {level.segments.map((road) => (
                  <RoadShape
                    key={`markings-${road.id}`}
                    road={road}
                    renderPhase="markings"
                    markingMasks={levelIntersections
                      .filter((intersection) => intersection.roadIds.includes(road.sourceRoadId))
                      .map((intersection) => ({
                        point: intersection.point,
                        radius: getIntersectionMaskSize(intersection, road, level.segments),
                        shape: "square" as const,
                      }))}
                    isSelected={road.sourceRoadId === selectedRoadId}
                    canSelect={mode === "select" && !spacePressed && !isPanning}
                    getSnappedPoint={getSnappedPoint}
                    onSelect={onSelectRoad}
                    onPointDragStart={onRoadPointDragStart}
                    onPointDragMove={onRoadPointDragMove}
                    onPointDragEnd={onRoadPointDragEnd}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
              </Group>
            );
          })}
          {controlRoads.map((road) => (
            <RoadShape
              key={`controls-${road.id}`}
              road={road}
              renderPhase="controls"
              isSelected={road.id === selectedRoadId}
              canSelect={mode === "select" && !spacePressed && !isPanning}
              getSnappedPoint={getSnappedPoint}
              onSelect={onSelectRoad}
              onPointDragStart={onRoadPointDragStart}
              onPointDragMove={onRoadPointDragMove}
              onPointDragEnd={onRoadPointDragEnd}
              onSnapPreviewChange={setSnapPreview}
            />
          ))}
          <RoadLabelLayer roads={sortedRoads} zoom={viewport.scale} />
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
