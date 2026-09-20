import { expect, test } from "@playwright/test";
import path from "node:path";

const sampleVideo = path.join(import.meta.dirname, "../fixtures/sample.mp4");

test("offers a private local video picker", async ({ page }) => {
  await page.goto(".");

  await expect(page).toHaveTitle("Quicksilver");
  await expect(page.getByRole("heading", { name: "Make iPhone videos smaller" })).toBeVisible();
  await expect(page.getByLabel("Choose video")).toHaveAttribute("type", "file");
  await expect(page.getByText("Your video stays on this device.")).toBeVisible();
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

test("reads video details and opens compression controls", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose video").setInputFiles(sampleVideo);

  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();
  await expect(page.getByTestId("source-resolution")).toHaveText("640 × 360");
  await expect(page.getByTestId("source-frame-rate")).toContainText("30");
  await expect(page.getByTestId("source-bitrate")).toContainText("Mbps");
  await expect(page.getByLabel("Output width")).toHaveValue("640");
  await expect(page.getByLabel("Output height")).toHaveValue("360");
  await expect(page.getByLabel("Output frame rate")).toHaveValue("30");
  await expect(page.getByLabel("Target bitrate")).not.toHaveValue("");
  await expect(page.getByText(/Estimated size/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Compress video" })).toBeEnabled();
});

test("updates all output settings and validates the target", async ({ page }) => {
  await page.goto(".");
  await page.getByLabel("Choose video").setInputFiles(sampleVideo);
  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();

  await page.getByLabel("Output width").fill("320");
  await expect(page.getByLabel("Output height")).toHaveValue("180");
  await page.getByLabel("Output frame rate").fill("24");
  await page.getByLabel("Target bitrate").fill("0.5");

  await expect(page.getByLabel("Output width")).toHaveValue("320");
  await expect(page.getByLabel("Output frame rate")).toHaveValue("24");
  await expect(page.getByLabel("Target bitrate")).toHaveValue("0.5");
  await expect(page.getByRole("button", { name: "Compress video" })).toBeEnabled();

  await page.getByLabel("Target bitrate").fill("0");
  await expect(page.getByRole("button", { name: "Compress video" })).toBeDisabled();
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
  await page.getByLabel("Choose video").setInputFiles(sampleVideo);
  await expect(page.getByRole("heading", { name: "sample.mp4" })).toBeVisible();

  await page.getByLabel("Output width").fill("320");
  await page.getByLabel("Output frame rate").fill("24");
  await page.getByLabel("Target bitrate").fill("0.5");
  await page.getByRole("button", { name: "Compress video" }).click();

  await expect(page.getByText("Compressing video")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Video ready" })).toBeVisible({ timeout: 45_000 });
  const download = page.getByRole("link", { name: "Download MP4" });
  await expect(download).toHaveAttribute("download", "sample-quicksilver.mp4");
  await expect(download).toHaveAttribute("href", /^blob:/);
  await expect(page.getByText(/smaller than the source|larger than the source/)).toBeVisible();

  await page.getByRole("button", { name: "Convert again with different settings" }).click();

  await expect(page.getByLabel("Output width")).toHaveValue("320");
  await expect(page.getByLabel("Output height")).toHaveValue("180");
  await expect(page.getByLabel("Output frame rate")).toHaveValue("24");
  await expect(page.getByLabel("Target bitrate")).toHaveValue("0.5");
  await expect(page.getByText("Already exported for sample.mp4")).toBeVisible();
  await expect(page.getByText("320 × 180 · 24 fps · 0.5 Mbps")).toBeVisible();

  await page.reload();
  await page.getByLabel("Choose video").setInputFiles(sampleVideo);

  await expect(page.getByText("Already exported for sample.mp4")).toBeVisible();
  await expect(page.getByText("320 × 180 · 24 fps · 0.5 Mbps")).toBeVisible();
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
  await page.getByLabel("Choose video").setInputFiles(sampleVideo);
  await page.getByRole("button", { name: "Compress video" }).click();

  await expect(page.getByText("Compressing video")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  await expect(page.getByRole("button", { name: "Compress video" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Video ready" })).not.toBeVisible();
});
