import {
  canEncodeAudio,
  canEncodeVideo,
  Conversion,
  Mp4OutputFormat,
  Output,
  Quality
} from "mediabunny";

import type { OutputSettings } from "../domain/media";
import type { MediaSession } from "./probe";
import { createOutputStorage } from "./targets";

export type ConversionProgress = {
  fraction: number;
  processedTime: number;
  bytesWritten: number;
};

export type ConversionJob = {
  execute: () => Promise<File>;
  cancel: () => Promise<void>;
};

export async function createConversionJob(
  session: MediaSession,
  settings: OutputSettings,
  onProgress: (progress: ConversionProgress) => void
): Promise<ConversionJob> {
  const testTranscoder = import.meta.env.DEV ? window.__QUICKSILVER_TEST_TRANSCODER__ : undefined;
  if (testTranscoder) {
    let canceled = false;
    return {
      execute: () =>
        testTranscoder({
          input: session.file,
          outputName: outputName(session.file.name),
          settings,
          onProgress,
          isCanceled: () => canceled
        }),
      cancel: async () => {
        canceled = true;
      }
    };
  }

  const isAudio = session.source.mediaType === "audio";
  const quality = new Quality({ bitrate: isAudio ? 192_000 : settings.videoBitrate, bitrateMode: "variable" });
  if (isAudio) {
    const canEncode = await canEncodeAudio("aac", { quality });
    if (!canEncode) throw new Error("This browser cannot encode AAC audio. Try a browser with WebCodecs audio support.");
  }
  const canEncode = !isAudio && await canEncodeVideo("avc", {
    width: settings.width,
    height: settings.height,
    frameRate: settings.frameRate,
    quality,
    hardwareAcceleration: "prefer-hardware"
  });

  if (!isAudio && !canEncode) {
    throw new Error("This browser cannot encode H.264 with the selected settings.");
  }

  const estimatedBytes = (session.source.duration * (isAudio ? 192_000 : settings.videoBitrate + session.source.audioBitrate) * 1.02) / 8;
  const storage = await createOutputStorage(estimatedBytes);
  const target = storage.target;
  const output = new Output({
    format: new Mp4OutputFormat(),
    target
  });
  const conversion = await Conversion.init({
    input: session.input,
    output,
    tracks: "primary",
    video: isAudio ? { discard: true } : {
      codec: "avc",
      width: settings.width,
      height: settings.height,
      fit: "contain",
      frameRate: settings.frameRate,
      quality,
      hardwareAcceleration: "prefer-hardware",
      forceTranscode: true
    },
    audio: isAudio ? { codec: "aac", quality, forceTranscode: true } : undefined,
    showWarnings: false
  });

  if (!conversion.isValid) {
    const reasons = [...new Set(conversion.discardedTracks.map(({ reason }) => reason.replaceAll("_", " ")))];
    throw new Error(`The video cannot be converted${reasons.length ? `: ${reasons.join(", ")}` : "."}`);
  }

  let fraction = 0;
  let processedTime = 0;
  let bytesWritten = 0;
  const report = () => onProgress({ fraction, processedTime, bytesWritten });

  conversion.onProgress = (nextFraction, nextProcessedTime) => {
    fraction = nextFraction;
    processedTime = nextProcessedTime;
    report();
  };
  target.on("write", ({ end }) => {
    bytesWritten = Math.max(bytesWritten, end);
    report();
  });

  return {
    execute: async () => {
      try {
        await conversion.execute();
        return await storage.getFile(outputName(session.file.name, session.source.mediaType), isAudio ? "audio/mp4" : "video/mp4");
      } finally {
        await storage.cleanup();
      }
    },
    cancel: async () => {
      await conversion.cancel();
      await storage.cleanup();
    }
  };
}

export function outputName(inputName: string, mediaType: "video" | "audio" = "video"): string {
  const base = inputName.replace(/\.(mov|mp4|m4v|webm|mkv|mp3|wav|aac|ogg|oga|flac|ts)$/i, "");
  return `${base || mediaType}-quicksilver.${mediaType === "audio" ? "m4a" : "mp4"}`;
}
