import {
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

  const quality = new Quality({ bitrate: settings.videoBitrate, bitrateMode: "variable" });
  const canEncode = await canEncodeVideo("avc", {
    width: settings.width,
    height: settings.height,
    frameRate: settings.frameRate,
    quality,
    hardwareAcceleration: "prefer-hardware"
  });

  if (!canEncode) {
    throw new Error("This browser cannot encode H.264 with the selected settings.");
  }

  const estimatedBytes = (session.source.duration * (settings.videoBitrate + session.source.audioBitrate) * 1.02) / 8;
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
    video: {
      codec: "avc",
      width: settings.width,
      height: settings.height,
      fit: "contain",
      frameRate: settings.frameRate,
      quality,
      hardwareAcceleration: "prefer-hardware",
      forceTranscode: true
    },
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
        return await storage.getFile(outputName(session.file.name));
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

export function outputName(inputName: string): string {
  const base = inputName.replace(/\.(mov|mp4)$/i, "");
  return `${base || "video"}-quicksilver.mp4`;
}
