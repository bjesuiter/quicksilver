import { ADTS, BlobSource, FLAC, Input, MATROSKA, MP3, MP4, MPEG_TS, OGG, QTFF, WAVE, WEBM } from "mediabunny";

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
    formats: [MP4, QTFF, WEBM, MATROSKA, MP3, WAVE, ADTS, OGG, FLAC, MPEG_TS]
  });

  try {
    if (!(await input.canRead())) {
      throw new Error("This file is not a supported media file. Choose MP4, MOV, WebM, MKV, MP3, WAV, AAC, Ogg, FLAC, or MPEG-TS media.");
    }

    const videoTrack = await input.getPrimaryVideoTrack();
    const audioTrack = await input.getPrimaryAudioTrack();
    if (!videoTrack && !audioTrack) throw new Error("This media file does not contain a video or audio track.");

    if (!videoTrack) {
      const [duration, audioStats, codec, canDecode] = await Promise.all([
        input.computeDuration(),
        audioTrack!.computePacketStats(),
        audioTrack!.getCodec(),
        audioTrack!.canDecode()
      ]);
      const metadata = { duration, width: 0, height: 0, frameRate: 0, videoBitrate: 0, codec: codec ?? "unknown" };
      const identity = await fingerprintMedia(file, metadata);
      return {
        file,
        input,
        source: {
          mediaType: "audio",
          identity,
          fileName: file.name,
          fileSize: file.size,
          ...metadata,
          audioBitrate: audioStats.averageBitrate || 192_000,
          hasHighDynamicRange: false,
          canDecode
        },
        dispose: () => input.dispose()
      };
    }
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
        mediaType: "video",
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
