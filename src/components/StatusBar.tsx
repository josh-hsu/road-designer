import type { Point } from "../types/road";

type StatusBarProps = {
  mouseWorldPoint: Point | null;
  zoom: number;
  projectName?: string;
  sourceFileName?: string;
};

export function StatusBar({ mouseWorldPoint, zoom, projectName = "road-designer", sourceFileName }: StatusBarProps) {
  const coordinateText = mouseWorldPoint
    ? `X ${Math.round(mouseWorldPoint.x)}  Y ${Math.round(mouseWorldPoint.y)}`
    : "X -  Y -";

  return (
    <div className="status-bar">
      <span>Project: {projectName || "road-designer"}</span>
      <span>File: {sourceFileName || "Untitled"}</span>
      <span>{coordinateText}</span>
      <span>Zoom {Math.round(zoom * 100)}%</span>
    </div>
  );
}
