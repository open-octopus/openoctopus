import { test, expect } from "@playwright/test";

test.describe("Dashboard — Page Rendering", () => {
  test("home page renders realm grid and timeline", async ({ page }) => {
    await page.goto("/dashboard/");
    await expect(page.getByRole("heading", { name: /家庭管家/ })).toBeVisible();
    await expect(page.getByText("健康")).toBeVisible();
    await expect(page.getByText("财务")).toBeVisible();
    await expect(page.getByText("家庭时间线")).toBeVisible();
  });

  test("route view renders topology graph", async ({ page }) => {
    await page.goto("/dashboard/route");
    await expect(page.getByRole("heading", { name: /消息路由/ })).toBeVisible();
    await expect(page.getByText("最近路由")).toBeVisible();
  });

  test("members page renders member cards", async ({ page }) => {
    await page.goto("/dashboard/members");
    await expect(page.getByRole("heading", { name: /家庭成员/ })).toBeVisible();
    await expect(page.getByText(/王明/)).toBeVisible();
    await expect(page.getByText(/李雪/)).toBeVisible();
  });

  test("entities page renders entity cards", async ({ page }) => {
    await page.goto("/dashboard/entities");
    await expect(page.getByRole("heading", { name: /实体管理/ })).toBeVisible();
    await expect(page.getByText("橘子")).toBeVisible();
    await expect(page.getByText("爷爷的膝盖")).toBeVisible();
  });

  test("settings page shows gateway status", async ({ page }) => {
    await page.goto("/dashboard/settings");
    await expect(page.getByText("网关地址")).toBeVisible();
    await expect(page.getByText("ws://localhost:19789")).toBeVisible();
  });
});

test.describe("Dashboard — Navigation", () => {
  test("sidebar navigation works on desktop", async ({ page }) => {
    await page.goto("/dashboard/");

    await page.click('a:has-text("路由视图")');
    await expect(page.getByRole("heading", { name: /消息路由/ })).toBeVisible();

    await page.click('a:has-text("家庭成员")');
    await expect(page.getByRole("heading", { name: /家庭成员/ })).toBeVisible();

    await page.click('a:has-text("实体管理")');
    await expect(page.getByRole("heading", { name: /实体管理/ })).toBeVisible();

    await page.click('a:has-text("设置")');
    await expect(page.getByText("网关地址")).toBeVisible();

    await page.click('a:has-text("家庭总览")');
    await expect(page.getByRole("heading", { name: /家庭管家/ })).toBeVisible();
  });
});

test.describe("Dashboard — Interactions", () => {
  test("entity filter works", async ({ page }) => {
    await page.goto("/dashboard/entities");
    await expect(page.getByText("橘子")).toBeVisible();
    await expect(page.getByText("家用车")).toBeVisible();

    await page.click('button:has-text("健康")');
    await expect(page.getByText("橘子")).not.toBeVisible();
    await expect(page.getByText("爷爷的膝盖")).toBeVisible();
    await expect(page.getByText("家用车")).not.toBeVisible();

    await page.click('button:has-text("全部")');
    await expect(page.getByText("橘子")).toBeVisible();
    await expect(page.getByText("家用车")).toBeVisible();
  });

  test("connection status banner shows when gateway is unavailable", async ({ page }) => {
    await page.goto("/dashboard/");
    await expect(page.getByText("正在连接网关")).toBeVisible();
  });
});

test.describe("Dashboard — Mobile Layout", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("shows bottom navigation on mobile", async ({ page }) => {
    await page.goto("/dashboard/");
    // Bottom nav should be visible
    const bottomNav = page.locator("nav.fixed");
    await expect(bottomNav).toBeVisible();
    await expect(bottomNav.getByText("总览")).toBeVisible();
    await expect(bottomNav.getByText("路由")).toBeVisible();
  });

  test("mobile navigation between pages", async ({ page }) => {
    await page.goto("/dashboard/");
    const bottomNav = page.locator("nav.fixed");

    await bottomNav.getByText("成员").click();
    await expect(page.getByRole("heading", { name: /家庭成员/ })).toBeVisible();

    await bottomNav.getByText("实体").click();
    await expect(page.getByRole("heading", { name: /实体管理/ })).toBeVisible();
  });
});
