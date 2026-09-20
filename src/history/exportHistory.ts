import type { OutputSettings } from "../domain/media";

export type ExportRecord = {
  settings: OutputSettings;
  outputSize: number;
};

type ExportHistory = Record<string, ExportRecord[]>;

const STORAGE_KEY = "quicksilver:export-history:v1";
const MAX_FILES = 50;
const MAX_EXPORTS_PER_FILE = 12;

export function readExportHistory(identity: string): ExportRecord[] {
  return readStore()[identity] ?? [];
}

export function rememberExport(identity: string, record: ExportRecord): ExportRecord[] {
  const store = readStore();
  const records = store[identity] ?? [];
  const nextRecords = [
    record,
    ...records.filter((candidate) => !sameSettings(candidate.settings, record.settings))
  ].slice(0, MAX_EXPORTS_PER_FILE);
  const nextStore = Object.fromEntries(
    [[identity, nextRecords], ...Object.entries(store).filter(([key]) => key !== identity)].slice(0, MAX_FILES)
  );

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextStore));
  } catch {
    // Conversion should still succeed if storage is unavailable or full.
  }

  return nextRecords;
}

function readStore(): ExportHistory {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return value as ExportHistory;
  } catch {
    return {};
  }
}

function sameSettings(left: OutputSettings, right: OutputSettings): boolean {
  return left.width === right.width
    && left.height === right.height
    && left.frameRate === right.frameRate
    && left.videoBitrate === right.videoBitrate;
}
