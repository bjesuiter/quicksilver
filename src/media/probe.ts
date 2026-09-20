import { BlobSource, Input, MP4, QTFF } from "mediabunny";

import type { SourceMedia } from "../domain/media";
import { fingerprintMedia } from "./fingerprint";

export type MediaSession = {
  file: File;
  input: Input;
  source: SourceMedia;
  dispose: () => void;
};

export async function probeMedia(file: File): Promise<MediaSession> {
  const input = new Input({
    source: new BlobSource(file),
    formats: [MP4, QTFF]
  });

  try {
    if (!(await input.canRead())) {
      throw new Error("This file is not a readable MOV or MP4 video.");
    }

    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error("This file does not contain a video track.");
    }

    const audioTrack = await input.getPrimaryAudioTrack();
    const [
      width,
      height,
      duration,
      frameRateMetrics,
      videoStats,
      codec,
      hasHighDynamicRange,
      canDecode,
      audioStats
    ] = await Promise.all([
      videoTrack.getDisplayWidth(),
      videoTrack.getDisplayHeight(),
      input.computeDuration(),
      videoTrack.computeFrameRateMetrics(),
      videoTrack.computePacketStats(),
      videoTrack.getCodec(),
      videoTrack.hasHighDynamicRange(),
      videoTrack.canDecode(),
      audioTrack?.computePacketStats() ?? Promise.resolve(null)
    ]);

    const metadata = {
      duration,
      width,
      height,
      frameRate: frameRateMetrics.bestGuessFrameRate,
      videoBitrate: videoStats.averageBitrate,
      codec: codec ?? "unknown"
    };
    const identity = await fingerprintMedia(file, metadata);

    return {
      file,
      input,
      source: {
        identity,
        fileName: file.name,
        fileSize: file.size,
        ...metadata,
        audioBitrate: audioStats?.averageBitrate ?? 192_000,
        hasHighDynamicRange,
        canDecode
      },
      dispose: () => input.dispose()
    };
  } catch (error) {
    input.dispose();
    throw error;
  }
}
