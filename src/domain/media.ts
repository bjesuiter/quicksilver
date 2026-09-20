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
  codec: string;
  hasHighDynamicRange: boolean;
  canDecode: boolean;
};

export type OutputSettings = {
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
};
