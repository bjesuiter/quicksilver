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

export type SourceImage = {
  mediaType: "image";
  file: File;
  width: number;
  height: number;
};

export type SourceFile = SourceMedia | SourceImage;

export type OutputSettings = {
  target: OutputTarget;
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
};

export type OutputTarget = "avc-mp4" | "vp9-webm" | "av1-webm" | "aac-m4a" | "jpeg" | "png" | "webp" | "avif";
export type ImageTarget = Extract<OutputTarget, "jpeg" | "png" | "webp" | "avif">;
