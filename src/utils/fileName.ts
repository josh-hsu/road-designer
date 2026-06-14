const DEFAULT_PROJECT_NAME = "road-designer";
const TIMESTAMP_SUFFIX_PATTERN = /(?:_\d{8}_\d{6})+$/;
const ILLEGAL_FILENAME_CHARS = /[\\/:*?"<>|]+/g;

export function getBaseName(fileName: string): string {
  const normalized = fileName.split(/[\\/]/).pop() ?? fileName;
  const extensionIndex = normalized.toLowerCase().endsWith(".json") ? normalized.length - 5 : normalized.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return normalized;
  }

  return normalized.slice(0, extensionIndex);
}

export function removeExistingTimestamp(baseName: string): string {
  return baseName.replace(TIMESTAMP_SUFFIX_PATTERN, "");
}

export function sanitizeFileNamePart(name: string): string {
  const sanitized = name
    .replace(ILLEGAL_FILENAME_CHARS, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/^[ ._-]+|[ ._-]+$/g, "");

  return sanitized || DEFAULT_PROJECT_NAME;
}

export function formatTimestamp(date = new Date()): string {
  const pad = (value: number) => value.toString().padStart(2, "0");

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "_",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("");
}

export function getProjectNameFromFileName(fileName: string): string {
  return sanitizeFileNamePart(removeExistingTimestamp(getBaseName(fileName)));
}

export function buildExportFileName(sourceFileName?: string, projectName?: string): string {
  const baseName = projectName?.trim() || (sourceFileName ? getBaseName(sourceFileName) : DEFAULT_PROJECT_NAME);
  const cleanBaseName = sanitizeFileNamePart(removeExistingTimestamp(baseName));
  return `${cleanBaseName}_${formatTimestamp()}.json`;
}
