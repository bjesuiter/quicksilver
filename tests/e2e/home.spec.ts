import { expect, test } from "@playwright/test";
import path from "node:path";

const sampleVideo = path.join(import.meta.dirname, "../fixtures/sample.mp4");
const samplePng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/iZk9HQAAAABJRU5ErkJggg==", "base64");

async function chooseDefaultVideoTarget(page: import("@playwright/test").Page) {
  await expect(page.getByRole("heading", { name: "Choose an output format" })).toBeVisible();
  await page.getByRole("button", { name: /H\.264 video/ }).click();
}

function silentWav(): Buffer {
  const buffer = Buffer.alloc(44 + 8_000);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write("WAVEfmt ", 8);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8_000, 24);
  buffer.writeUInt32LE(16_000, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(8_000, 40);
  return buffer;
}

test("offers a private local media picker", async ({ page }) => {
  await page.goto(".");

  await expect(page).toHaveTitle("Quicksilver");
  await expect(page.getByRole("heading", { name: "Convert media on your device" })).toBeVisible();
  await expect(page.getByLabel("Choose media")).toHaveAttribute("type", "file");
  await expect(page.getByLabel("Choose media")).toHaveAttribute("accept", /audio\/mpeg/);
  await expect(page.getByText("Your media stays on this device.")).toBeVisible();
});

test("navigates between direct conversion and templates without discarding a selected video", async ({ page }) => {
  await page.goto(".");

  const directConversion = page.getByRole("link", { name: "Direct conversion" });
  const templates = page.getByRole("link", { name: "Templates" });
  await expect(directConversion).toHaveAttribute("aria-current", "page");
  await expect(templates).not.toHaveAttribute("aria-current", "page");

  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await chooseDefaultVideoTarget(page);
  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();
  await page.getByLabel("Output width").fill("320");

  await templates.click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(page.getByRole("heading", { name: "Conversion recipes are on the way\." })).toBeVisible();
  await expect(templates).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "Go to Direct Conversion" }).click();
  await expect(page).not.toHaveURL(/\/templates$/);
  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();
  await expect(page.getByLabel("Output width")).toHaveValue("320");
});

test("opens the templates page directly", async ({ page }) => {
  await page.goto("templates");

  await expect(page.getByRole("heading", { name: "Conversion recipes are on the way\." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Templates" })).toHaveAttribute("aria-current", "page");
});

test("shows the build version and links the commit to GitHub", async ({ page }) => {
  await page.goto(".");

  const buildInfo = page.getByText(/^v\d+\.\d+\.\d+ · [0-9a-f]{7}$/);
  await expect(buildInfo).toBeVisible();
  await expect(buildInfo.getByRole("link")).toHaveAttribute(
    "href",
    /^https:\/\/github\.com\/bjesuiter\/quicksilver\/tree\/[0-9a-f]{40}$/
  );
});

test("publishes a project-path web manifest", async ({ page }) => {
  await page.goto(".");
  const manifestPath = await page.locator('link[rel="manifest"]').getAttribute("href");

  expect(manifestPath).toBe("/quicksilver/manifest.webmanifest");
  const response = await page.goto(manifestPath!);
  expect(response).not.toBeNull();
  expect(response!.ok()).toBe(true);
  const manifest = await response!.json();
  expect(manifest.start_url).toBe("/quicksilver/");
  expect(manifest.scope).toBe("/quicksilver/");
  expect(manifest.icons).toEqual(
    expect.arrayContaining([expect.objectContaining({ sizes: "192x192" }), expect.objectContaining({ sizes: "512x512" })])
  );
});

test("registers its service worker under the project path", async ({ page }) => {
  await page.goto(".");
  await page.waitForFunction(async () => Boolean(await navigator.serviceWorker?.ready), undefined, { timeout: 15_000 });

  const scope = await page.evaluate(async () => (await navigator.serviceWorker.ready).scope);
  expect(new URL(scope).pathname).toBe("/quicksilver/");
});

test("keeps the offline notice from blocking app controls", async ({ page }) => {
  await page.goto(".");
  const notice = page.getByText("Quicksilver is ready to use offline.");
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice.locator("xpath=ancestor::aside")).toHaveCSS("pointer-events", "none");
});

test("asks for an output format after selecting a video", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);

  await expect(page.getByRole("heading", { name: "Choose an output format" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose another source" })).toBeVisible();
  await expect(page.getByRole("button", { name: /H\.264 video/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /VP9 video/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /AV1 video/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Audio only/ })).toBeVisible();

  await page.getByRole("button", { name: /VP9 video/ }).click();
  await expect(page.getByText("VP9 video · WebM · efficient for the web")).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose another source" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Convert VP9 video" })).toBeEnabled();
});

