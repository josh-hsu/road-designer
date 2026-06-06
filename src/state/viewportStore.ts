import { useCallback, useState } from "react";
import type { Point } from "../types/road";
import type { Viewport } from "../utils/viewport";
import { zoomViewportAtPoint } from "../utils/viewport";

const initialViewport: Viewport = {
  x: 0,
  y: 0,
  scale: 1,
};

export function useViewportStore() {
  const [viewport, setViewport] = useState<Viewport>(initialViewport);

  const panBy = useCallback((delta: Point) => {
    setViewport((current) => ({
      ...current,
      x: current.x + delta.x,
      y: current.y + delta.y,
    }));
  }, []);

  const zoomAt = useCallback((screenPoint: Point, nextScale: number) => {
    setViewport((current) => zoomViewportAtPoint(current, screenPoint, nextScale));
  }, []);

  return {
    viewport,
    panBy,
    zoomAt,
  };
}
