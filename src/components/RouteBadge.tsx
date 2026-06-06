import { Group, Shape, Text } from "react-konva";
import type { RouteClass } from "../types/road";

type RouteBadgeProps = {
  routeClass: RouteClass;
  routeNumber: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
};

function getBadgeFill(routeClass: RouteClass): string {
  if (routeClass === "national_freeway") return "#0f8b4c";
  if (routeClass === "expressway") return "#c92a2a";
  if (routeClass === "provincial_highway") return "#1d5fbf";
  return "transparent";
}

export function RouteBadge({ routeClass, routeNumber, x, y, rotation = 0, scale = 1 }: RouteBadgeProps) {
  if (routeClass === "none" || !routeNumber.trim()) return null;

  const fill = getBadgeFill(routeClass);

  return (
    <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale} listening={false}>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();

          if (routeClass === "national_freeway") {
            const petals = 6;
            for (let index = 0; index <= petals * 2; index += 1) {
              const angle = (-Math.PI / 2) + (index * Math.PI) / petals;
              const radius = index % 2 === 0 ? 13 : 9;
              const px = Math.cos(angle) * radius;
              const py = Math.sin(angle) * radius;
              if (index === 0) context.moveTo(px, py);
              else context.lineTo(px, py);
            }
          } else {
            context.moveTo(-13, -11);
            context.lineTo(13, -11);
            context.lineTo(11, 4);
            context.quadraticCurveTo(8, 12, 0, 15);
            context.quadraticCurveTo(-8, 12, -11, 4);
            context.closePath();
          }

          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={2}
      />
      <Text
        text={routeNumber}
        x={-13}
        y={-7}
        width={26}
        height={16}
        align="center"
        verticalAlign="middle"
        fill="#ffffff"
        fontSize={routeNumber.length > 2 ? 10 : 12}
        fontStyle="bold"
        listening={false}
      />
    </Group>
  );
}
