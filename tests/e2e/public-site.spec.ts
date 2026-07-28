import { expect, test } from "@playwright/test";

test("homepage exposes the identity and featured projects", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Mazha0309/);
  await expect(
    page.getByRole("heading", { name: "喵喵喵，这里是 Mazha0309" }),
  ).toBeVisible();
  await expect(page.getByText("OpenLogTool", { exact: true })).toBeVisible();
  await expect(page.getByText("RelayQR", { exact: true })).toBeVisible();
});

test("blog starts empty for the owner to write", async ({ page }) => {
  await page.goto("/blog");
  await expect(
    page.getByRole("heading", { name: "这一格还没贴东西" }),
  ).toBeVisible();
  await expect(page.locator("article")).toHaveCount(0);
});

test("global search finds seeded content", async ({ page }) => {
  await page.goto("/search?q=二维码");
  await expect(page.getByRole("link", { name: "RelayQR" })).toBeVisible();
});
