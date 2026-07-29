import { expect, test } from "@playwright/test";

test("homepage exposes the identity and featured projects", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Mazha0309/);
  await expect(
    page.getByRole("heading", { name: "喵喵喵，这里是 Mazha0309" }),
  ).toBeVisible();
  await expect(page.getByText("OpenLogTool", { exact: true })).toBeVisible();
  await expect(page.getByText("RelayQR", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "打开管理员后台" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "登录管理员后台" }),
  ).toHaveAttribute("href", "/admin/login");
  await expect(page.getByLabel("站点公开统计")).toContainText("本站已营业");
  await expect(page.getByLabel("站点公开统计")).toContainText("独立访客");
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute(
    "href",
    "/favicon.svg",
  );
  await expect(page.locator(".marquee-strip__group")).toHaveCount(2);
  const marqueeGroups = await page
    .locator(".marquee-strip__group")
    .allTextContents();
  expect(marqueeGroups[0]).toBe(marqueeGroups[1]);
  expect(Array.from(marqueeGroups[0] ?? "").length).toBeGreaterThan(400);
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

test("friend exchange page has a real empty state before links are added", async ({
  page,
}) => {
  await page.goto("/friends");
  await expect(
    page.getByRole("heading", { name: "互联网邻居交换所" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "友链板刚擦干净" })).toBeVisible();
});

test("public liveness probe stays minimal", async ({ request }) => {
  const response = await request.get("/healthz");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  expect(body.ok).toBe(true);
  expect(body.database).toBeUndefined();
  expect(body.host).toBeUndefined();
});

test("detailed resource probe requires an admin session", async ({ request }) => {
  const response = await request.get("/api/admin/probe", { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toContain("/admin/login");
});
