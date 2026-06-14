import { useEffect, useMemo, useRef, useState } from "react";
import { Circle, Group, Layer, Line, Rect, Stage, Text } from "react-konva";
import type Konva from "konva";
import type { Point, Road, RoadGeometryMode, ToolMode, TransitRegion, TransitRoute, TransitStation } from "../types/road";
import { GridLayer } from "./GridLayer";
import { RoadLabelLayer } from "./RoadLabelLayer";
import { RoadShape } from "./RoadShape";
import { ScaleBar } from "./ScaleBar";
import { StatusBar } from "./StatusBar";
import { TransitLayer } from "./TransitLayer";
import { useViewportStore } from "../state/viewportStore";
import { findBladeHit } from "../utils/blade";
import type { BladeHit } from "../utils/blade";
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
  transitRoutes: TransitRoute[];
  transitRegions: TransitRegion[];
  transitStations: TransitStation[];
  selectedRoadId: string | null;
  selectedTransitRouteId: string | null;
  selectedTransitRegionId: string | null;
  selectedTransitStationId: string | null;
  draftPoints: Point[];
  transitColor: string;
  projectName?: string;
  sourceFileName?: string;
  showGrid: boolean;
  showDebugMasks: boolean;
  onCanvasPoint: (point: Point) => void;
  onFinishDraft: (geometryMode: RoadGeometryMode) => void;
  onFinishTransitDraft: (geometryMode: RoadGeometryMode) => void;
  onFinishTransitRegion: () => void;
  onAddTransitStation: (point: Point, stationType: "transfer" | "normal") => void;
  onAdoptRoadDefaults: (roadId: string) => void;
  onSelectRoad: (roadId: string | null) => void;
  onSelectTransitRoute: (routeId: string | null) => void;
  onSelectTransitRegion: (regionId: string | null) => void;
  onSelectTransitStation: (stationId: string | null) => void;
  onSplitRoad: (roadId: string, hit: BladeHit) => void;
  onSplitTransitRoute: (routeId: string, hit: BladeHit) => void;
  onRoadPointDragStart: () => void;
  onRoadPointDragMove: (roadId: string, pointIndex: number, point: Point) => void;
  onRoadPointDragEnd: (roadId: string, pointIndex: number, point: Point) => void;
  onRoadDragMove: (roadId: string, delta: Point) => void;
  onRoadDragEnd: (roadId: string, delta: Point) => void;
  onTransitRoutePointDragMove: (routeId: string, pointIndex: number, point: Point) => void;
  onTransitRoutePointDragEnd: (routeId: string, pointIndex: number, point: Point) => void;
  onTransitRegionPointDragMove: (regionId: string, pointIndex: number, point: Point) => void;
  onTransitRegionPointDragEnd: (regionId: string, pointIndex: number, point: Point) => void;
  onTransitStationDragMove: (stationId: string, point: Point) => void;
  onTransitStationDragEnd: (stationId: string, point: Point) => void;
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

