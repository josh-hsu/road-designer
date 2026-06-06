import type { Point } from "../types/road";

type StatusBarProps = {
  mouseWorldPoint: Point | null;
  zoom: number;
};

export function StatusBar({ mouseWorldPoint, zoom }: StatusBarProps) {
  const coordinateText = mouseWorldPoint
    ? `X ${Math.round(mouseWorldPoint.x)}  Y ${Math.round(mouseWorldPoint.y)}`
    : "X -  Y -";

  return (
    <div className="status-bar">
      <span>{coordinateText}</span>
      <span>Zoom {Math.round(zoom * 100)}%</span>
    </div>
  );
}
