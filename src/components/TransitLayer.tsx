import { Circle, Group, Line, Text } from "react-konva";
import type { TransitRoute, TransitStation } from "../types/road";
import { flattenPoints, getRoadRenderPoints } from "../utils/roadGeometry";

type TransitLayerProps = {
  routes: TransitRoute[];
  stations: TransitStation[];
  selectedRouteId: string | null;
  selectedStationId: string | null;
  canSelect: boolean;
  onSelectRoute: (routeId: string | null) => void;
  onSelectStation: (stationId: string | null) => void;
  onDragStart: () => void;
  onRoutePointDragMove: (routeId: string, pointIndex: number, point: { x: number; y: number }) => void;
  onRoutePointDragEnd: (routeId: string, pointIndex: number, point: { x: number; y: number }) => void;
  onStationDragMove: (stationId: string, point: { x: number; y: number }) => void;
  onStationDragEnd: (stationId: string, point: { x: number; y: number }) => void;
};

export function TransitLayer({
  routes,
  stations,
  selectedRouteId,
  selectedStationId,
  canSelect,
  onSelectRoute,
  onSelectStation,
  onDragStart,
  onRoutePointDragMove,
  onRoutePointDragEnd,
  onStationDragMove,
  onStationDragEnd,
}: TransitLayerProps) {
  return (
    <Group>
      {routes.map((route) => {
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
            {selected &&
              route.points.map((point, index) => (
                <Circle
                  key={`${route.id}-point-${index}`}
                  x={point.x}
                  y={point.y}
                  radius={6}
                  fill="#ffffff"
                  stroke={route.color}
                  strokeWidth={3}
                  draggable={canSelect}
                  onDragStart={onDragStart}
                  onDragMove={(event) => {
                    const nextPoint = {
                      x: Math.round(event.target.x()),
                      y: Math.round(event.target.y()),
                    };
                    onRoutePointDragMove(route.id, index, nextPoint);
                  }}
                  onDragEnd={(event) => {
                    const nextPoint = {
                      x: Math.round(event.target.x()),
                      y: Math.round(event.target.y()),
                    };
                    onRoutePointDragEnd(route.id, index, nextPoint);
                  }}
                />
              ))}
          </Group>
        );
      })}

      {stations.map((station) => {
        const selected = station.id === selectedStationId;

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
            <Circle radius={selected ? 11 : 10} fill="#ffffff" stroke={selected ? "#2563eb" : "#111827"} strokeWidth={3} />
            <Circle radius={4.5} fill={selected ? "#2563eb" : "#111827"} />
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
