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
- Click the canvas to add road nodes.
- Press `Enter` to finish the current polyline road.
- Press `Esc` to cancel the current road.
- Use `Select` to pick an existing road.
- Drag selected node handles to reshape a road.
- Edit `roadType`, `width`, `lanes`, `divider`, and `zLevel` in the right properties panel.
- Use `Export JSON` to save the current project.
- Use `Import JSON` to load a saved project.

## Manual Intersection Tests

- Draw two local roads on the same `zLevel` so they cross in an X or plus shape. The crossing should show a continuous road intersection.
- Draw an arterial road and a local road on the same `zLevel` so they form a T or plus shape. Road bodies should overlap naturally, while markings stop near the crossing.
- Draw two roads that cross geometrically but assign different `zLevel` values. The higher road should pass over the lower road without an intersection treatment.
- Draw a `Draw Curve Road` bezier road crossing a polyline road on the same `zLevel`. The sampled curve should create a visual intersection at the crossing.
- Enable roads with `lanes > 1` and arterial `divider = true`. Lane markings and divider should not visibly run through the intersection center.

## Data Format

The MVP stores roads as custom JSON:

```ts
type Point = {
  x: number;
  y: number;
};

type RoadType = "local" | "arterial";

type Road = {
  id: string;
  points: Point[];
  roadType: RoadType;
  width: number;
  lanes: number;
  divider: boolean;
  zLevel: number;
};

type ProjectData = {
  version: 1;
  roads: Road[];
};
```

GeoJSON export, real map basemaps, GIS projection, 3D terrain, traffic simulation, accounts, cloud sync, and database storage are intentionally out of scope for this first MVP.
