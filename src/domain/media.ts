export type SourceMedia = {
  mediaType: "video" | "audio";
  identity: string;
  fileName: string;
  fileSize: number;
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
  audioBitrate: number;
  hasAudio: boolean;
  codec: string;
  hasHighDynamicRange: boolean;
  canDecode: boolean;
};

export type OutputSettings = {
  target: OutputTarget;
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
};

export type OutputTarget = "avc-mp4" | "vp9-webm" | "av1-webm" | "aac-m4a";
