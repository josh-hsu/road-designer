import { Circle, Group, Line, Text } from "react-konva";
import type { TransitRegion, TransitRoute, TransitStation } from "../types/road";
import { flattenPoints, getRoadRenderPoints } from "../utils/roadGeometry";

type TransitLayerProps = {
  routes: TransitRoute[];
  regions: TransitRegion[];
  stations: TransitStation[];
  selectedRouteId: string | null;
  selectedRegionId: string | null;
  selectedStationId: string | null;
  renderRoutes?: boolean;
  renderRegions?: boolean;
  renderStations?: boolean;
  canSelect: boolean;
  onSelectRoute: (routeId: string | null) => void;
  onSelectRegion: (regionId: string | null) => void;
  onSelectStation: (stationId: string | null) => void;
  onDragStart: () => void;
  onRoutePointDragMove: (routeId: string, pointIndex: number, point: { x: number; y: number }) => void;
  onRoutePointDragEnd: (routeId: string, pointIndex: number, point: { x: number; y: number }) => void;
  onRegionPointDragMove: (regionId: string, pointIndex: number, point: { x: number; y: number }) => void;
  onRegionPointDragEnd: (regionId: string, pointIndex: number, point: { x: number; y: number }) => void;
  onStationDragMove: (stationId: string, point: { x: number; y: number }) => void;
  onStationDragEnd: (stationId: string, point: { x: number; y: number }) => void;
};

function getRegionCenter(points: { x: number; y: number }[]): { x: number; y: number } {
  if (points.length === 0) return { x: 0, y: 0 };

  const bounds = points.reduce(
    (current, point) => ({
      minX: Math.min(current.minX, point.x),
      maxX: Math.max(current.maxX, point.x),
      minY: Math.min(current.minY, point.y),
      maxY: Math.max(current.maxY, point.y),
    }),
    {
      minX: points[0].x,
      maxX: points[0].x,
      minY: points[0].y,
      maxY: points[0].y,
    },
  );

  return {
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
  };
}

