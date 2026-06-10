# Road Designer

Road Designer is a macOS desktop prototype for editing 2D road centerlines. It uses React, TypeScript, Tauri, and react-konva.

## Requirements

- macOS
- Node.js 18 or newer
- npm
- Rust toolchain from <https://rustup.rs/>
- Tauri macOS prerequisites, including Xcode Command Line Tools:

```sh
xcode-select --install
```

## Install

```sh
npm install
```

## Run Frontend Dev Mode

```sh
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://127.0.0.1:1420`.

## Run macOS Desktop App

```sh
npm run tauri dev
```

This starts the Vite dev server and opens the Tauri desktop window.

If this fails with `failed to run 'cargo metadata'` or `No such file or directory`, install Rust from <https://rustup.rs/> and restart the terminal so `cargo` is available in `PATH`.

## Build

```sh
npm run build
npm run tauri build
```

## Editor Workflow

- Use `Draw Road` to create a road.
- Click the canvas to add road nodes. Straight roads finish after 2 points, and curve roads finish after 4 points.
- Use `Transit Line` or `Curved Transit` to create solid public transit routes with the selected route color.
- Transit route nodes snap only to other transit route nodes.
- Use `Transfer` or `Normal` station to place station icons anywhere on the canvas. Select the station to edit its type and multiline name.
- Press `Esc` to cancel the current road.
- Use `Select` to pick an existing road.
- Drag selected node handles to reshape a road.
- Edit `roadType`, `width`, `lanes`, `divider`, `oneWay`, direction, and `zLevel` in the right properties panel. `Tunnel` roads use a lighter body with dashed edges while keeping the normal road controls.
- Set `Road kind = Connector` for ramp roads that connect endpoints to roads on different `zLevel` values.
- For connector roads, set `Start zLevel` and `End zLevel` to control which layer each endpoint joins.
- Use `Export JSON` to save the current project.
- Use `Import JSON` to load a saved project.

## Manual Intersection Tests

- Draw two local roads on the same `zLevel` so they cross in an X or plus shape. The crossing should show a continuous road intersection.
- Draw an arterial road and a local road on the same `zLevel` so they form a T or plus shape. Road bodies should overlap naturally, while markings stop near the crossing.
- Draw two roads that cross geometrically but assign different `zLevel` values. The higher road should pass over the lower road without an intersection treatment.
- Draw a `Draw Curve Road` bezier road crossing a polyline road on the same `zLevel`. The sampled curve should create a visual intersection at the crossing.
- Enable roads with `lanes > 1` and arterial `divider = true`. Lane markings and divider should not visibly run through the intersection center.
- Set a road's type to `Tunnel`. It should render with a lighter road body and dashed edge stroke while preserving normal lane markings, divider, labels, selection, and node editing.

## Manual Connector Road Tests

- Case 1: Draw a `zLevel = 0` local road, a `zLevel = 1` expressway/arterial road, and one connector road. Set the connector `Road kind = Connector`, `Start zLevel = 0`, and `End zLevel = 1`. Place the start endpoint on the local road and the end endpoint on the higher road. The connector start half should participate in `zLevel = 0` intersections, the end half should participate in `zLevel = 1` intersections, and the middle split point should be seamless without a black end cap or large overlay.
- Case 2: Set a connector to `Start zLevel = 0` and `End zLevel = 2`. The start half should render on `zLevel = 0`, the end half should render on `zLevel = 2`, and the middle should connect cleanly.
- Case 3: Cross a connector with a road on a different level than that connector segment. It should follow normal visual segment z-level behavior and should not create a cross-level overlay.
- Case 4: Cross two standard roads on the same `zLevel`. The existing same-level intersection behavior should remain unchanged.
- Case 5: Cross two standard roads on different `zLevel` values. They should still pass over/under without forming an intersection.

## Manual Label Tests

- Set `name = "中山高速公路"`, `routeClass = national_freeway`, and `routeNumber = "1"`. The road should show a green flower-style route badge with `1` and the road name.
- Set `routeClass = expressway` and `routeNumber = "64"`. The road should show a red shield badge with `64`.
- Set `routeClass = provincial_highway` and `routeNumber = "9"`. The road should show a blue shield badge with `9`.
- Draw a curve road and set a name or route badge. The label should follow the road direction near the center.
- Reverse a road direction by drawing it in the opposite direction. The label should remain readable and not appear upside down.
- Set `showLabel = false`. No route badge or road name should be shown for that road.

## Data Format

The MVP stores roads as custom JSON:

```ts
type Point = {
  x: number;
  y: number;
};

type RoadType = "local" | "arterial" | "tunnel";

type RoadKind = "standard" | "connector";

type OneWayDirection = "forward" | "reverse";

type RouteClass =
  | "none"
  | "national_freeway"
  | "expressway"
  | "provincial_highway";

type Road = {
  id: string;
  points: Point[];
  roadType: RoadType;
  width: number;
  lanes: number;
  divider: boolean;
  zLevel: number;
  geometryMode?: "polyline" | "bezier";
  kind?: RoadKind;
  startZLevel?: number;
  endZLevel?: number;
  oneWay?: boolean;
  oneWayDirection?: OneWayDirection;
  name?: string;
  routeClass?: RouteClass;
  routeNumber?: string;
  showLabel?: boolean;
};

type TransitRoute = {
  id: string;
  points: Point[];
  geometryMode?: "polyline" | "bezier";
  color: string;
};

type TransitStation = {
  id: string;
  point: Point;
  name: string;
  stationType?: "transfer" | "normal";
  color?: string;
};

type ProjectData = {
  version: 1;
  roads: Road[];
  transitRoutes?: TransitRoute[];
  transitStations?: TransitStation[];
};
```

GeoJSON export, real map basemaps, GIS projection, 3D terrain, traffic simulation, accounts, cloud sync, and database storage are intentionally out of scope for this first MVP.
