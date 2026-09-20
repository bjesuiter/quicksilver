import { BufferTarget, StreamTarget, type StreamTargetChunk, type Target } from "mediabunny";

const IN_MEMORY_LIMIT = 100_000_000;

export type OutputStorage = {
  target: Target;
  getFile: (name: string) => Promise<File>;
  cleanup: () => Promise<void>;
};

export async function createOutputStorage(estimatedBytes: number): Promise<OutputStorage> {
  if (estimatedBytes < IN_MEMORY_LIMIT || !navigator.storage?.getDirectory) {
    const target = new BufferTarget();
    return {
      target,
      getFile: async (name) => {
        if (!target.buffer) throw new Error("The encoder finished without producing an output file.");
        return new File([target.buffer], name, { type: "video/mp4", lastModified: Date.now() });
      },
      cleanup: async () => undefined
    };
  }

  const estimate = await navigator.storage.estimate();
  const available = (estimate.quota ?? 0) - (estimate.usage ?? 0);
  if (estimate.quota && available < estimatedBytes * 1.1) {
    throw new Error("There is not enough browser storage for this output. Choose a lower bitrate or resolution.");
  }

  const root = await navigator.storage.getDirectory();
  const temporaryName = `.quicksilver-${crypto.randomUUID()}.mp4`;
  const handle = await root.getFileHandle(temporaryName, { create: true });
  const writable = await handle.createWritable();
  const target = new StreamTarget(writable as unknown as WritableStream<StreamTargetChunk>, {
    chunked: true,
    chunkSize: 2 ** 20
  });
  let cleaned = false;

  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    await root.removeEntry(temporaryName).catch(() => undefined);
  };

  return {
    target,
    getFile: async (name) => {
      const storedFile = await handle.getFile();
      return new File([storedFile], name, { type: "video/mp4", lastModified: Date.now() });
    },
    cleanup
  };
}
