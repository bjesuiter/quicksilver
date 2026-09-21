import type { PhotonImage } from "@silvia-odwyer/photon";
import type { SourceImage } from "../domain/media";

export type ImageFormat = "image/avif" | "image/jpeg" | "image/png" | "image/webp";

export type ImageConversionSettings = {
  format: ImageFormat;
  width: number;
  height: number;
  quality: number;
};

const extensionFor = (format: ImageFormat) => ({
  "image/avif": "avif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
})[format];

async function encodeLossyImage(output: PhotonImage, format: "image/jpeg" | "image/webp", quality: number): Promise<Uint8Array> {
  const canvas = document.createElement("canvas");
  canvas.width = output.get_width();
  canvas.height = output.get_height();
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is unavailable");
  context.putImageData(new ImageData(new Uint8ClampedArray(output.get_raw_pixels()), canvas.width, canvas.height), 0, 0);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, format, Math.min(1, Math.max(0.01, quality / 100))));
  if (!blob) throw new Error("Image encoding is unavailable");
  return new Uint8Array(await blob.arrayBuffer());
}

export async function convertImage(source: SourceImage, settings: ImageConversionSettings): Promise<File> {
  if (!Number.isInteger(settings.width) || !Number.isInteger(settings.height) || settings.width < 1 || settings.height < 1) {
    throw new Error("Enter valid output dimensions.");
  }

  let input: PhotonImage | undefined;
  let output: typeof input;
  let bitmap: ImageBitmap | undefined;

  try {
    const photon = await import("@silvia-odwyer/photon");
    await photon.default();
    bitmap = await createImageBitmap(source.file, { imageOrientation: "from-image" });
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas is unavailable");
    context.drawImage(bitmap, 0, 0);
    input = new photon.PhotonImage(new Uint8Array(context.getImageData(0, 0, bitmap.width, bitmap.height).data), bitmap.width, bitmap.height);
    output = input;
    if (settings.width !== source.width || settings.height !== source.height) {
      output = photon.resize(input, settings.width, settings.height, photon.SamplingFilter.Lanczos3);
    }

    const bytes = settings.format === "image/png"
      ? output.get_bytes()
      : settings.format === "image/avif"
        ? (await import("@stacksjs/ts-avif")).encode({ data: output.get_raw_pixels(), width: output.get_width(), height: output.get_height() }, { quality: settings.quality })
        : await encodeLossyImage(output, settings.format, settings.quality);
    const baseName = source.file.name.replace(/\.[^.]+$/, "") || "image";
    const fileBytes = new Uint8Array(bytes.byteLength);
    fileBytes.set(bytes);
    return new File([fileBytes.buffer], `${baseName}-quicksilver.${extensionFor(settings.format)}`, { type: settings.format });
  } catch {
    throw new Error("This image could not be converted. Try another JPEG, PNG, or WebP image.");
  } finally {
    bitmap?.close();
    if (output && output !== input) output.free();
    input?.free();
  }
}
