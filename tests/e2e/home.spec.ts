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
