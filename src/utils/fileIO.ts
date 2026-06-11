import type { ProjectData, Road } from "../types/road";

type TauriWindow = Window & {
  __TAURI_INTERNALS__?: unknown;
};

const isTauri = () => Boolean((window as TauriWindow).__TAURI_INTERNALS__);

function isValidRouteClass(value: unknown): boolean {
  return (
    value === undefined ||
    value === "none" ||
    value === "national_freeway" ||
    value === "expressway" ||
    value === "provincial_highway"
  );
}

function isValidRoadKind(value: unknown): boolean {
  return value === undefined || value === "standard" || value === "connector";
}

function isValidOneWayDirection(value: unknown): boolean {
  return value === undefined || value === "forward" || value === "reverse";
}

function validateProjectData(value: unknown): ProjectData {
  if (!value || typeof value !== "object") {
    throw new Error("JSON root must be an object.");
  }

  const project = value as ProjectData;
  if (project.version !== 1 || !Array.isArray(project.roads)) {
    throw new Error("Expected ProjectData with version 1 and roads array.");
  }

  project.roads.forEach((road: Road, index: number) => {
    if (
      typeof road.id !== "string" ||
      !Array.isArray(road.points) ||
      (road.roadType !== "local" && road.roadType !== "arterial" && road.roadType !== "tunnel") ||
      typeof road.width !== "number" ||
      typeof road.lanes !== "number" ||
      typeof road.divider !== "boolean" ||
      typeof road.zLevel !== "number" ||
      (road.geometryMode !== undefined && road.geometryMode !== "polyline" && road.geometryMode !== "bezier") ||
      !isValidRoadKind(road.kind) ||
      (road.startZLevel !== undefined && typeof road.startZLevel !== "number") ||
      (road.endZLevel !== undefined && typeof road.endZLevel !== "number") ||
      (road.oneWay !== undefined && typeof road.oneWay !== "boolean") ||
      !isValidOneWayDirection(road.oneWayDirection) ||
      (road.name !== undefined && typeof road.name !== "string") ||
      !isValidRouteClass(road.routeClass) ||
      (road.routeNumber !== undefined && typeof road.routeNumber !== "string") ||
      (road.showLabel !== undefined && typeof road.showLabel !== "boolean")
    ) {
      throw new Error(`Invalid road at index ${index}.`);
    }
  });

  (project.transitRoutes ?? []).forEach((route, index) => {
    if (
      typeof route.id !== "string" ||
      !Array.isArray(route.points) ||
      (route.geometryMode !== undefined && route.geometryMode !== "polyline" && route.geometryMode !== "bezier") ||
      typeof route.color !== "string"
    ) {
      throw new Error(`Invalid transit route at index ${index}.`);
    }
  });

  (project.transitRegions ?? []).forEach((region, index) => {
    if (
      typeof region.id !== "string" ||
      !Array.isArray(region.points) ||
      region.points.length < 3 ||
      region.points.length > 10 ||
      typeof region.color !== "string"
    ) {
      throw new Error(`Invalid transit region at index ${index}.`);
    }
  });

  (project.transitStations ?? []).forEach((station, index) => {
    if (
      typeof station.id !== "string" ||
      !station.point ||
      typeof station.point.x !== "number" ||
      typeof station.point.y !== "number" ||
      typeof station.name !== "string" ||
      (station.stationType !== undefined && station.stationType !== "transfer" && station.stationType !== "normal") ||
      (station.color !== undefined && typeof station.color !== "string")
    ) {
      throw new Error(`Invalid transit station at index ${index}.`);
    }
  });

  return {
    version: 1,
    roads: project.roads.map((road) => ({
      ...road,
      geometryMode: road.geometryMode ?? "polyline",
      kind: road.kind ?? "standard",
      startZLevel: road.startZLevel ?? road.zLevel,
      endZLevel: road.endZLevel ?? road.zLevel,
      oneWay: road.oneWay ?? false,
      oneWayDirection: road.oneWayDirection ?? "forward",
      name: road.name ?? "",
      routeClass: road.routeClass ?? "none",
      routeNumber: road.routeNumber ?? "",
      showLabel: road.showLabel ?? true,
    })),
    transitRoutes: (project.transitRoutes ?? []).map((route) => ({
      ...route,
      geometryMode: route.geometryMode ?? "polyline",
      color: route.color ?? "#22c55e",
    })),
    transitRegions: (project.transitRegions ?? []).map((region) => ({
      ...region,
      color: region.color ?? "#22c55e",
    })),
    transitStations: (project.transitStations ?? []).map((station) => ({
      ...station,
      name: station.name ?? "Station",
      stationType: station.stationType ?? "transfer",
      color: station.color ?? "#22c55e",
    })),
  };
}

export async function exportProjectData(project: ProjectData): Promise<void> {
  const content = JSON.stringify(project, null, 2);

  if (isTauri()) {
    const [{ save }, { invoke }] = await Promise.all([
      import("@tauri-apps/plugin-dialog"),
      import("@tauri-apps/api/core"),
    ]);
    const path = await save({
      title: "Export road project",
      defaultPath: "road-project.json",
      filters: [{ name: "JSON", extensions: ["json"] }],
    });

    if (path) {
      await invoke("write_project_file", { path, contents: content });
    }
    return;
  }

  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "road-project.json";
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function importProjectDataFromFile(file: File): Promise<ProjectData> {
  const text = await file.text();
  return validateProjectData(JSON.parse(text));
}

export async function importProjectDataWithDialog(): Promise<ProjectData | null> {
  if (!isTauri()) {
    return null;
  }

  const [{ open }, { invoke }] = await Promise.all([
    import("@tauri-apps/plugin-dialog"),
    import("@tauri-apps/api/core"),
  ]);
  const path = await open({
    title: "Import road project",
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });

  if (!path || Array.isArray(path)) {
    return null;
  }

  const text = await invoke<string>("read_project_file", { path });
  return validateProjectData(JSON.parse(text));
}