function getRegionLabel(name: string | undefined): string {
  return (name ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3)
    .join("\n");
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

export function TransitLayer({
  routes,
  regions,
  stations,
  selectedRouteId,
  selectedRegionId,
  selectedStationId,
  renderRoutes = true,
  renderRegions = true,
  renderStations = true,
  canSelect,
  onSelectRoute,
  onSelectRegion,
  onSelectStation,
  onDragStart,
  onRoutePointDragMove,
  onRoutePointDragEnd,
  onRegionPointDragMove,
  onRegionPointDragEnd,
  onStationDragMove,
  onStationDragEnd,
}: TransitLayerProps) {
  const selectedRoute = routes.find((route) => route.id === selectedRouteId) ?? null;
  const selectedRegion = regions.find((region) => region.id === selectedRegionId) ?? null;

  return (
    <Group>
      {renderRegions &&
        regions.map((region) => {
          const points = flattenPoints(region.points);
          const selected = region.id === selectedRegionId;
          const label = getRegionLabel(region.name);
          const center = getRegionCenter(region.points);

          return (
            <Group key={region.id}>
              <Line
                points={points}
                closed
                fill={colorWithAlpha(region.color, 0.2)}
                stroke={region.color}
                strokeWidth={3}
                dash={[9, 7]}
                lineJoin="round"
                listening={false}
              />
              {selected && (
                <Line
                  points={points}
                  closed
                  stroke="#2563eb"
                  strokeWidth={2}
                  dash={[7, 5]}
                  lineJoin="round"
                  listening={false}
                />
              )}
              {label && (
                <>
                  <Text
                    x={center.x - 70}
                    y={center.y - 24}
                    width={140}
                    height={56}
                    text={label}
                    fill="#ffffff"
                    stroke="#ffffff"
                    strokeWidth={4}
                    fontSize={15}
                    fontStyle="700"
                    lineHeight={1.15}
                    align="center"
                    verticalAlign="middle"
                    wrap="none"
                    listening={false}
                  />
                  <Text
                    x={center.x - 70}
                    y={center.y - 24}
                    width={140}
                    height={56}
                    text={label}
                    fill="#111827"
                    fontSize={15}
                    fontStyle="700"
                    lineHeight={1.15}
                    align="center"
                    verticalAlign="middle"
                    wrap="none"
                    listening={false}
                  />
                </>
              )}
              <Line
                points={points}
                closed
                fill="rgba(0,0,0,0)"
                stroke="rgba(0,0,0,0)"
                strokeWidth={14}
                lineJoin="round"
                onClick={() => {
                  if (canSelect) onSelectRegion(region.id);
                }}
                onTap={() => {
                  if (canSelect) onSelectRegion(region.id);
                }}
              />
            </Group>
          );
        })}

      {renderRoutes && routes.map((route) => {
        const points = flattenPoints(getRoadRenderPoints(route.points, route.geometryMode));
        const selected = route.id === selectedRouteId;

        return (
          <Group key={route.id}>
            {selected && (
              <Line
                points={points}
                stroke="#111827"
                strokeWidth={11}
                opacity={0.25}
                lineCap="round"
                lineJoin="round"
                listening={false}
              />
            )}
            <Line
              points={points}
              stroke={route.color}
              strokeWidth={7}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
            <Line
              points={points}
              stroke="rgba(0,0,0,0)"
              strokeWidth={18}
              lineCap="round"
              lineJoin="round"
              hitStrokeWidth={24}
              onClick={() => {
                if (canSelect) onSelectRoute(route.id);
              }}
              onTap={() => {
                if (canSelect) onSelectRoute(route.id);
              }}
            />
          </Group>
        );
      })}

      {renderRoutes &&
        selectedRoute?.points.map((point, index) => (
          <Circle
            key={`${selectedRoute.id}-point-${index}`}
            x={point.x}
            y={point.y}
            radius={6}
            fill="#ffffff"
            stroke={selectedRoute.color}
            strokeWidth={3}
            draggable={canSelect}
            onDragStart={onDragStart}
            onDragMove={(event) => {
              const nextPoint = {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              };
              onRoutePointDragMove(selectedRoute.id, index, nextPoint);
            }}
            onDragEnd={(event) => {
              const nextPoint = {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              };
              onRoutePointDragEnd(selectedRoute.id, index, nextPoint);
            }}
          />
        ))}

      {renderRegions &&
        selectedRegion?.points.map((point, index) => (
          <Circle
            key={`${selectedRegion.id}-point-${index}`}
            x={point.x}
            y={point.y}
            radius={6}
            fill="#ffffff"
            stroke={selectedRegion.color}
            strokeWidth={3}
            draggable={canSelect}
            onDragStart={onDragStart}
            onDragMove={(event) => {
              const nextPoint = {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              };
              onRegionPointDragMove(selectedRegion.id, index, nextPoint);
            }}
            onDragEnd={(event) => {
              const nextPoint = {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              };
              onRegionPointDragEnd(selectedRegion.id, index, nextPoint);
            }}
          />
        ))}

      {renderStations && stations.map((station) => {
        const selected = station.id === selectedStationId;
        const stationType = station.stationType ?? "transfer";
        const stationColor = station.color ?? "#22c55e";
        const outerStroke = selected ? "#2563eb" : stationType === "normal" ? stationColor : "#111827";

        return (
          <Group
            key={station.id}
            x={station.point.x}
            y={station.point.y}
            draggable={canSelect}
            onDragStart={onDragStart}
            onDragMove={(event) => {
              onStationDragMove(station.id, {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              });
            }}
            onDragEnd={(event) => {
              onStationDragEnd(station.id, {
                x: Math.round(event.target.x()),
                y: Math.round(event.target.y()),
              });
            }}
            onClick={() => {
              if (canSelect) onSelectStation(station.id);
            }}
            onTap={() => {
              if (canSelect) onSelectStation(station.id);
            }}
          >
            <Circle radius={selected ? 11 : 10} fill="#ffffff" stroke={outerStroke} strokeWidth={3} />
            {stationType === "transfer" && <Circle radius={4.5} fill={selected ? "#2563eb" : "#111827"} />}
            <Text
              x={14}
              y={-12}
              width={120}
              text={station.name}
              fill="#ffffff"
              stroke="#ffffff"
              strokeWidth={4}
              fontSize={13}
              fontStyle="700"
              lineHeight={1.15}
              wrap="word"
              listening={false}
            />
            <Text
              x={14}
              y={-12}
              width={120}
              text={station.name}
              fill="#111827"
              fontSize={13}
              fontStyle="700"
              lineHeight={1.15}
              wrap="word"
            />
          </Group>
        );
      })}
    </Group>
  );
}