test("returns to output format selection without replacing the source file", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await chooseDefaultVideoTarget(page);

  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();
  await page.getByRole("button", { name: "Change output format" }).click();
  await expect(page.getByRole("heading", { name: "Choose an output format" })).toBeVisible();
  await expect(page.getByRole("button", { name: /WebP image/ })).not.toBeVisible();
  await page.getByRole("button", { name: /VP9 video/ }).click();
  await expect(page.getByRole("button", { name: "Convert VP9 video" })).toBeEnabled();
});

test("extracts video audio into an M4A export", async ({ page }) => {
  await page.addInitScript(() => {
    window.__QUICKSILVER_TEST_TRANSCODER__ = async ({ input, outputName }) => new File([input], outputName, { type: "audio/mp4" });
  });
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await page.getByRole("button", { name: /Audio only/ }).click();

  await expect(page.getByText("The video track is removed.")).toBeVisible();
  await page.getByRole("button", { name: "Convert audio" }).click();
  await expect(page.getByRole("heading", { name: "Media ready" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download file" })).toHaveAttribute("download", "sample-quicksilver.m4a");
});

test("exports audio as MP3 at a selected CBR bitrate", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await page.getByRole("button", { name: /MP3 audio/ }).click();

  const bitrate = page.getByLabel("CBR bitrate");
  await expect(bitrate).toHaveValue("192000");
  await expect(bitrate.locator("option")).toHaveText(["128 kbit/s", "192 kbit/s", "256 kbit/s", "320 kbit/s"]);
  await expect(page.getByText("Constant bitrate is a target.")).toBeVisible();

  await bitrate.selectOption("320000");
  await expect(bitrate).toHaveValue("320000");
  await page.getByRole("button", { name: "Convert audio" }).click();
  await expect(page.getByRole("heading", { name: "Media ready" })).toBeVisible();
  const download = page.getByRole("link", { name: "Download file" });
  await expect(download).toHaveAttribute("download", "sample-quicksilver.mp3");
  await expect(download.evaluate(async (link) => {
    const bytes = new Uint8Array(await (await fetch((link as HTMLAnchorElement).href)).arrayBuffer());
    return (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0);
  })).resolves.toBe(true);

  await page.getByRole("button", { name: "Convert again with different settings" }).click();
  await expect(page.getByText("MP3 audio · 320 kbit/s CBR")).toBeVisible();
});

test("reads video details and opens compression controls", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await chooseDefaultVideoTarget(page);

  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();
  await expect(page.getByTestId("source-resolution")).toHaveText("640 × 360");
  await expect(page.getByTestId("source-frame-rate")).toContainText("30");
  await expect(page.getByTestId("source-bitrate")).toContainText("Mbps");
  await expect(page.getByLabel("Output width")).toHaveValue("640");
  await expect(page.getByLabel("Output height")).toHaveValue("360");
  await expect(page.getByLabel("Output frame rate")).toHaveValue("30");
  await expect(page.getByLabel("Target bitrate")).not.toHaveValue("");
  await expect(page.getByText(/Estimated size/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Convert H.264 video" })).toBeEnabled();
});

test("opens an audio-only file as an audio conversion", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles({
    name: "tone.wav",
    mimeType: "audio/wav",
    buffer: silentWav()
  });
  await expect(page.getByRole("heading", { name: "Choose an output format" })).toBeVisible();
  await page.getByRole("button", { name: /Audio only/ }).click();

  await expect(page.getByRole("heading", { name: "tone.wav" })).toBeVisible();
  await expect(page.getByText("Source audio")).toBeVisible();
  await expect(page.getByText("Audio is converted to AAC in an M4A file at 192 kbps for broad compatibility.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Convert audio" })).toBeEnabled();
});

test("updates all output settings and validates the target", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await chooseDefaultVideoTarget(page);
  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();

  await page.getByLabel("Output width").fill("320");
  await expect(page.getByLabel("Output height")).toHaveValue("180");
  await page.getByLabel("Output frame rate").fill("24");
  await page.getByLabel("Target bitrate").fill("0.5");

  await expect(page.getByLabel("Output width")).toHaveValue("320");
  await expect(page.getByLabel("Output frame rate")).toHaveValue("24");
  await expect(page.getByLabel("Target bitrate")).toHaveValue("0.5");
  await expect(page.getByRole("button", { name: "Convert H.264 video" })).toBeEnabled();

  await page.getByLabel("Target bitrate").fill("0");
  await expect(page.getByRole("button", { name: "Convert H.264 video" })).toBeDisabled();
  await expect(page.getByText(/Enter valid dimensions/)).toBeVisible();
});

