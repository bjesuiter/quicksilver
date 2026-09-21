import {
  canEncodeAudio,
  canEncodeVideo,
  Conversion,
  Mp3OutputFormat,
  FlacOutputFormat,
  Mp4OutputFormat,
  Output,
  Quality,
  WebMOutputFormat
} from "mediabunny";
import { registerMp3Encoder } from "@mediabunny/mp3-encoder";
import { registerFlacEncoder } from "@mediabunny/flac-encoder";

import type { OutputSettings } from "../domain/media";
import { outputTarget } from "../domain/outputTarget";
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

let mp3EncoderRegistered = false;

async function canEncodeMp3(numberOfChannels: number, sampleRate: number, quality: Quality): Promise<boolean> {
  const config = { numberOfChannels, sampleRate, quality };
  if (await canEncodeAudio("mp3", config)) return true;

  if (!mp3EncoderRegistered) {
    registerMp3Encoder();
    mp3EncoderRegistered = true;
  }

  return canEncodeAudio("mp3", config);
}

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
          outputName: outputName(session.file.name, settings.target),
          settings,
          onProgress,
          isCanceled: () => canceled
        }),
      cancel: async () => {
        canceled = true;
      }
    };
  }

  const targetFormat = outputTarget(settings.target);
  const isAudio = targetFormat.mediaType === "audio";
  const isFlac = targetFormat.id === "flac";
  const videoQuality = isAudio ? undefined : new Quality({ bitrate: settings.videoBitrate, bitrateMode: "variable" });
  const audioQuality = new Quality({
    bitrate: targetFormat.audioCodec === "mp3" ? settings.audioBitrate : targetFormat.audioCodec === "opus" ? 128_000 : 192_000,
    bitrateMode: targetFormat.audioCodec === "mp3" ? "constant" : "variable"
  });

  if (isFlac && !(await canEncodeAudio("flac"))) registerFlacEncoder();

  if (session.source.hasAudio) {
    const canEncodeAudioTrack = isFlac
      ? await canEncodeAudio("flac")
      : targetFormat.audioCodec === "mp3"
      ? await canEncodeMp3(session.source.audioNumberOfChannels, session.source.audioSampleRate, audioQuality)
      : await canEncodeAudio(targetFormat.audioCodec, { quality: audioQuality });
    if (!canEncodeAudioTrack) throw new Error(`This browser cannot encode ${targetFormat.audioCodec.toUpperCase()} audio. Try a browser with WebCodecs audio support.`);
  }
  const canEncode = !isAudio && await canEncodeVideo(targetFormat.videoCodec!, {
    width: settings.width,
    height: settings.height,
    frameRate: settings.frameRate,
    quality: videoQuality!,
    hardwareAcceleration: "prefer-hardware"
  });

  if (!isAudio && !canEncode) {
    throw new Error(`This browser cannot encode ${targetFormat.title} with the selected settings.`);
  }

  const estimatedBytes = isFlac
    ? session.source.fileSize
    : (session.source.duration * (isAudio ? settings.audioBitrate : settings.videoBitrate + (session.source.hasAudio ? session.source.audioBitrate : 0)) * 1.02) / 8;
  const storage = await createOutputStorage(estimatedBytes, targetFormat.extension);
  const target = storage.target;
  const output = new Output({
    format: isFlac
      ? new FlacOutputFormat({ appendOnly: false })
      : targetFormat.id === "mp3"
      ? new Mp3OutputFormat({ xingHeader: true })
      : targetFormat.id === "avc-mp4" || targetFormat.id === "aac-m4a" ? new Mp4OutputFormat() : new WebMOutputFormat(),
    target
  });
  const conversion = await Conversion.init({
    input: session.input,
    output,
    tracks: "primary",
    video: isAudio ? { discard: true } : {
      codec: targetFormat.videoCodec!,
      width: settings.width,
      height: settings.height,
      fit: "contain",
      frameRate: settings.frameRate,
      quality: videoQuality!,
      hardwareAcceleration: "prefer-hardware",
      forceTranscode: true
    },
    audio: session.source.hasAudio
      ? isFlac
        ? { codec: "flac", forceTranscode: true }
        : { codec: targetFormat.audioCodec, quality: audioQuality, forceTranscode: true }
      : { discard: true },
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
        return await storage.getFile(outputName(session.file.name, settings.target), targetFormat.mimeType);
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

export function outputName(inputName: string, target: OutputSettings["target"] = "avc-mp4"): string {
  const base = inputName.replace(/\.(mov|mp4|m4v|webm|mkv|mp3|wav|aac|ogg|oga|flac|ts)$/i, "");
  const format = outputTarget(target);
  return `${base || format.mediaType}-quicksilver.${format.extension}`;
}
