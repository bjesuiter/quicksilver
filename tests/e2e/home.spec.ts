import { expect, test } from "@playwright/test";

test("offers a private local video picker", async ({ page }) => {
  await page.goto(".");

  await expect(page).toHaveTitle("Quicksilver");
  await expect(page.getByRole("heading", { name: "Make iPhone videos smaller" })).toBeVisible();
  await expect(page.getByLabel("Choose video")).toHaveAttribute("type", "file");
  await expect(page.getByText("Your video stays on this device.")).toBeVisible();
});