test("compresses a video and remembers its export settings", async ({ page }) => {
  test.setTimeout(60_000);
  await page.addInitScript(() => {
    window.__QUICKSILVER_TEST_TRANSCODER__ = async ({ input, outputName, onProgress, isCanceled }) => {
      onProgress({ fraction: 0.4, processedTime: 0.8, bytesWritten: 80_000 });
      await new Promise((resolve) => setTimeout(resolve, 150));
      if (isCanceled()) throw new Error("Conversion canceled");
      onProgress({ fraction: 1, processedTime: 2, bytesWritten: input.size });
      return new File([input], outputName, { type: "video/mp4" });
    };
  });
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await chooseDefaultVideoTarget(page);
  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();

  await page.getByLabel("Output width").fill("320");
  await page.getByLabel("Output frame rate").fill("24");
  await page.getByLabel("Target bitrate").fill("0.5");
  await page.getByRole("button", { name: "Convert H.264 video" }).click();

  await expect(page.getByText("Converting media")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Media ready" })).toBeVisible({ timeout: 45_000 });
  const download = page.getByRole("link", { name: "Download file" });
  await expect(download).toHaveAttribute("download", "sample-quicksilver.mp4");
  await expect(download).toHaveAttribute("href", /^blob:/);
  await expect(page.getByText(/smaller than the source|larger than the source/)).toBeVisible();

  await page.getByRole("button", { name: "Convert again with different settings" }).click();

  await expect(page.getByLabel("Output width")).toHaveValue("320");
  await expect(page.getByLabel("Output height")).toHaveValue("180");
  await expect(page.getByLabel("Output frame rate")).toHaveValue("24");
  await expect(page.getByLabel("Target bitrate")).toHaveValue("0.5");
  await expect(page.getByText("Already exported for sample.mp4")).toBeVisible();
  await expect(page.getByText("H.264 · 320 × 180 · 24 fps · 0.5 Mbps")).toBeVisible();

  await page.reload();
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await chooseDefaultVideoTarget(page);

  await expect(page.getByText("Already exported for sample.mp4")).toBeVisible();
  await expect(page.getByText("H.264 · 320 × 180 · 24 fps · 0.5 Mbps")).toBeVisible();
});

test("cancels an in-progress conversion and returns to the settings", async ({ page }) => {
  await page.addInitScript(() => {
    window.__QUICKSILVER_TEST_TRANSCODER__ = async ({ input, outputName, onProgress, isCanceled }) => {
      onProgress({ fraction: 0.2, processedTime: 0.4, bytesWritten: 30_000 });
      while (!isCanceled()) await new Promise((resolve) => setTimeout(resolve, 20));
      throw new Error(`Canceled ${input.name} before creating ${outputName}`);
    };
  });
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles(sampleVideo);
  await chooseDefaultVideoTarget(page);
  await page.getByRole("button", { name: "Convert H.264 video" }).click();

  await expect(page.getByText("Converting media")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("button", { name: "Convert H.264 video" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Media ready" })).not.toBeVisible();
});

test("converts a PNG image to JPEG", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: samplePng });

  await expect(page.getByRole("heading", { name: "Choose an output format" })).toBeVisible();
  await expect(page.getByRole("button", { name: /JPEG image/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /PNG image/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /WebP image/ })).toBeVisible();
  await page.getByRole("button", { name: /JPEG image/ }).click();
  await expect(page.getByRole("heading", { name: "pixel.png" })).toBeVisible();
  await expect(page.getByText("1 × 1", { exact: true })).toBeVisible();
  await expect(page.getByText("JPEG image · JPG · compact photos and sharing")).toBeVisible();
  await page.getByRole("button", { name: "Convert image" }).click();

  await expect(page.getByRole("heading", { name: "Image ready" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute("download", "pixel-quicksilver.jpg");
  await expect(page.getByRole("link", { name: "Download image" })).toHaveAttribute("href", /^blob:/);
});

test("offers AVIF as a beta image target", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: samplePng });

  const avif = page.getByRole("button", { name: /AVIF image/ });
  await expect(avif).toBeVisible();
  await expect(avif.getByText("Beta")).toBeVisible();
  await avif.click();

  await expect(page.getByText("AVIF image · AVIF · compact photos · no transparency")).toBeVisible();
  await expect(page.getByLabel("Output quality")).toBeVisible();
  await page.getByRole("button", { name: "Convert image" }).click();
  await expect(page.getByRole("heading", { name: "Image ready" })).toBeVisible();
  const download = page.getByRole("link", { name: "Download image" });
  await expect(download).toHaveAttribute("download", "pixel-quicksilver.avif");
  await expect(download.evaluate(async (link) => {
    const bytes = new Uint8Array(await (await fetch((link as HTMLAnchorElement).href)).arrayBuffer());
    return new TextDecoder().decode(bytes.slice(4, 12));
  })).resolves.toBe("ftypavif");
});

test("locks image output dimensions to the source aspect ratio by default", async ({ page }) => {
  await page.addInitScript(() => {
    window.createImageBitmap = async () => ({ width: 2, height: 1, close() {} }) as unknown as ImageBitmap;
  });
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles({ name: "wide.png", mimeType: "image/png", buffer: samplePng });
  await page.getByRole("button", { name: /JPEG image/ }).click();

  const aspectRatioToggle = page.getByRole("button", { name: "Keep aspect ratio" });
  await expect(aspectRatioToggle).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Output width").fill("400");
  await expect(page.getByLabel("Output height")).toHaveValue("200");

  await aspectRatioToggle.click();
  await expect(aspectRatioToggle).toHaveAttribute("aria-pressed", "false");
  await page.getByLabel("Output width").fill("300");
  await expect(page.getByLabel("Output height")).toHaveValue("200");
  await page.getByLabel("Output height").fill("100");
  await expect(page.getByLabel("Output width")).toHaveValue("300");
});

test("offers named quality levels for JPEG and sends the selected level to its encoder", async ({ page }) => {
  await page.addInitScript(() => {
    const originalToBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      (window as Window & { __quicksilverEncoderQuality?: number }).__quicksilverEncoderQuality = typeof quality === "number" ? quality : undefined;
      return originalToBlob.call(this, callback, type, quality);
    };
  });
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: samplePng });
  await page.getByRole("button", { name: /JPEG image/ }).click();

  const quality = page.getByLabel("Output quality");
  await expect(quality).toHaveValue("80");
  await expect(quality.locator("option")).toHaveText(["Smaller file", "Balanced", "Best quality"]);
  await quality.selectOption({ label: "Best quality" });
  await page.getByRole("button", { name: "Convert image" }).click();
  await expect(page.getByRole("heading", { name: "Image ready" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __quicksilverEncoderQuality?: number }).__quicksilverEncoderQuality)).toBe(0.95);
});

test("shows quality levels for WebP but not lossless PNG", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose media").setInputFiles({ name: "pixel.png", mimeType: "image/png", buffer: samplePng });
  await page.getByRole("button", { name: /PNG image/ }).click();
  await expect(page.getByLabel("Output quality")).not.toBeVisible();

  await page.getByRole("button", { name: "Change output format" }).click();
  await page.getByRole("button", { name: /WebP image/ }).click();
  await expect(page.getByLabel("Output quality")).toBeVisible();
});
