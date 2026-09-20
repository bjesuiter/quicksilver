import type { OutputTarget, SourceMedia } from "./media";

export type OutputTargetOption = {
  id: OutputTarget;
  title: string;
  detail: string;
  extension: string;
  mimeType: string;
  mediaType: "video" | "audio";
  videoCodec?: "avc" | "vp9" | "av1";
  audioCodec: "aac" | "opus";
};

const targets: Record<OutputTarget, OutputTargetOption> = {
  "avc-mp4": {
    id: "avc-mp4",
    title: "H.264 video",
    detail: "MP4 · best compatibility",
    extension: "mp4",
    mimeType: "video/mp4",
    mediaType: "video",
    videoCodec: "avc",
    audioCodec: "aac"
  },
  "vp9-webm": {
    id: "vp9-webm",
    title: "VP9 video",
    detail: "WebM · efficient for the web",
    extension: "webm",
    mimeType: "video/webm",
    mediaType: "video",
    videoCodec: "vp9",
    audioCodec: "opus"
  },
  "av1-webm": {
    id: "av1-webm",
    title: "AV1 video",
    detail: "WebM · smallest files when supported",
    extension: "webm",
    mimeType: "video/webm",
    mediaType: "video",
    videoCodec: "av1",
    audioCodec: "opus"
  },
  "aac-m4a": {
    id: "aac-m4a",
    title: "Audio only",
    detail: "AAC · M4A · broad compatibility",
    extension: "m4a",
    mimeType: "audio/mp4",
    mediaType: "audio",
    audioCodec: "aac"
  }
};

export function outputTarget(target: OutputTarget): OutputTargetOption {
  return targets[target];
}

export function outputTargetsFor(source: SourceMedia): OutputTargetOption[] {
  return source.mediaType === "video"
    ? [targets["avc-mp4"], targets["vp9-webm"], targets["av1-webm"], targets["aac-m4a"]]
    : [targets["aac-m4a"]];
}
