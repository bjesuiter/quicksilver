/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/solid" />

import type { OutputSettings } from "./domain/media";
import type { ConversionProgress } from "./media/transcode";

declare global {
  interface Window {
    __QUICKSILVER_TEST_TRANSCODER__?: (options: {
      input: File;
      outputName: string;
      settings: OutputSettings;
      onProgress: (progress: ConversionProgress) => void;
      isCanceled: () => boolean;
    }) => Promise<File>;
  }
}
