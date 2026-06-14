type ScaleBarProps = {
  zoom: number;
};

const SCALE_VALUES_METERS = [50, 100, 200, 500, 1000, 2000, 5000, 10000];
const TARGET_SCREEN_WIDTH = 120;

function formatScaleLabel(meters: number): string {
  if (meters >= 1000) {
    return `${meters / 1000} km`;
  }

  return `${meters} m`;
}

function getBestScaleMeters(zoom: number): number {
  return SCALE_VALUES_METERS.reduce((best, value) => {
    const bestDelta = Math.abs(best * zoom - TARGET_SCREEN_WIDTH);
    const valueDelta = Math.abs(value * zoom - TARGET_SCREEN_WIDTH);
    return valueDelta < bestDelta ? value : best;
  }, SCALE_VALUES_METERS[0]);
}

export function ScaleBar({ zoom }: ScaleBarProps) {
  const meters = getBestScaleMeters(zoom);
  const width = Math.max(42, Math.round(meters * zoom));

  return (
    <div className="scale-bar" aria-label={`Scale ${formatScaleLabel(meters)}`}>
      <div className="scale-bar-label">{formatScaleLabel(meters)}</div>
      <div className="scale-bar-track" style={{ width }} />
      <div className="scale-bar-grid-note">Grid 50 m</div>
    </div>
  );
}
