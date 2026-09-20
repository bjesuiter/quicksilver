const SAMPLE_SIZE = 64 * 1024;

type FingerprintMetadata = {
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  videoBitrate: number;
  codec: string;
};

export async function fingerprintMedia(file: File, metadata: FingerprintMetadata): Promise<string> {
  const lastSampleStart = Math.max(0, file.size - SAMPLE_SIZE);
  const sampleStarts = [...new Set([0, Math.floor(lastSampleStart / 2), lastSampleStart])];
  const samples = await Promise.all(
    sampleStarts.map((start) => file.slice(start, Math.min(file.size, start + SAMPLE_SIZE)).arrayBuffer())
  );
  const description = new TextEncoder().encode(
    JSON.stringify({
      version: 1,
      size: file.size,
      duration: metadata.duration,
      width: metadata.width,
      height: metadata.height,
      frameRate: metadata.frameRate,
      videoBitrate: metadata.videoBitrate,
      codec: metadata.codec
    })
  );
  const bytes = new Uint8Array(description.byteLength + samples.reduce((total, sample) => total + sample.byteLength, 0));
  bytes.set(description);
  let offset = description.byteLength;
  for (const sample of samples) {
    bytes.set(new Uint8Array(sample), offset);
    offset += sample.byteLength;
  }

  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return `v1:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}
