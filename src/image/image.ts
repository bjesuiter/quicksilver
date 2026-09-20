import type { SourceImage } from "../domain/media";

const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isSupportedImage(file: File): boolean {
  return supportedTypes.has(file.type.toLowerCase());
}

export async function probeImage(file: File): Promise<SourceImage> {
  if (!isSupportedImage(file)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }

  try {
    const bitmap = await createImageBitmap(file);
    const source = { mediaType: "image" as const, file, width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return source;
  } catch {
    throw new Error("This image could not be read. Choose a valid JPEG, PNG, or WebP image.");
  }
}
