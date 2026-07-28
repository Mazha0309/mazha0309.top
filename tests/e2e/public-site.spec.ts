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

test("blog article renders restricted MDX", async ({ page }) => {
  await page.goto("/blog/hello-from-the-desk");
  await expect(
    page.getByRole("heading", { name: "总之，先把这里搭起来" }),
  ).toBeVisible();
  await expect(page.locator(".mdx-note")).toContainText("当前状态");
  await expect(page.locator("pre")).toContainText('noise: "meow"');
});

test("theme switch persists the midnight desk", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /切换到午夜书桌主题/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "midnight");
});

test("global search finds seeded content", async ({ page }) => {
  await page.goto("/search?q=二维码");
  await expect(page.getByRole("link", { name: "RelayQR" })).toBeVisible();
});
