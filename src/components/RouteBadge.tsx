import { Circle, Group, Shape, Text } from "react-konva";
import type { RouteClass } from "../types/road";

type RouteBadgeProps = {
  routeClass: RouteClass;
  routeNumber: string;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
};

function CloverLayer({ radius, fill }: { radius: number; fill: string }) {
  const lobes = Array.from({ length: 5 }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 5;
    return {
      x: Math.cos(angle) * 6.2,
      y: Math.sin(angle) * 6.2,
    };
  });

  return (
    <>
      {lobes.map((lobe) => (
        <Circle key={`${fill}-${lobe.x}-${lobe.y}-${radius}`} x={lobe.x} y={lobe.y} radius={radius} fill={fill} />
      ))}
      <Circle x={0} y={0} radius={radius * 0.85} fill={fill} />
    </>
  );
}

function RoundedTriangleShield({ fill, routeNumber }: { fill: string; routeNumber: string }) {
  return (
    <>
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(-11, -13);
          context.quadraticCurveTo(0, -15, 11, -13);
          context.quadraticCurveTo(17, -11, 17, -2);
          context.quadraticCurveTo(15, 8, 6, 15);
          context.quadraticCurveTo(0, 19, -6, 15);
          context.quadraticCurveTo(-15, 8, -17, -2);
          context.quadraticCurveTo(-17, -11, -11, -13);
          context.closePath();
          context.fillStrokeShape(shape);
        }}
        fill={fill}
        stroke="#ffffff"
        strokeWidth={2.5}
      />
      <Shape
        sceneFunc={(context, shape) => {
          context.beginPath();
          context.moveTo(-9, -10);
          context.quadraticCurveTo(0, -12, 9, -10);
          context.quadraticCurveTo(13, -8, 13, -2);
          context.quadraticCurveTo(12, 6, 5, 12);
          context.quadraticCurveTo(0, 15, -5, 12);
          context.quadraticCurveTo(-12, 6, -13, -2);
          context.quadraticCurveTo(-13, -8, -9, -10);
          context.closePath();
          context.strokeShape(shape);
        }}
        stroke="#ffffff"
        strokeWidth={1.5}
      />
      <Text
        text={routeNumber}
        x={-13}
        y={-8}
        width={26}
        height={18}
        align="center"
        verticalAlign="middle"
        fill="#ffffff"
        fontSize={routeNumber.length > 2 ? 10 : 14}
        fontStyle="bold"
        listening={false}
      />
    </>
  );
}

export function RouteBadge({ routeClass, routeNumber, x, y, rotation = 0, scale = 1 }: RouteBadgeProps) {
  if (routeClass === "none" || !routeNumber.trim()) return null;

  if (routeClass === "national_freeway") {
    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale} listening={false}>
        <CloverLayer radius={10.5} fill="#ffffff" />
        <CloverLayer radius={8.2} fill="#07833a" />
        <CloverLayer radius={5.8} fill="#ffffff" />
        <Text
          text={routeNumber}
          x={-13}
          y={-8}
          width={26}
          height={17}
          align="center"
          verticalAlign="middle"
          fill="#111111"
          fontSize={routeNumber.length > 2 ? 11 : 14}
          fontStyle="bold"
          listening={false}
        />
      </Group>
    );
  }

  if (routeClass === "expressway" || routeClass === "provincial_highway") {
    return (
      <Group x={x} y={y} rotation={rotation} scaleX={scale} scaleY={scale} listening={false}>
        <RoundedTriangleShield fill={routeClass === "expressway" ? "#c92a2a" : "#0b4a86"} routeNumber={routeNumber} />
      </Group>
    );
  }

  return null;
}
