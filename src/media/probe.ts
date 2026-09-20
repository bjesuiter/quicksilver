import { BlobSource, Input, MP4, QTFF } from "mediabunny";

import type { SourceMedia } from "../domain/media";

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

    return {
      file,
      input,
      source: {
        fileName: file.name,
        fileSize: file.size,
        duration,
        width,
        height,
        frameRate: frameRateMetrics.bestGuessFrameRate,
        videoBitrate: videoStats.averageBitrate,
        audioBitrate: audioStats?.averageBitrate ?? 192_000,
        codec: codec ?? "unknown",
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
