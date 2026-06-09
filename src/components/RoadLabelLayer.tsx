import { Group, Text } from "react-konva";
import type { Road } from "../types/road";
import { getRoadLabelPlacement } from "../utils/roadLabel";
import { RouteBadge } from "./RouteBadge";

type RoadLabelLayerProps = {
  roads: Road[];
  zoom: number;
};

const FONT_SIZE = 13;
const BADGE_SIZE = 28;
const GAP = 6;

function getTextWidth(text: string): number {
  return Array.from(text).reduce((width, character) => {
    return width + (/[\u3400-\u9fff]/.test(character) ? 14 : 8);
  }, 0);
}

export function RoadLabelLayer({ roads, zoom }: RoadLabelLayerProps) {
  void zoom;

  return (
    <>
      {roads.map((road) => {
        if (road.showLabel === false) return null;

        const name = road.name?.trim() ?? "";
        const routeNumber = road.routeNumber?.trim() ?? "";
        const routeClass = road.routeClass ?? "none";
        const hasBadge = routeClass !== "none" && routeNumber.length > 0;
        const text = name || (!hasBadge ? routeNumber : "");

        if (!name && !routeNumber) return null;

        const placement = getRoadLabelPlacement(road);
        if (!placement) return null;

        const textWidth = getTextWidth(text);
        const totalWidth = (hasBadge ? BADGE_SIZE + GAP : 0) + textWidth;
        const startX = -totalWidth / 2;
        const textX = startX + (hasBadge ? BADGE_SIZE + GAP : 0);

        return (
          <Group
            key={`road-label-${road.id}`}
            x={placement.point.x}
            y={placement.point.y}
            rotation={placement.rotation}
            listening={false}
          >
            {hasBadge && (
              <RouteBadge
                routeClass={routeClass}
                routeNumber={routeNumber}
                x={startX + BADGE_SIZE / 2}
                y={0}
                scale={0.9}
              />
            )}
            {text && (
              <>
                <Text
                  text={text}
                  x={textX}
                  y={-FONT_SIZE / 2}
                  width={textWidth}
                  height={FONT_SIZE + 2}
                  fill="#ffffff"
                  stroke="#1f2937"
                  strokeWidth={2.4}
                  fontSize={FONT_SIZE}
                  listening={false}
                />
                <Text
                  text={text}
                  x={textX}
                  y={-FONT_SIZE / 2}
                  width={textWidth}
                  height={FONT_SIZE + 2}
                  fill="#ffffff"
                  fontSize={FONT_SIZE}
                  listening={false}
                />
              </>
            )}
          </Group>
        );
      })}
    </>
  );
}
