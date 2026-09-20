export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(bytes / 1_000_000)} MB`;
}

export function formatBitrate(bitsPerSecond: number): string {
  return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(bitsPerSecond / 1_000_000)} Mbps`;
}

export function formatFrameRate(frameRate: number): string {
  return new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(frameRate);
}

export function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}
