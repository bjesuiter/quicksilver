import type { PhotonImage } from "@silvia-odwyer/photon";
import type { SourceImage } from "../domain/media";

export type ImageFormat = "image/jpeg" | "image/png" | "image/webp";

export type ImageConversionSettings = {
  format: ImageFormat;
  width: number;
  height: number;
  quality: number;
};

const extensionFor = (format: ImageFormat) => ({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
})[format];

export async function convertImage(source: SourceImage, settings: ImageConversionSettings): Promise<File> {
  if (!Number.isInteger(settings.width) || !Number.isInteger(settings.height) || settings.width < 1 || settings.height < 1) {
    throw new Error("Enter valid output dimensions.");
  }

  let input: PhotonImage | undefined;
  let output: typeof input;

  try {
    const photon = await import("@silvia-odwyer/photon");
    await photon.default();
    input = photon.PhotonImage.new_from_byteslice(new Uint8Array(await source.file.arrayBuffer()));
    output = input;
    if (settings.width !== source.width || settings.height !== source.height) {
      output = photon.resize(input, settings.width, settings.height, photon.SamplingFilter.Lanczos3);
    }

    const bytes = settings.format === "image/jpeg"
      ? output.get_bytes_jpeg(Math.round(Math.min(100, Math.max(1, settings.quality))))
      : settings.format === "image/webp"
        ? output.get_bytes_webp()
        : output.get_bytes();
    const baseName = source.file.name.replace(/\.[^.]+$/, "") || "image";
    const fileBytes = new Uint8Array(bytes.byteLength);
    fileBytes.set(bytes);
    return new File([fileBytes.buffer], `${baseName}-quicksilver.${extensionFor(settings.format)}`, { type: settings.format });
  } catch {
    throw new Error("This image could not be converted. Try another JPEG, PNG, or WebP image.");
  } finally {
    if (output && output !== input) output.free();
    input?.free();
  }
}
