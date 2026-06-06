import { Line } from "react-konva";
import type { Viewport } from "../utils/viewport";

type GridLayerProps = {
  width: number;
  height: number;
  viewport: Viewport;
  visible: boolean;
};

const GRID_SIZE = 50;

function getGridLines(size: number, offset: number, scale: number): number[] {
  const step = GRID_SIZE * scale;
  if (step < 4) return [];

  const lines: number[] = [];
  const start = ((offset % step) + step) % step;

  for (let position = start; position <= size; position += step) {
    lines.push(position);
  }

  return lines;
}

export function GridLayer({ width, height, viewport, visible }: GridLayerProps) {
  if (!visible) return null;

  const verticalLines = getGridLines(width, viewport.x, viewport.scale);
  const horizontalLines = getGridLines(height, viewport.y, viewport.scale);

  return (
    <>
      {verticalLines.map((x) => (
        <Line
          key={`v-${x}`}
          points={[x, 0, x, height]}
          stroke="#d7dde5"
          strokeWidth={1}
          listening={false}
        />
      ))}
      {horizontalLines.map((y) => (
        <Line
          key={`h-${y}`}
          points={[0, y, width, y]}
          stroke="#d7dde5"
          strokeWidth={1}
          listening={false}
        />
      ))}
    </>
  );
}
