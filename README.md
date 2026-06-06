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