function colorWithAlpha(color: string, alpha: number): string {
  if (/^#[0-9a-f]{6}$/i.test(color)) {
    const red = Number.parseInt(color.slice(1, 3), 16);
    const green = Number.parseInt(color.slice(3, 5), 16);
    const blue = Number.parseInt(color.slice(5, 7), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  return color;
}

export function CanvasEditor({
  mode,
  roads,
  transitRoutes,
  transitRegions,
  transitStations,
  selectedRoadId,
  selectedTransitRouteId,
  selectedTransitRegionId,
  selectedTransitStationId,
  draftPoints,
  transitColor,
  projectName,
  sourceFileName,
  showGrid,
  showDebugMasks,
  onCanvasPoint,
  onFinishDraft,
  onFinishTransitDraft,
  onFinishTransitRegion,
  onAddTransitStation,
  onAdoptRoadDefaults,
  onSelectRoad,
  onSelectTransitRoute,
  onSelectTransitRegion,
  onSelectTransitStation,
  onSplitRoad,
  onSplitTransitRoute,
  onRoadPointDragStart,
  onRoadPointDragMove,
  onRoadPointDragEnd,
  onRoadDragMove,
  onRoadDragEnd,
  onTransitRoutePointDragMove,
  onTransitRoutePointDragEnd,
  onTransitRegionPointDragMove,
  onTransitRegionPointDragEnd,
  onTransitStationDragMove,
  onTransitStationDragEnd,
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
  const backgroundControlRoads = useMemo(
    () => sortedRoads.filter((road) => road.id !== selectedRoadId),
    [selectedRoadId, sortedRoads],
  );
  const selectedControlRoad = useMemo(
    () => sortedRoads.find((road) => road.id === selectedRoadId) ?? null,
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

  const getSnappedTransitPoint = (point: Point): { point: Point; target: SnapTarget | null } => {
    let nearest: SnapTarget | null = null;
    let nearestPoint: Point | null = null;

    transitRoutes.forEach((route) => {
      route.points.forEach((routePoint, pointIndex) => {
        const distance = Math.hypot(point.x - routePoint.x, point.y - routePoint.y);
        if (distance > 12) return;
        if (!nearest || distance < nearest.distance) {
          nearestPoint = routePoint;
          nearest = {
            roadId: route.id,
            pointIndex,
            point: routePoint,
            distance,
          };
        }
      });
    });

    return {
      point: nearestPoint ?? point,
      target: nearest,
    };
  };

  const getWorldPoint = (stage: Konva.Stage): Point => {
    const point = screenToWorld(getScreenPoint(stage), viewport);
    return {
      x: Math.round(point.x),
      y: Math.round(point.y),
    };
  };

  const startPanning = (event: Konva.KonvaEventObject<MouseEvent>, screenPoint: Point) => {
    event.evt.preventDefault();
    setIsPanning(true);
    lastPanPointRef.current = screenPoint;
  };

  const isBlankCanvasTarget = (event: Konva.KonvaEventObject<MouseEvent>): boolean => {
    return event.target === event.target.getStage() || event.target.name() === "canvas-background";
  };

  const isNearRegionStart = (point: Point): boolean => {
    const startPoint = draftPoints[0];
    return Boolean(startPoint && draftPoints.length >= 3 && distanceBetween(point, startPoint) <= 12);
  };

  const splitTargetAtPoint = (point: Point): boolean => {
    type Candidate = {
      kind: "road" | "transit";
      id: string;
      hit: BladeHit;
      threshold: number;
      layerPriority: number;
    };

    const roadCandidates: Candidate[] = sortedRoads.flatMap((road) => {
      const hit = findBladeHit(road.points, road.geometryMode, point);
      const threshold = Math.max(12, road.width / 2 + 8);
      if (!hit || hit.distance > threshold) return [];

      return [{
        kind: "road" as const,
        id: road.id,
        hit,
        threshold,
        layerPriority: getConnectorBaseZLevel(road),
      }];
    });

    const transitCandidates: Candidate[] = transitRoutes.flatMap((route) => {
      const hit = findBladeHit(route.points, route.geometryMode, point);
      const threshold = 12;
      if (!hit || hit.distance > threshold) return [];

      return [{
        kind: "transit" as const,
        id: route.id,
        hit,
        threshold,
        layerPriority: 1000,
      }];
    });

    const bestCandidate = [...roadCandidates, ...transitCandidates].sort((a, b) => {
      const normalizedDistance = a.hit.distance / a.threshold - b.hit.distance / b.threshold;
      if (Math.abs(normalizedDistance) > 0.08) return normalizedDistance;
      return b.layerPriority - a.layerPriority;
    })[0];

    if (!bestCandidate) return false;

    if (bestCandidate.kind === "transit") {
      onSplitTransitRoute(bestCandidate.id, bestCandidate.hit);
    } else {
      onSplitRoad(bestCandidate.id, bestCandidate.hit);
    }

    return true;
  };

  const handleStageMouseDown = (event: Konva.KonvaEventObject<MouseEvent>) => {
    const stage = event.target.getStage();
    if (!stage) return;
    const screenPoint = getScreenPoint(stage);

    if (spacePressed || event.evt.button === 1) {
      startPanning(event, screenPoint);
      return;
    }

    if (mode === "blade") {
      event.evt.preventDefault();
      splitTargetAtPoint(getWorldPoint(stage));
      return;
    }

    if (mode === "transferStation" || mode === "normalStation") {
      onAddTransitStation(getWorldPoint(stage), mode === "transferStation" ? "transfer" : "normal");
      return;
    }

    if (mode === "drawTransitRegion") {
      const point = getWorldPoint(stage);
      if (isNearRegionStart(point)) {
        onFinishTransitRegion();
        return;
      }

      onCanvasPoint(point);
      if (draftPoints.length + 1 >= 10) {
        onFinishTransitRegion();
      }
      return;
    }

    if (mode === "draw" || mode === "drawCurve" || mode === "drawTransit" || mode === "drawTransitCurve") {
      if (mode === "drawCurve" && draftPoints.length >= 4) return;
      if (mode === "drawTransitCurve" && draftPoints.length >= 4) return;

      const point = getWorldPoint(stage);
      const isTransitMode = mode === "drawTransit" || mode === "drawTransitCurve";
      const isCurveMode = mode === "drawCurve" || mode === "drawTransitCurve";
      const shouldSnap = !isCurveMode || draftPoints.length === 0 || draftPoints.length === 3;
      const snapped = shouldSnap
        ? isTransitMode
          ? getSnappedTransitPoint(point)
          : getSnappedPoint(point)
        : { point, target: null };
      if (!isTransitMode && draftPoints.length === 0 && snapped.target) {
        const sourceRoad = roads.find((road) => road.id === snapped.target?.roadId);
        if (sourceRoad && isRoadEndpoint(sourceRoad, snapped.target.pointIndex)) {
          onAdoptRoadDefaults(sourceRoad.id);
        }
      }
      setSnapPreview(snapped.target);
      onCanvasPoint(snapped.point);
      if (draftPoints.length + 1 >= (isCurveMode ? 4 : 2)) {
        if (isTransitMode) {
          onFinishTransitDraft(isCurveMode ? "bezier" : "polyline");
        } else {
          onFinishDraft(isCurveMode ? "bezier" : "polyline");
        }
      }
      return;
    }

    if (mode === "select" && isBlankCanvasTarget(event)) {
      onSelectRoad(null);
      onSelectTransitRoute(null);
      onSelectTransitRegion(null);
      onSelectTransitStation(null);
      startPanning(event, screenPoint);
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

    if (mode !== "draw" && mode !== "drawCurve" && mode !== "drawTransit" && mode !== "drawTransitCurve") {
      if (!snapPreview) return;
      setSnapPreview(null);
      return;
    }

    const isTransitMode = mode === "drawTransit" || mode === "drawTransitCurve";
    const isCurveMode = mode === "drawCurve" || mode === "drawTransitCurve";
    const shouldSnap = !isCurveMode || draftPoints.length === 0 || draftPoints.length === 3;
    setSnapPreview(shouldSnap ? (isTransitMode ? getSnappedTransitPoint(worldPoint).target : getSnappedPoint(worldPoint).target) : null);
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

  const isTransitDraft = mode === "drawTransit" || mode === "drawTransitCurve" || mode === "drawTransitRegion";
  const draftRenderPoints = mode === "drawCurve" || mode === "drawTransitCurve" ? getRoadRenderPoints(draftPoints, "bezier") : draftPoints;

  return (
    <main className={`canvas-shell ${isPanning || spacePressed ? "is-panning" : ""} ${mode === "blade" ? "is-blade" : ""}`} ref={containerRef}>
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
                    onRoadDragStart={onRoadPointDragStart}
                    onRoadDragMove={onRoadDragMove}
                    onRoadDragEnd={onRoadDragEnd}
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
                    onRoadDragStart={onRoadPointDragStart}
                    onRoadDragMove={onRoadDragMove}
                    onRoadDragEnd={onRoadDragEnd}
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
                    onRoadDragStart={onRoadPointDragStart}
                    onRoadDragMove={onRoadDragMove}
                    onRoadDragEnd={onRoadDragEnd}
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
                    onRoadDragStart={onRoadPointDragStart}
                    onRoadDragMove={onRoadDragMove}
                    onRoadDragEnd={onRoadDragEnd}
                    onSnapPreviewChange={setSnapPreview}
                  />
                ))}
              </Group>
            );
          })}
          {backgroundControlRoads.map((road) => (
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
              onRoadDragStart={onRoadPointDragStart}
              onRoadDragMove={onRoadDragMove}
              onRoadDragEnd={onRoadDragEnd}
              onSnapPreviewChange={setSnapPreview}
            />
          ))}
          <TransitLayer
            routes={transitRoutes}
            regions={transitRegions}
            stations={[]}
            selectedRouteId={selectedTransitRouteId}
            selectedRegionId={selectedTransitRegionId}
            selectedStationId={null}
            renderRegions
            renderStations={false}
            canSelect={mode === "select" && !spacePressed && !isPanning}
            onSelectRoute={onSelectTransitRoute}
            onSelectRegion={onSelectTransitRegion}
            onSelectStation={onSelectTransitStation}
            onDragStart={onRoadPointDragStart}
            onRoutePointDragMove={onTransitRoutePointDragMove}
            onRoutePointDragEnd={onTransitRoutePointDragEnd}
            onRegionPointDragMove={onTransitRegionPointDragMove}
            onRegionPointDragEnd={onTransitRegionPointDragEnd}
            onStationDragMove={onTransitStationDragMove}
            onStationDragEnd={onTransitStationDragEnd}
          />
          {selectedControlRoad && (
            <RoadShape
              key={`selected-controls-${selectedControlRoad.id}`}
              road={selectedControlRoad}
              renderPhase="controls"
              isSelected
              canSelect={mode === "select" && !spacePressed && !isPanning}
              getSnappedPoint={getSnappedPoint}
              onSelect={onSelectRoad}
              onPointDragStart={onRoadPointDragStart}
              onPointDragMove={onRoadPointDragMove}
              onPointDragEnd={onRoadPointDragEnd}
              onRoadDragStart={onRoadPointDragStart}
              onRoadDragMove={onRoadDragMove}
              onRoadDragEnd={onRoadDragEnd}
              onSnapPreviewChange={setSnapPreview}
            />
          )}
          <RoadLabelLayer roads={sortedRoads} zoom={viewport.scale} />
          <TransitLayer
            routes={[]}
            regions={[]}
            stations={transitStations}
            selectedRouteId={null}
            selectedRegionId={null}
            selectedStationId={selectedTransitStationId}
            renderRoutes={false}
            renderRegions={false}
            canSelect={mode === "select" && !spacePressed && !isPanning}
            onSelectRoute={onSelectTransitRoute}
            onSelectRegion={onSelectTransitRegion}
            onSelectStation={onSelectTransitStation}
            onDragStart={onRoadPointDragStart}
            onRoutePointDragMove={onTransitRoutePointDragMove}
            onRoutePointDragEnd={onTransitRoutePointDragEnd}
            onRegionPointDragMove={onTransitRegionPointDragMove}
            onRegionPointDragEnd={onTransitRegionPointDragEnd}
            onStationDragMove={onTransitStationDragMove}
            onStationDragEnd={onTransitStationDragEnd}
          />
          {mode === "drawTransitRegion" && draftPoints.length > 0 && (
            <>
              <Line
                points={flattenPoints(draftPoints)}
                closed={draftPoints.length >= 3}
                fill={draftPoints.length >= 3 ? colorWithAlpha(transitColor, 0.2) : undefined}
                stroke={transitColor}
                strokeWidth={3}
                dash={[9, 7]}
                lineJoin="round"
                listening={false}
              />
              {draftPoints.map((point, index) => (
                <Circle
                  key={index}
                  x={point.x}
                  y={point.y}
                  radius={index === 0 ? 6 : 5}
                  fill="#ffffff"
                  stroke={transitColor}
                  strokeWidth={2}
                  listening={false}
                />
              ))}
            </>
          )}
          {mode !== "drawTransitRegion" && draftPoints.length > 0 && (
            <>
              {(mode === "drawCurve" || mode === "drawTransitCurve") && (
                <Line
                  points={flattenPoints(draftPoints)}
                  stroke={isTransitDraft ? transitColor : "#2563eb"}
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
                stroke={isTransitDraft ? transitColor : "#2563eb"}
                strokeWidth={isTransitDraft ? 7 : 4}
                lineCap="round"
                lineJoin="round"
                dash={[8, 8]}
                listening={false}
              />
              {draftPoints.map((point, index) => (
                <Circle key={index} x={point.x} y={point.y} radius={5} fill={isTransitDraft ? transitColor : "#2563eb"} listening={false} />
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
      <StatusBar
        mouseWorldPoint={mouseWorldPoint}
        zoom={viewport.scale}
        projectName={projectName}
        sourceFileName={sourceFileName}
      />
      <ScaleBar zoom={viewport.scale} />
    </main>
  );
}
