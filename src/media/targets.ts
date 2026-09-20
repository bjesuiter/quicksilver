import { BufferTarget, StreamTarget, type StreamTargetChunk, type Target } from "mediabunny";

const IN_MEMORY_LIMIT = 100_000_000;

export type OutputStorage = {
  target: Target;
  getFile: (name: string, type: string) => Promise<File>;
  cleanup: () => Promise<void>;
};

export async function createOutputStorage(estimatedBytes: number, extension: string): Promise<OutputStorage> {
  if (estimatedBytes < IN_MEMORY_LIMIT) {
    const target = new BufferTarget();
    return {
      target,
      getFile: async (name, type) => {
        if (!target.buffer) throw new Error("The encoder finished without producing an output file.");
        return new File([target.buffer], name, { type, lastModified: Date.now() });
      },
      cleanup: async () => undefined
    };
  }

  if (!navigator.storage?.getDirectory) {
    throw new Error("This output is too large for in-memory conversion, and this browser does not provide temporary file storage.");
  }

  const estimate = await navigator.storage.estimate();
  const available = (estimate.quota ?? 0) - (estimate.usage ?? 0);
  if (estimate.quota && available < estimatedBytes * 1.1) {
    throw new Error("There is not enough browser storage for this output. Choose a lower bitrate or resolution.");
  }

  const root = await navigator.storage.getDirectory();
  const temporaryName = `.quicksilver-${crypto.randomUUID()}.${extension}`;
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
    getFile: async (name, type) => {
      const storedFile = await handle.getFile();
      return new File([storedFile], name, { type, lastModified: Date.now() });
    },
    cleanup
  };
}
