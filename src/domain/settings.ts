import type { OutputSettings, SourceMedia } from "./media";

const even = (value: number) => Math.max(2, Math.round(value / 2) * 2);

export function defaultOutputSettings(source: SourceMedia): OutputSettings {
  const scale = Math.min(1, 1920 / Math.max(source.width, source.height));
  const width = even(source.width * scale);
  const height = even(source.height * scale);
  const frameRate = Math.min(source.frameRate, 30);
  const workloadRatio = (width * height * frameRate) / (source.width * source.height * source.frameRate);
  const videoBitrate = Math.round(Math.max(250_000, source.videoBitrate * workloadRatio) / 10_000) * 10_000;

  return { width, height, frameRate, videoBitrate };
}

export function estimateOutputBytes(source: SourceMedia, settings: OutputSettings): number {
  if (source.mediaType === "audio") return (source.duration * 192_000 * 1.02) / 8;
  return (source.duration * (settings.videoBitrate + source.audioBitrate) * 1.02) / 8;
}

export function linkedHeight(source: SourceMedia, width: number): number {
  return even((width * source.height) / source.width);
}

export function linkedWidth(source: SourceMedia, height: number): number {
  return even((height * source.width) / source.height);
}

export function isValidOutput(settings: OutputSettings): boolean {
  return (
    Number.isInteger(settings.width) &&
    settings.width >= 2 &&
    settings.width <= 8192 &&
    Number.isInteger(settings.height) &&
    settings.height >= 2 &&
    settings.height <= 8192 &&
    Number.isFinite(settings.frameRate) &&
    settings.frameRate >= 1 &&
    settings.frameRate <= 120 &&
    Number.isFinite(settings.videoBitrate) &&
    settings.videoBitrate >= 100_000 &&
    settings.videoBitrate <= 100_000_000
  );
}
